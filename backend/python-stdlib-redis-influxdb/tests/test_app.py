"""Integration tests (standard library unittest). Redis and InfluxDB must be running:

    docker compose up -d redis influxdb
    python -m unittest -v

Each test starts the real HTTP server on a free port. "Unavailable" databases are simulated
by pointing the settings at a port where nothing listens.
"""

import dataclasses
import json
import logging
import threading
import time
import unittest
import urllib.error
import urllib.request

from app.config import Settings
from app.database_setup import REDIS_TEST_KEY, verify_influxdb, verify_redis
from app.influxdb_client import create_influxdb
from app.main import create_server
from app.redis_client import create_redis

logging.disable(logging.CRITICAL)  # expected failures are logged; keep test output clean

SETTINGS = Settings.from_env()
DEAD_REDIS = {"redis_port": 1, "redis_timeout": 1.0}
DEAD_INFLUX = {"influxdb_url": "http://127.0.0.1:1", "influxdb_timeout_ms": 1000}

UNHEALTHY = {"status": "unhealthy", "message": "Database connection failed"}
HEALTHY = {"status": "healthy", "message": "Database connection successful"}


class RunningServer:
    def __init__(self, **overrides):
        settings = dataclasses.replace(SETTINGS, **overrides)
        self.server, self._close = create_server(settings, host="127.0.0.1", port=0)
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"
        self._thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self):
        self._thread.start()
        return self

    def __exit__(self, *exc):
        self.server.shutdown()
        self._close()

    def request(self, path, method="GET", headers=None):
        req = urllib.request.Request(self.base + path, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status, dict(resp.headers), resp.read()
        except urllib.error.HTTPError as err:
            return err.code, dict(err.headers), err.read()

    def get_json(self, path):
        status, _, body = self.request(path)
        return status, json.loads(body)


class AllDatabasesUpTests(unittest.TestCase):
    def test_health(self):
        with RunningServer() as srv:
            self.assertEqual(srv.get_json("/health"), (200, {"status": "healthy", "service": "python-stdlib-redis-influxdb-api"}))

    def test_health_app(self):
        with RunningServer() as srv:
            status, body = srv.get_json("/health/app")
        self.assertEqual(status, 200)
        self.assertEqual(body, {
            "status": "healthy",
            "service": "python-stdlib-redis-influxdb-api",
            "database": {
                "status": "healthy",
                "type": "redis,influxdb",
                "redis": {"status": "healthy", "type": "redis"},
                "influxdb": {"status": "healthy", "type": "influxdb"},
            },
        })

    def test_health_db(self):
        with RunningServer() as srv:
            status, body = srv.get_json("/health/db")
        self.assertEqual(status, 200)
        self.assertEqual(body, {
            **HEALTHY,
            "database": "redis,influxdb",
            "databases": {
                "redis": {**HEALTHY, "database": "redis"},
                "influxdb": {**HEALTHY, "database": "influxdb"},
            },
        })

    def test_health_checks_do_not_write_redis_data(self):
        redis_client = create_redis(SETTINGS)
        keys_before = redis_client.dbsize()
        with RunningServer() as srv:
            srv.get_json("/health/db")
            srv.get_json("/health/app")
        self.assertEqual(redis_client.dbsize(), keys_before)
        redis_client.close()

    def test_cors_preflight_404_and_405(self):
        with RunningServer() as srv:
            _, headers, _ = srv.request("/health", headers={"Origin": "http://localhost:4200"})
            self.assertEqual(headers.get("Access-Control-Allow-Origin"), "http://localhost:4200")

            _, headers, _ = srv.request("/health", headers={"Origin": "http://evil.example"})
            self.assertNotIn("Access-Control-Allow-Origin", headers)

            status, _, _ = srv.request("/health/db", method="OPTIONS", headers={"Origin": "http://localhost:3000"})
            self.assertEqual(status, 204)

            self.assertEqual(srv.get_json("/nope")[0], 404)
            status, headers, _ = srv.request("/health", method="POST")
            self.assertEqual((status, headers.get("Allow")), (405, "GET, OPTIONS"))


class DatabaseUnavailableTests(unittest.TestCase):
    def assert_partial(self, overrides, redis_ok, influx_ok):
        with RunningServer(**overrides) as srv:
            self.assertEqual(srv.get_json("/health")[0], 200, "/health must not depend on databases")

            status, body = srv.get_json("/health/app")
            self.assertEqual(status, 503)
            self.assertEqual(body["status"], "unhealthy")
            self.assertEqual(body["database"]["status"], "unhealthy")
            self.assertEqual(body["database"]["redis"]["status"], "healthy" if redis_ok else "unhealthy")
            self.assertEqual(body["database"]["influxdb"]["status"], "healthy" if influx_ok else "unhealthy")

            start = time.monotonic()
            status, body = srv.get_json("/health/db")
            elapsed = time.monotonic() - start
            self.assertEqual(status, 503)
            self.assertEqual(body["status"], "unhealthy")
            self.assertEqual(body["message"], "Database connection failed")
            self.assertEqual(body["databases"]["redis"], {**(HEALTHY if redis_ok else UNHEALTHY), "database": "redis"})
            self.assertEqual(body["databases"]["influxdb"], {**(HEALTHY if influx_ok else UNHEALTHY), "database": "influxdb"})
            self.assertLess(elapsed, 5, "checks must fail within their timeouts")

    def test_redis_unavailable(self):
        self.assert_partial(DEAD_REDIS, redis_ok=False, influx_ok=True)

    def test_influxdb_unavailable(self):
        self.assert_partial(DEAD_INFLUX, redis_ok=True, influx_ok=False)

    def test_both_unavailable(self):
        self.assert_partial({**DEAD_REDIS, **DEAD_INFLUX}, redis_ok=False, influx_ok=False)

    def test_wrong_credentials(self):
        self.assert_partial(
            {"redis_password": "wrong-password", "influxdb_token": "wrong-token"},
            redis_ok=False, influx_ok=False,
        )

    def test_missing_bucket(self):
        self.assert_partial({"influxdb_bucket": "does-not-exist"}, redis_ok=True, influx_ok=False)


class VerificationUtilityTests(unittest.TestCase):
    def test_redis_key_value_round_trip(self):
        client = create_redis(SETTINGS)
        result = verify_redis(client)
        self.assertTrue(result["deleted"])
        self.assertEqual(client.exists(REDIS_TEST_KEY), 0)
        client.close()

    def test_influxdb_write_and_read_point(self):
        client = create_influxdb(SETTINGS)
        result = verify_influxdb(client, SETTINGS.influxdb_bucket, SETTINGS.influxdb_org)
        self.assertEqual(result["measurement"], "health_verification")
        client.close()


if __name__ == "__main__":
    unittest.main()
