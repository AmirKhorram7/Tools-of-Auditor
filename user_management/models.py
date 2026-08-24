from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _


class CustomUserManager(BaseUserManager):
    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
            raise ValueError(_("The phone number must be set"))
        user = self.model(phone_number=phone_number, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("Superuser must have is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("Superuser must have is_superuser=True."))
        if not password:
            raise ValueError(_("Superuser must have a password."))

        return self.create_user(phone_number, password, **extra_fields)


class CustomUser(AbstractUser):
    username = None

    phone_number = models.CharField(_("Phone number"), max_length=15, unique=True)
    is_phone_verified = models.BooleanField(_("Phone verified"), default=False)

    objects = CustomUserManager()
    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = _("User")
        verbose_name_plural = _("Users")

    def __str__(self):
        return self.phone_number

    def has_login_password(self) -> bool:
        """
        True only when the user has deliberately set a real password.

        Django treats an empty password hash as "usable", and some legacy rows
        even store a hash of "". Those must count as "no password yet" so the
        profile does not ask for a current password on first set.
        """
        password = self.password or ""
        if not password or not self.has_usable_password():
            return False
        # Reject accidental hash of an empty string.
        if self.check_password(""):
            return False
        return True

    def ensure_unusable_password(self) -> bool:
        """Normalize empty/legacy hashes so first-time set-password works."""
        password = self.password or ""
        already_unusable = bool(password) and not self.has_usable_password()
        if already_unusable:
            return False
        if self.has_login_password():
            return False
        self.set_unusable_password()
        self.save(update_fields=["password"])
        return True


class Profile(models.Model):
    """Optional profile completed after phone OTP sign-in."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
        verbose_name=_("User"),
    )
    bio = models.TextField(_("Bio"), blank=True, default="")
    profile_image = models.ImageField(
        _("Profile image"),
        upload_to="profiles/",
        blank=True,
        null=True,
    )
    birth_date = models.DateField(_("Birth date"), blank=True, null=True)
    company_name = models.CharField(_("Company name"), max_length=255, blank=True, default="")
    job_title = models.CharField(_("Job title"), max_length=255, blank=True, default="")
    created_at = models.DateTimeField(_("Created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Updated at"), auto_now=True)

    class Meta:
        verbose_name = _("Profile")
        verbose_name_plural = _("Profiles")

    def __str__(self):
        return self.user.get_full_name() or self.user.phone_number


class TicketStatus(models.TextChoices):
    OPEN = "OPEN", _("Open")
    IN_PROGRESS = "IN_PROGRESS", _("In Progress")
    WAITING_FOR_USER = "WAITING_FOR_USER", _("Waiting for User")
    CLOSED = "CLOSED", _("Closed")


class TicketPriority(models.TextChoices):
    LOW = "LOW", _("Low")
    MEDIUM = "MEDIUM", _("Medium")
    HIGH = "HIGH", _("High")
    URGENT = "URGENT", _("Urgent")


class Ticket(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tickets",
    )
    subject = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20,
        choices=TicketStatus.choices,
        default=TicketStatus.OPEN,
    )
    priority = models.CharField(
        max_length=20,
        choices=TicketPriority.choices,
        default=TicketPriority.MEDIUM,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.phone_number} - {self.subject}"


class TicketMessage(models.Model):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ticket_messages",
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    is_admin_message = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]


class BuilderContactClick(models.Model):
    """Footer LinkedIn / Telegram click — contact the product builder."""

    class Channel(models.TextChoices):
        LINKEDIN = "linkedin", "LinkedIn"
        TELEGRAM = "telegram", "Telegram"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="builder_contact_clicks",
    )
    channel = models.CharField(max_length=16, choices=Channel.choices)
    page = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("Builder contact click")
        verbose_name_plural = _("Builder contact clicks")
        indexes = [
            models.Index(fields=["channel", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        who = self.user.phone_number if self.user_id else "guest"
        return f"{who} → {self.channel}"
