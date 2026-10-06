from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _


class Subscription(models.Model):
    """One purchase of Pro for one billing cycle.

    Created as `pending` when the user picks a plan. Only the server turns it
    `active` (admin today, payment-gateway callback later). The browser never
    can. Price and length are copied from the server catalogue at checkout.
    """

    class Cycle(models.TextChoices):
        MONTHLY = "monthly", _("Monthly")
        QUARTERLY = "quarterly", _("Quarterly")
        YEARLY = "yearly", _("Yearly")

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending payment")
        ACTIVE = "active", _("Active")
        CANCELLED = "cancelled", _("Cancelled")

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )
    cycle = models.CharField(max_length=10, choices=Cycle.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    price_rial = models.PositiveBigIntegerField(help_text=_("Snapshot of the price at checkout, in Rial."))
    days = models.PositiveSmallIntegerField(help_text=_("Length of access this purchase grants."))
    reference = models.CharField(max_length=16, unique=True, help_text=_("Shown to the user and on the payment."))
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    activated_at = models.DateTimeField(null=True, blank=True)
    activated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    payment_ref = models.CharField(
        max_length=120,
        blank=True,
        default="",
        help_text=_("Bank / gateway tracking code entered on activation."),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "status", "ends_at"], name="sub_user_status_end")]
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=Q(status="pending"),
                name="sub_one_pending_per_user",
            ),
        ]

    def __str__(self):
        return f"{self.reference} · {self.user_id} · {self.cycle} · {self.status}"
