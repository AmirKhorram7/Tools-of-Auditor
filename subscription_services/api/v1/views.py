from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from subscription_services.api.v1.serializers import (
    ActivateSerializer,
    CheckoutSerializer,
    PlanOfferSerializer,
    SubscriptionSerializer,
    SubscriptionStatusSerializer,
)
from subscription_services.services.subscriptions import SubscriptionService

subscription_service = SubscriptionService()


class CheckoutThrottle(UserRateThrottle):
    rate = "20/hour"


@extend_schema(tags=["Subscription"])
class PlansView(APIView):
    """Base: `/api/v1/subscription/plans/`"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="List Pro plans and prices",
        description=(
            "Prices live on the server and are in **Rial**.\n\n"
            "- `monthly`: 2,000,000 Rial (200,000 Toman), 30 days\n"
            "- `quarterly`: 6,000,000 Rial (600,000 Toman), 90 days\n"
            "- `yearly`: 24,000,000 Rial (2,400,000 Toman), 365 days"
        ),
        responses={200: PlanOfferSerializer(many=True)},
    )
    def get(self, request):
        return Response(PlanOfferSerializer(subscription_service.plans(), many=True).data)


@extend_schema(tags=["Subscription"])
class MySubscriptionView(APIView):
    """Base: `/api/v1/subscription/me/`"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="My Pro status",
        description=(
            "`is_pro` is computed on the server from active, unexpired periods. "
            "`pro_until` includes renewals stacked after the current period. "
            "`pending` is an order waiting for payment."
        ),
        responses={200: SubscriptionStatusSerializer},
    )
    def get(self, request):
        return Response(SubscriptionStatusSerializer(subscription_service.status_for(request.user)).data)


@extend_schema(tags=["Subscription"])
class CheckoutView(APIView):
    """Base: `/api/v1/subscription/checkout/`"""

    permission_classes = [IsAuthenticated]
    throttle_classes = [CheckoutThrottle]

    @extend_schema(
        summary="Start a Pro purchase",
        description=(
            "Body: `{cycle}` = `monthly` | `quarterly` | `yearly`.\n\n"
            "Creates a **pending** order with a reference code and the server price. "
            "Any older pending order is cancelled. This never grants access: the order "
            "becomes active only after payment is confirmed on the server."
        ),
        request=CheckoutSerializer,
        responses={201: SubscriptionSerializer},
    )
    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        row = subscription_service.checkout(user=request.user, cycle=serializer.validated_data["cycle"])
        return Response(SubscriptionSerializer(row).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Subscription"])
class CancelOrderView(APIView):
    """Base: `/api/v1/subscription/orders/{id}/cancel/`"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Cancel my unpaid order",
        description="Only your own `pending` order. Active periods cannot be cancelled here.",
        request=None,
        responses={200: SubscriptionSerializer},
    )
    def post(self, request, subscription_id):
        row = subscription_service.cancel_pending(user=request.user, subscription_id=subscription_id)
        return Response(SubscriptionSerializer(row).data)


@extend_schema(tags=["Subscription (staff)"])
class StaffActivateView(APIView):
    """Base: `/api/v1/subscription/staff/orders/{id}/activate/`"""

    permission_classes = [IsAdminUser]

    @extend_schema(
        summary="Activate a paid order (staff only)",
        description=(
            "Body: `{payment_ref?}` — the bank or gateway tracking code.\n\n"
            "Idempotent. The new period starts when the user's current paid access ends. "
            "The future payment-gateway callback will call the same service after verifying "
            "the payment server-to-server."
        ),
        request=ActivateSerializer,
        responses={200: SubscriptionSerializer},
    )
    def post(self, request, subscription_id):
        serializer = ActivateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        row = subscription_service.activate(
            subscription_id=subscription_id,
            actor=request.user,
            payment_ref=serializer.validated_data.get("payment_ref", ""),
        )
        return Response(SubscriptionSerializer(row).data)
