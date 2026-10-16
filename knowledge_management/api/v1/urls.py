from django.urls import include, path
from rest_framework.routers import DefaultRouter

from knowledge_management.api.v1.views import (
    AttachmentView,
    DailyNoteView,
    InkViewSet,
    NodeViewSet,
    PlanDayView,
    PlanViewSet,
    ReviewViewSet,
    SearchView,
    TemplateViewSet,
    TitleSearchView,
    TodayView,
    TreeView,
)

router = DefaultRouter()
router.register("nodes", NodeViewSet, basename="knowledge-nodes")
router.register("plans", PlanViewSet, basename="knowledge-plans")
router.register("templates", TemplateViewSet, basename="knowledge-templates")
router.register("reviews", ReviewViewSet, basename="knowledge-reviews")
router.register("ink", InkViewSet, basename="knowledge-ink")

urlpatterns = [
    path("tree/", TreeView.as_view(), name="knowledge-tree"),
    path("search/", SearchView.as_view(), name="knowledge-search"),
    path("search/titles/", TitleSearchView.as_view(), name="knowledge-search-titles"),
    path("today/", TodayView.as_view(), name="knowledge-today"),
    path("daily/", DailyNoteView.as_view(), name="knowledge-daily"),
    path("plan-days/<int:pk>/", PlanDayView.as_view(), name="knowledge-plan-day"),
    path("attachments/", AttachmentView.as_view(), name="knowledge-attachments"),
    path("", include(router.urls)),
]
