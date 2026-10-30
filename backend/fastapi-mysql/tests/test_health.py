"""Integration tests. They need the MySQL container running (docker compose up -d db)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import SessionLocal, get_db
from app.main import app
from app.models import HealthRecord


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def count_records() -> int:
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(HealthRecord))


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "fastapi-mysql-api"}


def test_health_db_healthy(client):
    response = client.get("/health/db")
    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "database": "mysql",
        "message": "Database connection successful",
    }


def test_health_app_healthy(client):
    response = client.get("/health/app")
    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "fastapi-mysql-api",
        "database": {"status": "healthy", "type": "mysql"},
    }


def test_health_checks_do_not_create_records(client):
    before = count_records()
    client.get("/health/db")
    client.get("/health/app")
    assert count_records() == before


def test_health_record_crud(client):
    # Create
    with SessionLocal() as db:
        record = HealthRecord()
        db.add(record)
        db.commit()
        record_id = record.id
    assert record_id is not None

    # Read
    with SessionLocal() as db:
        fetched = db.get(HealthRecord, record_id)
        assert fetched is not None
        assert fetched.created_at is not None

        # Delete, so the test leaves no data behind
        db.delete(fetched)
        db.commit()

    with SessionLocal() as db:
        assert db.get(HealthRecord, record_id) is None


def test_database_unavailable(client):
    # Point the session at a port where nothing is listening.
    dead_engine = create_engine(
        settings.database_url.set(port=1),
        connect_args={"connect_timeout": 1},
    )
    DeadSession = sessionmaker(bind=dead_engine)

    def broken_db():
        db = DeadSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = broken_db

    db_response = client.get("/health/db")
    assert db_response.status_code == 503
    assert db_response.json() == {
        "status": "unhealthy",
        "database": "mysql",
        "message": "Database connection failed",
    }

    app_response = client.get("/health/app")
    assert app_response.status_code == 503
    assert app_response.json()["status"] == "unhealthy"
    assert app_response.json()["database"] == {"status": "unhealthy", "type": "mysql"}

    # /health must stay healthy while the database is down.
    assert client.get("/health").status_code == 200


def test_cors_header_for_frontend_origin(client):
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
