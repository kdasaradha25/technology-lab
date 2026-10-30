from unittest import mock

from django.db import OperationalError
from django.test import TestCase

from .models import HealthRecord


class HealthRecordModelTests(TestCase):
    def test_write_and_read_record(self):
        record = HealthRecord.objects.create()
        fetched = HealthRecord.objects.get(pk=record.pk)
        self.assertIsNotNone(fetched.created_at)
        self.assertEqual(HealthRecord.objects.count(), 1)


class HealthEndpointTests(TestCase):
    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "healthy", "service": "django-postgres-api"})

    def test_health_db_healthy(self):
        response = self.client.get("/health/db")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "healthy", "database": "postgresql", "message": "Database connection successful"},
        )

    def test_health_app_healthy(self):
        response = self.client.get("/health/app")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")
        self.assertEqual(response.json()["database"], {"status": "healthy", "type": "postgresql"})

    def test_health_checks_do_not_create_records(self):
        self.client.get("/health/db")
        self.client.get("/health/app")
        self.assertEqual(HealthRecord.objects.count(), 0)

    @mock.patch("health.views.connection.cursor", side_effect=OperationalError("down"))
    def test_database_unavailable(self, _cursor):
        db = self.client.get("/health/db")
        self.assertEqual(db.status_code, 503)
        self.assertEqual(
            db.json(),
            {"status": "unhealthy", "database": "postgresql", "message": "Database connection failed"},
        )

        app = self.client.get("/health/app")
        self.assertEqual(app.status_code, 503)
        self.assertEqual(app.json()["status"], "unhealthy")
        self.assertEqual(app.json()["database"]["status"], "unhealthy")

        # /health must stay healthy while the database is down.
        self.assertEqual(self.client.get("/health").status_code, 200)

    def test_cors_header_for_frontend_origin(self):
        response = self.client.get("/health", HTTP_ORIGIN="http://localhost:5173")
        self.assertEqual(response["Access-Control-Allow-Origin"], "http://localhost:5173")
