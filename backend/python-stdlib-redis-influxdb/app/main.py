"""HTTP server and routing, built only on the standard library (http.server).

Start with:  python -m app.main
"""

import json
import logging
import signal
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from .config import Settings
from .health import HealthChecker
from .influxdb_client import create_influxdb
from .redis_client import create_redis

logger = logging.getLogger("app")


def make_handler(checker: HealthChecker, allowed_origins: tuple[str, ...]):
    routes = {
        "/health": checker.api,
        "/health/app": checker.app,
        "/health/db": checker.db,
    }

    class HealthRequestHandler(BaseHTTPRequestHandler):
        server_version = "TechnologyLab"
        sys_version = ""  # do not advertise the Python version

        def do_GET(self):
            path = urlsplit(self.path).path.rstrip("/") or "/"
            route = routes.get(path)
            if route is None:
                self._send(404, {"status": "error", "message": "Not found"})
                return
            try:
                status, body = route()
            except Exception:
                logger.exception("Unhandled error on %s", path)
                status, body = 500, {"status": "error", "message": "Internal server error"}
            self._send(status, body)

        def do_OPTIONS(self):
            self.send_response(HTTPStatus.NO_CONTENT)
            self._cors_headers()
            self.send_header("Content-Length", "0")
            self.end_headers()

        def _method_not_allowed(self):
            self._send(405, {"status": "error", "message": "Method not allowed"}, {"Allow": "GET, OPTIONS"})

        do_POST = do_PUT = do_PATCH = do_DELETE = _method_not_allowed

        def _cors_headers(self):
            origin = self.headers.get("Origin")
            if origin and origin in allowed_origins:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.send_header("Vary", "Origin")

        def _send(self, status: int, body: dict, extra_headers: dict | None = None):
            payload = json.dumps(body).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            for name, value in (extra_headers or {}).items():
                self.send_header(name, value)
            self._cors_headers()
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, format, *args):
            logger.info("%s - %s", self.address_string(), format % args)

    return HealthRequestHandler


def create_server(settings: Settings, host: str = "0.0.0.0", port: int | None = None):
    """Builds the server and its database clients. Nothing connects until a request needs it."""
    redis_client = create_redis(settings)
    influx_client = create_influxdb(settings)
    checker = HealthChecker(redis_client, influx_client, settings.influxdb_bucket)

    server = ThreadingHTTPServer(
        (host, settings.api_port if port is None else port),
        make_handler(checker, settings.cors_allowed_origins),
    )
    server.daemon_threads = True

    def close():
        server.server_close()
        checker.close()
        influx_client.close()
        redis_client.close()

    return server, close


def main() -> None:
    settings = Settings.from_env()
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    server, close = create_server(settings)

    def stop(signum, _frame):
        logger.info("Received %s, shutting down", signal.Signals(signum).name)
        # shutdown() blocks until serve_forever() returns, so call it from another thread.
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    logger.info("python-stdlib-redis-influxdb-api listening on port %s", server.server_address[1])
    try:
        server.serve_forever()
    finally:
        close()
        logger.info("Server stopped")


if __name__ == "__main__":
    main()
