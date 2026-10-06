from django.urls import include, path
from rest_framework.routers import SimpleRouter

from reminder_services.api.v1.views import ChannelsView, ContactView, GroupViewSet, ReminderViewSet

router = SimpleRouter()
router.register("groups", GroupViewSet, basename="reminder-groups")
router.register("items", ReminderViewSet, basename="reminder-items")

urlpatterns = [
    path("channels/", ChannelsView.as_view(), name="reminder-channels"),
    path("contact/", ContactView.as_view(), name="reminder-contact"),
    path("", include(router.urls)),
]
