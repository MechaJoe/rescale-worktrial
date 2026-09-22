from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("jobs", views.JobViewSet, basename="job")

urlpatterns = [
    path("health/", views.health, name="health"),
    path("", include(router.urls)),
]
