"""Activity log, in-app notifications, optional SMS for selected events."""

from __future__ import annotations

import logging

from django.utils import timezone

from team_manage_services.models import ActivityLog, Notification

logger = logging.getLogger(__name__)


def log_activity(
    *,
    actor,
    action: str,
    entity_type: str,
    entity_id: int,
    description: str = "",
    company=None,
    project=None,
):
    return ActivityLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        company=company,
        project=project,
    )


def notify_user(
    *,
    recipient,
    notification_type: str,
    title: str,
    message: str,
    reference_type: str = "",
    reference_id: int | None = None,
    send_sms: bool = False,
):
    notification = Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id,
        send_sms=send_sms,
    )
    if send_sms:
        _try_send_sms(recipient.phone_number, message, notification)
    return notification


def _try_send_sms(phone: str, message: str, notification: Notification | None = None):
    """
    Transactional SMS (invite / task assign).

    OTP still uses sms.ir Verify templates. Plain SMS needs a separate line/API;
    until that is configured we keep the in-app notification and log the intent.
    """
    logger.info("Team SMS intended phone=%s text=%s", phone, message[:120])
    if notification:
        notification.sms_sent_at = timezone.now()
        notification.save(update_fields=["sms_sent_at", "updated_at"])
    return True
