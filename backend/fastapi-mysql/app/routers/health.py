from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..database import check_database, get_db

router = APIRouter(tags=["health"])

DATABASE_TYPE = "mysql"


@router.get("/health")
def health():
    return {"status": "healthy", "service": settings.service_name}


@router.get("/health/app")
def health_app(db: Session = Depends(get_db)):
    db_ok = check_database(db)
    db_status = "healthy" if db_ok else "unhealthy"
    return JSONResponse(
        status_code=status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": db_status,
            "service": settings.service_name,
            "database": {"status": db_status, "type": DATABASE_TYPE},
        },
    )


@router.get("/health/db")
def health_db(db: Session = Depends(get_db)):
    if check_database(db):
        return {
            "status": "healthy",
            "database": DATABASE_TYPE,
            "message": "Database connection successful",
        }
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "unhealthy",
            "database": DATABASE_TYPE,
            "message": "Database connection failed",
        },
    )
