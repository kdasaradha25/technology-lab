"""Environment configuration. Values in .env are applied unless already set in the environment."""

import os
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def load_dotenv(path: Path = PROJECT_ROOT / ".env") -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def _list(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    api_port: int = 8006
    log_level: str = "INFO"
    cors_allowed_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4200",
    )

    redis_host: str = "127.0.0.1"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str = ""
    redis_timeout: float = 2.0

    influxdb_url: str = "http://127.0.0.1:8086"
    influxdb_org: str = "technology-lab"
    influxdb_bucket: str = "health"
    influxdb_token: str = ""
    influxdb_timeout_ms: int = 3000

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv()
        env = os.environ.get
        defaults = cls()
        return cls(
            api_port=int(env("API_PORT", defaults.api_port)),
            log_level=env("LOG_LEVEL", defaults.log_level),
            cors_allowed_origins=tuple(_list(env("CORS_ALLOWED_ORIGINS", ",".join(defaults.cors_allowed_origins)))),
            redis_host=env("REDIS_HOST", defaults.redis_host),
            redis_port=int(env("REDIS_PORT", defaults.redis_port)),
            redis_db=int(env("REDIS_DB", defaults.redis_db)),
            redis_password=env("REDIS_PASSWORD", defaults.redis_password),
            redis_timeout=float(env("REDIS_TIMEOUT", defaults.redis_timeout)),
            influxdb_url=env("INFLUXDB_URL", defaults.influxdb_url),
            influxdb_org=env("INFLUXDB_ORG", defaults.influxdb_org),
            influxdb_bucket=env("INFLUXDB_BUCKET", defaults.influxdb_bucket),
            influxdb_token=env("INFLUXDB_TOKEN", defaults.influxdb_token),
            influxdb_timeout_ms=int(env("INFLUXDB_TIMEOUT_MS", defaults.influxdb_timeout_ms)),
        )
