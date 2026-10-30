"""Redis connection."""

import redis

from .config import Settings


def create_redis(settings: Settings) -> redis.Redis:
    # The client keeps a connection pool and reconnects by itself after Redis restarts.
    return redis.Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        db=settings.redis_db,
        password=settings.redis_password or None,
        socket_connect_timeout=settings.redis_timeout,
        socket_timeout=settings.redis_timeout,
        decode_responses=True,
    )


def ping_redis(client: redis.Redis) -> None:
    """Raises if Redis does not answer PING. Never writes data."""
    if client.ping() is not True:
        raise redis.ConnectionError("Unexpected PING response")
