import re

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from user_management.models import CustomUser, Profile, Ticket, TicketMessage


PHONE_RE = re.compile(r"09\d{9}")


def validate_iran_phone(value):
    if not PHONE_RE.fullmatch(value):
        raise serializers.ValidationError(_("Invalid phone number"))
    return value


class RelativeImageField(serializers.ImageField):
    """
    Return storage-relative URLs (/media/...) instead of absolute host URLs.

    Behind Docker/nginx the browser must load media from the public origin,
    not from an internal backend host/port that DRF would bake into absolute URIs.
    """

    def to_representation(self, value):
        if not value:
            return None
        try:
            return value.url
        except (AttributeError, ValueError):
            return None


class SendOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=11)

    def validate_phone_number(self, value):
        return validate_iran_phone(value)


class VerifyOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=11)
    code = serializers.CharField(max_length=6)

    def validate_phone_number(self, value):
        return validate_iran_phone(value)


class VerifyOTPResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    is_new_user = serializers.BooleanField()
    phone_number = serializers.CharField()
    has_password = serializers.BooleanField()


class PasswordLoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=11)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_phone_number(self, value):
        return validate_iran_phone(value)

    def validate(self, attrs):
        phone = attrs["phone_number"]
        password = attrs["password"]
        try:
            user = CustomUser.objects.get(phone_number=phone)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError(
                {"password": _("Invalid phone number or password.")}
            )

        if not user.has_login_password() or not user.check_password(password):
            raise serializers.ValidationError(
                {"password": _("Invalid phone number or password.")}
            )
        if not user.is_active:
            raise serializers.ValidationError(_("This account is disabled."))

        attrs["user"] = user
        return attrs


class SetPasswordSerializer(serializers.Serializer):
    """
    First-time set: password + confirm_password.
    Change: current_password + password + confirm_password.
    """

    current_password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = self.context["request"].user
        # Heal empty / ""-hashed passwords before deciding first-time vs change.
        user.ensure_unusable_password()
        user.refresh_from_db(fields=["password"])

        password = attrs["password"]
        confirm = attrs["confirm_password"]
        current = attrs.get("current_password") or ""

        if password != confirm:
            raise serializers.ValidationError(
                {"confirm_password": _("Password confirmation does not match.")}
            )

        # First-time OTP users have no real password — do not require current.
        if user.has_login_password():
            if not current or not user.check_password(current):
                raise serializers.ValidationError(
                    {"current_password": _("Current password is incorrect.")}
                )
            if user.check_password(password):
                raise serializers.ValidationError(
                    {"password": _("New password must be different from the current one.")}
                )

        try:
            validate_password(password, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})

        return attrs


class RefreshTokenSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class RefreshTokenResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField(required=False)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class MessageResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    debug_code = serializers.CharField(required=False)


class ProfileSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=False, allow_blank=True)
    last_name = serializers.CharField(source="user.last_name", required=False, allow_blank=True)
    has_password = serializers.SerializerMethodField()
    profile_image = RelativeImageField(required=False, allow_null=True)

    class Meta:
        model = Profile
        fields = [
            "phone_number",
            "first_name",
            "last_name",
            "bio",
            "profile_image",
            "birth_date",
            "company_name",
            "job_title",
            "has_password",
        ]
        read_only_fields = ["has_password"]

    def get_has_password(self, obj):
        return obj.user.has_login_password()

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        user = instance.user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class TicketMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.get_full_name", read_only=True)

    class Meta:
        model = TicketMessage
        fields = [
            "id",
            "sender",
            "sender_name",
            "message",
            "is_admin_message",
            "created_at",
        ]
        read_only_fields = ["sender", "is_admin_message", "created_at"]


class TicketCreateSerializer(serializers.ModelSerializer):
    message = serializers.CharField(write_only=True)

    class Meta:
        model = Ticket
        fields = ("subject", "priority", "message")

    def create(self, validated_data):
        message = validated_data.pop("message")
        user = self.context["request"].user
        ticket = Ticket.objects.create(user=user, **validated_data)
        TicketMessage.objects.create(
            ticket=ticket,
            sender=user,
            message=message,
            is_admin_message=False,
        )
        return ticket


class TicketSerializer(serializers.ModelSerializer):
    messages = TicketMessageSerializer(many=True, read_only=True)

    class Meta:
        model = Ticket
        fields = [
            "id",
            "subject",
            "status",
            "priority",
            "created_at",
            "updated_at",
            "messages",
        ]
        read_only_fields = ["status", "created_at", "updated_at"]
