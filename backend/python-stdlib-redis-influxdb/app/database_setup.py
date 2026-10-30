"""Database verification utilities: real write/read round trips for Redis and InfluxDB.

These do write data, so they are NOT used by the health endpoints. Run them on demand:

    python -m app.database_setup
"""

import logging
import sys
import time
import uuid

from influxdb_client import Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

from .config import Settings
from .influxdb_client import create_influxdb, ping_influxdb
from .redis_client import create_redis, ping_redis

logger = logging.getLogger(__name__)

REDIS_TEST_KEY = "technology-lab:verification"
INFLUX_MEASUREMENT = "health_verification"


def verify_redis(client) -> dict:
    """PING, then SET (with a 60s expiry), GET and DEL a test key."""
    ping_redis(client)
    value = uuid.uuid4().hex
    client.set(REDIS_TEST_KEY, value, ex=60)  # expires anyway if DEL is never reached
    try:
        stored = client.get(REDIS_TEST_KEY)
        if stored != value:
            raise AssertionError("Redis returned a different value than was written")
    finally:
        client.delete(REDIS_TEST_KEY)
    return {"key": REDIS_TEST_KEY, "value": value, "deleted": client.exists(REDIS_TEST_KEY) == 0}


def verify_influxdb(client, bucket: str, org: str) -> dict:
    """Write one point tagged with a unique run id, then query it back with Flux."""
    ping_influxdb(client, bucket)
    run_id = uuid.uuid4().hex
    timestamp_ns = time.time_ns()
    point = (
        Point(INFLUX_MEASUREMENT)
        .tag("run_id", run_id)
        .field("value", 1.0)
        .time(timestamp_ns, WritePrecision.NS)
    )
    client.write_api(write_options=SYNCHRONOUS).write(bucket=bucket, org=org, record=point)

    # InfluxDB OSS does not support Flux query parameters (`params` is Cloud-only), so values are
    # embedded. That is safe here: run_id is a hex UUID generated above, and the bucket comes from config.
    query = f'''
        from(bucket: "{bucket}")
          |> range(start: -5m)
          |> filter(fn: (r) => r._measurement == "{INFLUX_MEASUREMENT}" and r.run_id == "{run_id}")
    '''
    tables = client.query_api().query(query, org=org)
    records = [record for table in tables for record in table.records]
    if len(records) != 1 or records[0].get_value() != 1.0:
        raise AssertionError(f"Expected 1 point with value 1.0, got {len(records)}")
    return {"measurement": INFLUX_MEASUREMENT, "run_id": run_id, "time": records[0].get_time().isoformat()}


def main() -> int:
    logging.basicConfig(level="INFO", format="%(levelname)s %(message)s")
    settings = Settings.from_env()
    redis_client = create_redis(settings)
    influx_client = create_influxdb(settings)
    ok = True

    for name, verify in (
        ("Redis", lambda: verify_redis(redis_client)),
        ("InfluxDB", lambda: verify_influxdb(influx_client, settings.influxdb_bucket, settings.influxdb_org)),
    ):
        try:
            logger.info("%s verification passed: %s", name, verify())
        except Exception as exc:
            ok = False
            logger.error("%s verification failed: %s", name, type(exc).__name__)

    influx_client.close()
    redis_client.close()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
