from django.urls import include, path
from rest_framework.routers import DefaultRouter

from meeting_minutes_servicesclear.api.v1.views import (
    CompanyViewSet,
    GroupViewSet,
    InvitationViewSet,
    MeetingViewSet,
)

router = DefaultRouter()
router.register("companies", CompanyViewSet, basename="minutes-companies")
router.register("groups", GroupViewSet, basename="minutes-groups")
router.register("invitations", InvitationViewSet, basename="minutes-invitations")
router.register("meetings", MeetingViewSet, basename="minutes-meetings")

urlpatterns = [
    path("", include(router.urls)),
]
