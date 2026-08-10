from django.urls import include, path
from rest_framework.routers import DefaultRouter

from system_explanation_services.api.v1.views import (
    ProcessStepViewSet,
    ProcessViewSet,
    ProjectViewSet,
    StepConnectionViewSet,
    StepControlViewSet,
    StepMediaViewSet,
    StepRiskViewSet,
)

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="projects")
router.register("processes", ProcessViewSet, basename="processes")
router.register("steps", ProcessStepViewSet, basename="steps")
router.register("connections", StepConnectionViewSet, basename="connections")
router.register("risks", StepRiskViewSet, basename="risks")
router.register("controls", StepControlViewSet, basename="controls")
router.register("media", StepMediaViewSet, basename="step-media")

urlpatterns = [
    path("", include(router.urls)),
]
