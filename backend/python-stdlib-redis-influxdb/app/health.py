"""Health-check logic. Each method returns (HTTP status, response body)."""

import logging
from concurrent.futures import ThreadPoolExecutor

from .influxdb_client import ping_influxdb
from .redis_client import ping_redis

logger = logging.getLogger(__name__)

SERVICE_NAME = "python-stdlib-redis-influxdb-api"
DATABASE_TYPES = "redis,influxdb"


class HealthChecker:
    def __init__(self, redis_client, influxdb_client, influxdb_bucket: str):
        self.redis = redis_client
        self.influxdb = influxdb_client
        self.influxdb_bucket = influxdb_bucket
        # Both databases are checked in parallel, so a slow one does not delay the other.
        self._pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="health")

    def _check(self, name: str, check) -> bool:
        try:
            check()
            return True
        except Exception as exc:  # any failure means this database is unhealthy
            # Log only the exception type: driver messages can include hosts or tokens.
            logger.warning("%s health check failed: %s", name, type(exc).__name__)
            return False

    def _check_databases(self) -> dict[str, bool]:
        redis_future = self._pool.submit(self._check, "Redis", lambda: ping_redis(self.redis))
        influx_future = self._pool.submit(
            self._check, "InfluxDB", lambda: ping_influxdb(self.influxdb, self.influxdb_bucket)
        )
        return {"redis": redis_future.result(), "influxdb": influx_future.result()}

    def api(self) -> tuple[int, dict]:
        return 200, {"status": "healthy", "service": SERVICE_NAME}

    def app(self) -> tuple[int, dict]:
        results = self._check_databases()
        healthy = all(results.values())
        overall = _status(healthy)
        return (200 if healthy else 503), {
            "status": overall,
            "service": SERVICE_NAME,
            "database": {
                "status": overall,
                "type": DATABASE_TYPES,
                "redis": {"status": _status(results["redis"]), "type": "redis"},
                "influxdb": {"status": _status(results["influxdb"]), "type": "influxdb"},
            },
        }

    def db(self) -> tuple[int, dict]:
        results = self._check_databases()
        healthy = all(results.values())
        return (200 if healthy else 503), {
            "status": _status(healthy),
            "database": DATABASE_TYPES,
            "message": "Database connection successful" if healthy else "Database connection failed",
            "databases": {
                name: {
                    "status": _status(ok),
                    "database": name,
                    "message": "Database connection successful" if ok else "Database connection failed",
                }
                for name, ok in results.items()
            },
        }

    def close(self) -> None:
        self._pool.shutdown(wait=False)


def _status(ok: bool) -> str:
    return "healthy" if ok else "unhealthy"
