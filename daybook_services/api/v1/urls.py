from django.urls import include, path
from rest_framework.routers import DefaultRouter

from daybook_services.api.v1.views import (
    AgendaView,
    DaybookSettingsView,
    DayNoteViewSet,
    PlanViewSet,
)

router = DefaultRouter()
router.register("notes", DayNoteViewSet, basename="daybook-notes")
router.register("plans", PlanViewSet, basename="daybook-plans")

urlpatterns = [
    path("settings/", DaybookSettingsView.as_view(), name="daybook-settings"),
    path("agenda/", AgendaView.as_view(), name="daybook-agenda"),
    path("", include(router.urls)),
]
