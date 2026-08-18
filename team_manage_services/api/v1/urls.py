from django.urls import include, path
from rest_framework.routers import DefaultRouter

from team_manage_services.api.v1.views import (
    CommentAttachmentViewSet,
    CompanyViewSet,
    InvitationViewSet,
    NotificationViewSet,
    ProjectViewSet,
    TaskViewSet,
    TeamViewSet,
    WorkDashboardView,
    WorkTimelineView,
)

router = DefaultRouter()
router.register("companies", CompanyViewSet, basename="work-companies")
router.register("teams", TeamViewSet, basename="work-teams")
router.register("invitations", InvitationViewSet, basename="work-invitations")
router.register("projects", ProjectViewSet, basename="work-projects")
router.register("tasks", TaskViewSet, basename="work-tasks")
router.register("comments", CommentAttachmentViewSet, basename="work-comments")
router.register("notifications", NotificationViewSet, basename="work-notifications")

urlpatterns = [
    path("dashboard/", WorkDashboardView.as_view(), name="work-dashboard"),
    path("dashboard/timeline/", WorkTimelineView.as_view(), name="work-timeline"),
    path("", include(router.urls)),
]
