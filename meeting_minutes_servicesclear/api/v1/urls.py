from django.urls import path, include
from rest_framework.routers import DefaultRouter
from meeting_minutes_servicesclear.api.v1.views import (
    #company views
    CompanyViewSet,

    #group views
    GroupViewSet,
    InvitationViewSet,
)






router = DefaultRouter()
router.register("companies", CompanyViewSet, basename="minutes-companies")
router.register("groups", GroupViewSet, basename="minutes-groups")
router.register("invitations", InvitationViewSet, basename="minutes-invitations")



urlpatterns = [
    path("", include(router.urls)),
]
