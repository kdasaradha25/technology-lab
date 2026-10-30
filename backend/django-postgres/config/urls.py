from django.urls import include, path

urlpatterns = [
    path("", include("health.urls")),
]
