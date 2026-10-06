from datetime import datetime, time, timedelta

from django.db import IntegrityError, connection, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from reminder_services import targets
from reminder_services.models import Channel, Mode, Reminder, ReminderContact, ReminderGroup
from reminder_services.services import channels as delivery
from subscription_services.services.subscriptions import SubscriptionService

MAX_GROUPS = 20
MAX_PER_TARGET = 5
MAX_SCHEDULED = 300
MAX_OFFSET_DAYS = 60
MAX_ATTEMPTS = 3
RETRY_AFTER = timedelta(minutes=5)
DEFAULT_TIME = time(9, 0)

subscription_service = SubscriptionService()


def _clean_channels(raw) -> list[str]:
    allowed = set(Channel.values)
    picked = [str(c) for c in (raw or [])]
    if not picked or any(c not in allowed for c in picked):
        raise ValidationError({"channels": "Pick at least one of email, telegram, whatsapp, sms."})
    return [c for c in Channel.values if c in picked]


def _clean_spec(data: dict) -> dict:
    mode = data.get("mode") or Mode.BEFORE
    if mode not in Mode.values:
        raise ValidationError({"mode": "Use `before` or `at`."})
    spec = {"channels": _clean_channels(data.get("channels")), "mode": mode}
    if mode == Mode.BEFORE:
        offset = data.get("offset_days", 1)
        if offset is None or not 0 <= int(offset) <= MAX_OFFSET_DAYS:
            raise ValidationError({"offset_days": f"Between 0 and {MAX_OFFSET_DAYS} days."})
        spec.update(offset_days=int(offset), at_time=data.get("at_time") or DEFAULT_TIME, fixed_at=None)
    else:
        fixed = data.get("fixed_at")
        if not fixed:
            raise ValidationError({"fixed_at": "Choose the date and time to send."})
        spec.update(fixed_at=fixed, offset_days=0, at_time=None)
    return spec


def compute_send_at(spec, due) -> datetime:
    mode = spec["mode"] if isinstance(spec, dict) else spec.mode
    get = spec.get if isinstance(spec, dict) else lambda k: getattr(spec, k)
    if mode == Mode.AT:
        return get("fixed_at")
    if due is None:
        raise ValidationError({"mode": "This item has no due date. Use an exact date and time."})
    day = due - timedelta(days=get("offset_days") or 0)
    return timezone.make_aware(datetime.combine(day, get("at_time") or DEFAULT_TIME))


class ReminderService:
    # ---- channels & contact ----

    def channel_status(self, user) -> list[dict]:
        ready = delivery.configured()
        contact = self.contact_for(user)
        address = {
            Channel.EMAIL: contact.email or user.email,
            Channel.TELEGRAM: contact.telegram_chat_id,
            Channel.WHATSAPP: contact.whatsapp_number or user.phone_number,
            Channel.SMS: user.phone_number,
        }
        return [
            {"channel": c, "available": ready[c], "has_address": bool(address[c])}
            for c in Channel.values
        ]

    def contact_for(self, user) -> ReminderContact:
        contact, _ = ReminderContact.objects.get_or_create(user=user)
        return contact

    def update_contact(self, user, **fields) -> ReminderContact:
        contact = self.contact_for(user)
        for key in ("email", "telegram_chat_id", "whatsapp_number"):
            if key in fields:
                setattr(contact, key, (fields[key] or "").strip())
        contact.save()
        return contact

    # ---- groups ----

    def groups_for(self, user):
        return ReminderGroup.objects.filter(owner=user)

    def get_group(self, user, group_id) -> ReminderGroup:
        group = ReminderGroup.objects.filter(owner=user, pk=group_id).first()
        if group is None:
            raise NotFound("Group not found.")
        return group

    def create_group(self, *, user, name, **data) -> ReminderGroup:
        subscription_service.require_pro(user)
        name = (name or "").strip()
        if not name:
            raise ValidationError({"name": "Name the group."})
        if ReminderGroup.objects.filter(owner=user).count() >= MAX_GROUPS:
            raise ValidationError({"name": f"At most {MAX_GROUPS} groups."})
        try:
            return ReminderGroup.objects.create(owner=user, name=name[:80], **_clean_spec(data))
        except IntegrityError as exc:
            raise ValidationError({"name": "You already have a group with this name."}) from exc

    @transaction.atomic
    def update_group(self, *, user, group: ReminderGroup, **data) -> ReminderGroup:
        subscription_service.require_pro(user)
        if group.owner_id != user.id:
            raise NotFound("Group not found.")
        if "name" in data:
            name = (data["name"] or "").strip()
            if not name:
                raise ValidationError({"name": "Name the group."})
            group.name = name[:80]
        if any(k in data for k in ("channels", "mode", "offset_days", "at_time", "fixed_at")):
            merged = {
                "channels": data.get("channels", group.channels),
                "mode": data.get("mode", group.mode),
                "offset_days": data.get("offset_days", group.offset_days),
                "at_time": data.get("at_time", group.at_time),
                "fixed_at": data.get("fixed_at", group.fixed_at),
            }
            for key, value in _clean_spec(merged).items():
                setattr(group, key, value)
        try:
            group.save()
        except IntegrityError as exc:
            raise ValidationError({"name": "You already have a group with this name."}) from exc
        for reminder in group.reminders.filter(status=Reminder.Status.SCHEDULED):
            self._copy_spec(reminder, group)
            self._reschedule(reminder, allow_past=True)
        return group

    def delete_group(self, *, user, group: ReminderGroup) -> None:
        if group.owner_id != user.id:
            raise NotFound("Group not found.")
        group.delete()

    # ---- reminders ----

    def _target(self, user, target_type: str, target_id: int) -> targets.Target:
        target = targets.resolve(target_type, user, target_id)
        if target is None:
            raise NotFound("Item not found.")
        return target

    def reminders_for(self, user, target_type=None, target_id=None):
        qs = Reminder.objects.filter(owner=user).select_related("group")
        if target_type:
            qs = qs.filter(target_type=target_type)
        if target_id:
            qs = qs.filter(target_id=target_id)
        return qs

    def get_reminder(self, user, reminder_id) -> Reminder:
        reminder = Reminder.objects.filter(owner=user, pk=reminder_id).first()
        if reminder is None:
            raise NotFound("Reminder not found.")
        return reminder

    def _copy_spec(self, reminder: Reminder, source) -> None:
        for key in ("channels", "mode", "offset_days", "at_time", "fixed_at"):
            setattr(reminder, key, getattr(source, key) if not isinstance(source, dict) else source[key])

    def _reschedule(self, reminder: Reminder, allow_past=False) -> None:
        target = targets.resolve(reminder.target_type, reminder.owner, reminder.target_id)
        if target is None:
            reminder.delete()
            return
        try:
            reminder.send_at = compute_send_at(reminder, target.due)
        except ValidationError:
            return
        if not allow_past and reminder.send_at <= timezone.now():
            raise ValidationError({"send_at": "That time has already passed."})
        reminder.save()

    @transaction.atomic
    def create_reminder(self, *, user, target_type, target_id, group_id=None, **data) -> Reminder:
        subscription_service.require_pro(user)
        target = self._target(user, target_type, target_id)
        if Reminder.objects.filter(owner=user, target_type=target_type, target_id=target_id).count() >= MAX_PER_TARGET:
            raise ValidationError({"detail": f"At most {MAX_PER_TARGET} reminders per item."})
        if Reminder.objects.filter(owner=user, status=Reminder.Status.SCHEDULED).count() >= MAX_SCHEDULED:
            raise ValidationError({"detail": "Too many scheduled reminders."})
        group = self.get_group(user, group_id) if group_id else None
        spec = (
            {k: getattr(group, k) for k in ("channels", "mode", "offset_days", "at_time", "fixed_at")}
            if group
            else _clean_spec(data)
        )
        send_at = compute_send_at(spec, target.due)
        if send_at <= timezone.now():
            raise ValidationError({"send_at": "That time has already passed. Pick a later time."})
        return Reminder.objects.create(
            owner=user,
            target_type=target_type,
            target_id=target_id,
            group=group,
            send_at=send_at,
            **spec,
        )

    def delete_reminder(self, *, user, reminder: Reminder) -> None:
        if reminder.owner_id != user.id:
            raise NotFound("Reminder not found.")
        reminder.delete()

    # ---- hooks for apps that own targets ----

    def target_changed(self, target_type: str, target_id: int) -> None:
        for reminder in Reminder.objects.filter(
            target_type=target_type, target_id=target_id, status=Reminder.Status.SCHEDULED
        ).select_related("owner"):
            self._reschedule(reminder, allow_past=True)

    def target_deleted(self, target_type: str, target_id: int) -> None:
        Reminder.objects.filter(target_type=target_type, target_id=target_id).delete()

    # ---- sending ----

    def _addresses(self, user) -> dict[str, str]:
        contact = self.contact_for(user)
        return {
            Channel.EMAIL: contact.email or user.email,
            Channel.TELEGRAM: contact.telegram_chat_id,
            Channel.WHATSAPP: contact.whatsapp_number or user.phone_number,
            Channel.SMS: user.phone_number,
        }

    def _deliver(self, channel: str, address: str, target) -> tuple[bool, str]:
        if not address:
            return False, "no address"
        if channel == Channel.EMAIL:
            subject = " · ".join(part for part in (target.owner_name, target.title) if part)
            return delivery.send_email(address, subject or target.title, target.message)
        if channel == Channel.SMS:
            return delivery.send_sms(
                address,
                name=target.owner_name,
                title=target.title,
                period=target.period,
            )
        if channel == Channel.TELEGRAM:
            return delivery.send_telegram(address, target.message)
        return delivery.send_whatsapp(address, target.message)

    def send_due(self, now=None, limit=100) -> int:
        """Send what is due. Safe to run from several workers at once."""
        now = now or timezone.now()
        handled = 0
        with transaction.atomic():
            due = (
                Reminder.objects.filter(status=Reminder.Status.SCHEDULED, send_at__lte=now)
                .select_related("owner")
                .order_by("send_at")
            )
            if connection.features.has_select_for_update:
                lock = {}
                if connection.features.has_select_for_update_skip_locked:
                    lock["skip_locked"] = True
                due = due.select_for_update(**lock)
            for reminder in list(due[:limit]):
                self._send_one(reminder, now)
                handled += 1
        return handled

    def _send_one(self, reminder: Reminder, now) -> None:
        user = reminder.owner
        target = targets.resolve(reminder.target_type, user, reminder.target_id)
        if target is None:
            reminder.delete()
            return
        if not subscription_service.is_pro(user):
            reminder.status = Reminder.Status.SKIPPED
            reminder.results = {"detail": "pro subscription is not active"}
            reminder.save(update_fields=["status", "results", "updated_at"])
            return
        addresses = self._addresses(user)
        results = dict(reminder.results or {})
        for channel in reminder.channels:
            if results.get(channel) in ("sent", "logged"):
                continue
            ok, detail = self._deliver(channel, addresses.get(channel, ""), target)
            results[channel] = detail if ok else f"failed: {detail}"
        reminder.results = results
        reminder.message = target.message
        reminder.attempts += 1
        all_ok = all(results.get(c) in ("sent", "logged") for c in reminder.channels)
        if all_ok:
            reminder.status, reminder.sent_at = Reminder.Status.SENT, now
        elif reminder.attempts >= MAX_ATTEMPTS:
            any_ok = any(results.get(c) in ("sent", "logged") for c in reminder.channels)
            reminder.status = Reminder.Status.SENT if any_ok else Reminder.Status.FAILED
            reminder.sent_at = now if any_ok else None
        else:
            reminder.send_at = now + RETRY_AFTER
        reminder.save()
