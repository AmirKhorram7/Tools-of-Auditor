from django.urls import include, path
from rest_framework.routers import DefaultRouter

from user_management.api.v1.views import (
    LogoutAPIView,
    PasswordLoginAPIView,
    ProfileView,
    RefreshTokenAPIView,
    SendOTPAPIView,
    SetPasswordAPIView,
    TicketViewSet,
    VerifyOTPAPIView,
)

router = DefaultRouter()
router.register("tickets", TicketViewSet, basename="tickets")

urlpatterns = [
    path("auth/send-otp/", SendOTPAPIView.as_view(), name="send-otp"),
    path("auth/verify-otp/", VerifyOTPAPIView.as_view(), name="verify-otp"),
    path("auth/login/", PasswordLoginAPIView.as_view(), name="password-login"),
    path("auth/set-password/", SetPasswordAPIView.as_view(), name="set-password"),
    path("auth/refresh/", RefreshTokenAPIView.as_view(), name="refresh-token"),
    path("auth/logout/", LogoutAPIView.as_view(), name="logout"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("", include(router.urls)),
]
