from django.urls import path, include
from rest_framework.routers import DefaultRouter
from meeting_minutes_servicesclear.api.v1.views import CompanyViewSet





router = DefaultRouter()
router.register(r"companies", CompanyViewSet, basename="minutes-companies")

urlpatterns = [
    path("", include(router.urls)),
]
