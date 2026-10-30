import logging
import time

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.database_url,
    # Detect connections dropped by a MySQL restart before using them.
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={
        "connect_timeout": settings.mysql_connect_timeout,
        "read_timeout": settings.mysql_connect_timeout,
        "write_timeout": settings.mysql_connect_timeout,
    },
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


_tables_ready = False


def get_db():
    """FastAPI dependency: one session per request, always closed afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_tables(bind=None) -> None:
    """Create tables once. Safe to call repeatedly; does nothing after the first success."""
    global _tables_ready
    if _tables_ready:
        return
    from . import models  # noqa: F401 - registers the model with Base.metadata

    Base.metadata.create_all(bind=bind or engine)
    _tables_ready = True


def init_db_with_retry() -> None:
    """Wait for MySQL during startup. If it never arrives, start anyway and report unhealthy."""
    for attempt in range(1, settings.db_startup_retries + 1):
        try:
            ensure_tables()
            logger.info("MySQL is ready; tables verified")
            return
        except Exception as exc:  # any failure means MySQL is not ready yet
            logger.warning(
                "MySQL not ready (attempt %d/%d): %s",
                attempt,
                settings.db_startup_retries,
                exc.__class__.__name__,
            )
            if attempt < settings.db_startup_retries:
                time.sleep(settings.db_startup_retry_delay)
    logger.error("MySQL unavailable at startup; tables will be created on the first successful check")


def check_database(db: Session) -> bool:
    """Run real read-only queries against MySQL. Returns True when they succeed."""
    try:
        ensure_tables(db.get_bind())
        db.execute(text("SELECT 1")).scalar_one()
        # Also read the application table, so a missing table is reported as unhealthy.
        db.execute(text("SELECT id FROM health_records LIMIT 1")).first()
        return True
    except Exception as exc:  # any failure means the database is unhealthy
        # Log only the exception type: driver messages can include host and user names.
        logger.warning("MySQL health check failed: %s", exc.__class__.__name__)
        return False
