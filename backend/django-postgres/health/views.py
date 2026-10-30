import logging

from django.conf import settings
from django.db import connection
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import HealthRecord

logger = logging.getLogger(__name__)

DATABASE_TYPE = "postgresql"


def check_database():
    """Run real read-only queries against PostgreSQL. Returns True when they succeed."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        # Also touch the application table, so a missing migration is reported as unhealthy.
        HealthRecord.objects.exists()
        return True
    except Exception as exc:  # any failure means the database is unhealthy
        # Log only the exception type: driver messages can include host and user names.
        logger.warning("PostgreSQL health check failed: %s", exc.__class__.__name__)
        return False


@api_view(["GET"])
def health(request):
    return Response({"status": "healthy", "service": settings.SERVICE_NAME})


@api_view(["GET"])
def health_app(request):
    db_ok = check_database()
    db_status = "healthy" if db_ok else "unhealthy"
    return Response(
        {
            "status": db_status,
            "service": settings.SERVICE_NAME,
            "database": {"status": db_status, "type": DATABASE_TYPE},
        },
        status=status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
    )


@api_view(["GET"])
def health_db(request):
    if check_database():
        return Response(
            {
                "status": "healthy",
                "database": DATABASE_TYPE,
                "message": "Database connection successful",
            }
        )
    return Response(
        {
            "status": "unhealthy",
            "database": DATABASE_TYPE,
            "message": "Database connection failed",
        },
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )
