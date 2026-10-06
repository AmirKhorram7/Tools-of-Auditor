import secrets
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError

from subscription_services.models import Subscription

# Server-side price list. The client only sends the cycle key.
CATALOG = {
    Subscription.Cycle.MONTHLY: {"price_rial": 2_000_000, "days": 30, "months": 1},
    Subscription.Cycle.QUARTERLY: {"price_rial": 6_000_000, "days": 90, "months": 3},
    Subscription.Cycle.YEARLY: {"price_rial": 24_000_000, "days": 365, "months": 12},
}

_REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class ProRequired(APIException):
    """402 with a code the UI turns into the upgrade pop-up."""

    status_code = 402
    default_detail = "This feature needs a Pro subscription."
    default_code = "pro_required"


def _new_reference() -> str:
    return "TA-" + "".join(secrets.choice(_REF_ALPHABET) for _ in range(8))


class SubscriptionService:
    def plans(self) -> list[dict]:
        return [
            {"cycle": cycle, "price_rial": row["price_rial"], "days": row["days"], "months": row["months"]}
            for cycle, row in CATALOG.items()
        ]

    def _active_qs(self, user, now=None):
        now = now or timezone.now()
        return Subscription.objects.filter(
            user=user,
            status=Subscription.Status.ACTIVE,
            starts_at__lte=now,
            ends_at__gt=now,
        )

    def is_pro(self, user) -> bool:
        if not user or not user.is_authenticated:
            return False
        return self._active_qs(user).exists()

    def require_pro(self, user) -> None:
        if not self.is_pro(user):
            raise ProRequired()

    def pro_until(self, user):
        """Last day of paid access, counting stacked future periods."""
        return (
            Subscription.objects.filter(
                user=user,
                status=Subscription.Status.ACTIVE,
                ends_at__gt=timezone.now(),
            )
            .aggregate(end=Max("ends_at"))
            .get("end")
        )

    def status_for(self, user) -> dict:
        history = list(Subscription.objects.filter(user=user)[:20])
        current = self._active_qs(user).order_by("-ends_at").first()
        return {
            "is_pro": current is not None,
            "pro_until": self.pro_until(user),
            "current": current,
            "pending": next((row for row in history if row.status == Subscription.Status.PENDING), None),
            "history": history,
        }

    @transaction.atomic
    def checkout(self, *, user, cycle: str) -> Subscription:
        """Start a purchase. Replaces any older pending order with the new choice."""
        offer = CATALOG.get(cycle)
        if offer is None:
            raise ValidationError({"cycle": "Choose monthly, quarterly or yearly."})
        Subscription.objects.select_for_update().filter(
            user=user, status=Subscription.Status.PENDING
        ).update(status=Subscription.Status.CANCELLED)
        for _ in range(5):
            try:
                with transaction.atomic():
                    return Subscription.objects.create(
                        user=user,
                        cycle=cycle,
                        price_rial=offer["price_rial"],
                        days=offer["days"],
                        reference=_new_reference(),
                    )
            except IntegrityError:
                continue
        raise ValidationError({"detail": "Could not create the order. Try again."})

    @transaction.atomic
    def cancel_pending(self, *, user, subscription_id) -> Subscription:
        row = (
            Subscription.objects.select_for_update()
            .filter(pk=subscription_id, user=user)
            .first()
        )
        if row is None:
            raise NotFound("Order not found.")
        if row.status != Subscription.Status.PENDING:
            raise ValidationError({"status": "Only an unpaid order can be cancelled."})
        row.status = Subscription.Status.CANCELLED
        row.save(update_fields=["status", "updated_at"])
        return row

    def grant(self, *, user, cycle: str, actor, payment_ref: str = "") -> Subscription:
        """Staff gives a user a paid cycle. Prices still come from CATALOG."""
        if actor is None or not actor.is_staff:
            raise PermissionDenied("Only staff can grant a subscription.")
        row = self.checkout(user=user, cycle=cycle)
        return self.activate(subscription_id=row.pk, actor=actor, payment_ref=payment_ref)

    @transaction.atomic
    def activate(self, *, subscription_id, actor, payment_ref: str = "") -> Subscription:
        """Turn a paid order on. Staff today; a verified gateway callback later.

        Idempotent: activating twice changes nothing. A new period starts when
        the user's current paid access ends, so renewing early loses no days.
        """
        if actor is not None and not actor.is_staff:
            raise PermissionDenied("Only staff can activate a subscription.")
        row = Subscription.objects.select_for_update().filter(pk=subscription_id).first()
        if row is None:
            raise NotFound("Order not found.")
        if row.status == Subscription.Status.ACTIVE:
            return row
        if row.status != Subscription.Status.PENDING:
            raise ValidationError({"status": "Cancelled orders cannot be activated."})
        now = timezone.now()
        current_end = (
            Subscription.objects.select_for_update()
            .filter(user=row.user, status=Subscription.Status.ACTIVE, ends_at__gt=now)
            .aggregate(end=Max("ends_at"))
            .get("end")
        )
        row.starts_at = max(now, current_end) if current_end else now
        row.ends_at = row.starts_at + timedelta(days=row.days)
        row.status = Subscription.Status.ACTIVE
        row.activated_at = now
        row.activated_by = actor
        row.payment_ref = (payment_ref or "")[:120]
        row.save()
        return row
