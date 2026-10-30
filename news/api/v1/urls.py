from django.urls import include, path
from rest_framework.routers import DefaultRouter

from news.api.v1.views import (
    ArticleViewSet,
    FetchJobViewSet,
    NewsAccessView,
    NewsFreshnessView,
    NewsPanelView,
    NewsSettingsView,
    NewsSourceViewSet,
    NewsWarehouseSyncView,
    NewsWarehouseView,
)

router = DefaultRouter()
router.register("sources", NewsSourceViewSet, basename="news-sources")
router.register("articles", ArticleViewSet, basename="news-articles")
router.register("jobs", FetchJobViewSet, basename="news-jobs")

urlpatterns = [
    path("access/", NewsAccessView.as_view(), name="news-access"),
    path("settings/", NewsSettingsView.as_view(), name="news-settings"),
    path("panel/", NewsPanelView.as_view(), name="news-panel"),
    path("freshness/", NewsFreshnessView.as_view(), name="news-freshness"),
    path("warehouse/sync/", NewsWarehouseSyncView.as_view(), name="news-warehouse-sync"),
    path("warehouse/", NewsWarehouseView.as_view(), name="news-warehouse"),
    path("", include(router.urls)),
]
