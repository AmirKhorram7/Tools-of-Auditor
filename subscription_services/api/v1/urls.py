from django.urls import path

from subscription_services.api.v1.views import (
    CancelOrderView,
    CheckoutView,
    MySubscriptionView,
    PlansView,
    StaffActivateView,
)

urlpatterns = [
    path("plans/", PlansView.as_view(), name="subscription-plans"),
    path("me/", MySubscriptionView.as_view(), name="subscription-me"),
    path("checkout/", CheckoutView.as_view(), name="subscription-checkout"),
    path("orders/<int:subscription_id>/cancel/", CancelOrderView.as_view(), name="subscription-cancel"),
    path(
        "staff/orders/<int:subscription_id>/activate/",
        StaffActivateView.as_view(),
        name="subscription-staff-activate",
    ),
]
