"""InfluxDB connection.

This module lives inside the `app` package, so `import influxdb_client` below resolves to the
official library, not to this file. Always start the app with `python -m app.main`;
running `python app/main.py` would put this directory on sys.path and shadow the library.
"""

from influxdb_client import InfluxDBClient

from .config import Settings


def create_influxdb(settings: Settings) -> InfluxDBClient:
    # InfluxDB is reached over HTTP, so there is no persistent connection to lose:
    # each call opens or reuses an HTTP connection and fails within the timeout.
    return InfluxDBClient(
        url=settings.influxdb_url,
        token=settings.influxdb_token,
        org=settings.influxdb_org,
        timeout=settings.influxdb_timeout_ms,
        retries=False,
    )


def ping_influxdb(client: InfluxDBClient, bucket: str) -> None:
    """Raises unless InfluxDB answers an authenticated request and the bucket exists.

    Looking up the bucket checks more than /ping would: the server is up, the token is valid,
    and the configured bucket is there. It never writes data.
    """
    if client.buckets_api().find_bucket_by_name(bucket) is None:
        raise LookupError("Configured InfluxDB bucket not found")
