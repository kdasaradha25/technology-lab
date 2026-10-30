from django.urls import path

from . import views

urlpatterns = [
    path("health", views.health, name="health"),
    path("health/app", views.health_app, name="health-app"),
    path("health/db", views.health_db, name="health-db"),
]
