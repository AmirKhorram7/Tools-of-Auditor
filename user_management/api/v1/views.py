from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from user_management.api.v1.serializers import (
    BuilderContactClickSerializer,
    LogoutSerializer,
    MessageResponseSerializer,
    PasswordLoginSerializer,
    ProfileSerializer,
    RefreshTokenResponseSerializer,
    RefreshTokenSerializer,
    SendOTPSerializer,
    SetPasswordSerializer,
    TicketCreateSerializer,
    TicketMessageSerializer,
    TicketSerializer,
    UserLookupSerializer,
    VerifyOTPResponseSerializer,
    VerifyOTPSerializer,
)
from user_management.models import BuilderContactClick, CustomUser, Ticket, TicketMessage, TicketStatus
from user_management.utils import OTPService


def issue_tokens(user, *, is_new_user=False):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "phone_number": user.phone_number,
        "is_new_user": is_new_user,
        "has_password": user.has_login_password(),
    }


@extend_schema(
    summary="Send OTP to user's phone number",
    tags=["Auth"],
    request=SendOTPSerializer,
    responses={200: MessageResponseSerializer},
)
class SendOTPAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data["phone_number"]
        http_status, message = OTPService.send_otp(phone)

        payload = {"message": message}
        # In development / no SMS provider, expose the code so the user can log
        # in without an SMS gateway. Never enabled in production.
        if settings.OTP_DEBUG_MODE and http_status == status.HTTP_200_OK:
            stored = cache.get(f"otp:{phone}")
            if stored is not None:
                code = stored.decode() if isinstance(stored, bytes) else str(stored)
                payload["debug_code"] = code
        return Response(payload, status=http_status)



@extend_schema(
    summary="Verify OTP and authenticate user",
    tags=["Auth"],
    request=VerifyOTPSerializer,
    responses={200: VerifyOTPResponseSerializer},
)
class VerifyOTPAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data["phone_number"]
        code = serializer.validated_data["code"]
        success, message = OTPService.verify_otp(phone, code)

        if not success:
            return Response({"message": message}, status=status.HTTP_400_BAD_REQUEST)

        user, created = CustomUser.objects.get_or_create(
            phone_number=phone,
            defaults={"is_phone_verified": True},
        )
        # get_or_create bypasses create_user, so empty password hashes must be
        # normalized. Without this, first-time users look like they already
        # have a password and the profile asks for "current password".
        if created or not user.has_login_password():
            user.ensure_unusable_password()
        if not user.is_phone_verified:
            user.is_phone_verified = True
            user.save(update_fields=["is_phone_verified"])

        from team_manage_services.services.org import attach_pending_invites

        attach_pending_invites(user)

        return Response(issue_tokens(user, is_new_user=created))


@extend_schema(
    summary="Login with phone number and password",
    tags=["Auth"],
    request=PasswordLoginSerializer,
    responses={200: VerifyOTPResponseSerializer},
)
class PasswordLoginAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        from team_manage_services.services.org import attach_pending_invites

        attach_pending_invites(user)
        return Response(issue_tokens(user, is_new_user=False))


@extend_schema(
    summary="Set or change password for the authenticated user",
    tags=["Auth"],
    request=SetPasswordSerializer,
    responses={200: MessageResponseSerializer},
)
class SetPasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Heal legacy empty hashes before validation so first-time set works.
        request.user.ensure_unusable_password()
        serializer = SetPasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password"])
        return Response({"message": _("Password saved successfully."), "has_password": True})


@extend_schema(
    summary="Refresh access token",
    tags=["Auth"],
    request=RefreshTokenSerializer,
    responses={200: RefreshTokenResponseSerializer},
)
class RefreshTokenAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = TokenRefreshSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data)
        return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)


@extend_schema(
    summary="Logout user",
    tags=["Auth"],
    request=LogoutSerializer,
    responses={200: MessageResponseSerializer},
)
class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token = RefreshToken(serializer.validated_data["refresh"])
            token.blacklist()
        except TokenError:
            return Response(
                {"message": _("Invalid or expired refresh token.")},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"message": _("Successfully logged out.")})


@extend_schema_view(
    get=extend_schema(summary="Get user profile", tags=["Profile"]),
    patch=extend_schema(summary="Update user profile", tags=["Profile"]),
    put=extend_schema(summary="Replace user profile", tags=["Profile"]),
)
class ProfileView(RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # Heal empty password hashes from first OTP signup so the profile UI
        # does not ask for a current password that was never set.
        self.request.user.ensure_unusable_password()
        return self.request.user.profile


@extend_schema(
    summary="Lookup registered users by phone prefix for invite UI",
    tags=["Users"],
    responses={200: UserLookupSerializer(many=True)},
)
class UserLookupAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        raw = (request.query_params.get("phone") or "").strip()
        digits = "".join(ch for ch in raw if ch.isdigit())
        if len(digits) < 4:
            return Response([])

        users = (
            CustomUser.objects.filter(phone_number__startswith=digits, is_active=True)
            .select_related("profile")
            .order_by("phone_number")[:5]
        )
        payload = []
        for user in users:
            image = None
            profile = getattr(user, "profile", None)
            if profile and profile.profile_image:
                try:
                    image = profile.profile_image.url
                except (AttributeError, ValueError):
                    image = None
            payload.append(
                {
                    "id": user.id,
                    "phone_number": user.phone_number,
                    "first_name": user.first_name or "",
                    "last_name": user.last_name or "",
                    "profile_image": image,
                }
            )
        return Response(UserLookupSerializer(payload, many=True).data)


@extend_schema(tags=["Tickets"])
class TicketViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return (
            Ticket.objects.filter(user=self.request.user)
            .prefetch_related("messages")
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        if self.action == "create":
            return TicketCreateSerializer
        return TicketSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        return Response(
            TicketSerializer(ticket, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def send_message(self, request, pk=None):
        ticket = self.get_object()
        if ticket.status == TicketStatus.CLOSED:
            return Response(
                {"detail": _("Ticket is closed.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TicketMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            message=serializer.validated_data["message"],
            is_admin_message=False,
        )
        if ticket.status == TicketStatus.WAITING_FOR_USER:
            ticket.status = TicketStatus.IN_PROGRESS
            ticket.save(update_fields=["status", "updated_at"])
        else:
            ticket.save(update_fields=["updated_at"])
        ticket.refresh_from_db()
        return Response(
            TicketSerializer(ticket, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        ticket = self.get_object()
        ticket.status = TicketStatus.CLOSED
        ticket.closed_at = timezone.now()
        ticket.save(update_fields=["status", "closed_at", "updated_at"])
        return Response({"detail": "Ticket closed."})


@extend_schema(
    summary="Record a footer click on LinkedIn or Telegram (contact the builder)",
    tags=["Builder contact"],
    request=BuilderContactClickSerializer,
    responses={201: MessageResponseSerializer},
)
class BuilderContactClickAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = BuilderContactClickSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user if request.user.is_authenticated else None
        BuilderContactClick.objects.create(
            user=user,
            channel=serializer.validated_data["channel"],
            page=(serializer.validated_data.get("page") or "")[:255],
        )
        return Response({"message": "ok"}, status=status.HTTP_201_CREATED)
