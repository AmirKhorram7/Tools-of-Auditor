from datetime import date, timedelta

from django.db import transaction
from django.db.models import Count, Max, Prefetch, Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from daybook_services.models import DEFAULT_COLOR, Daybook, DayNote, Plan, PlanItem
from daybook_services.reminders import NOTE, PLAN
from daybook_services.services.html import plain_text, sanitize_html
from reminder_services.services.reminders import ReminderService

reminder_service = ReminderService()

MAX_RANGE_DAYS = 120
MAX_PLAN_DAYS = 366
MAX_ITEMS_PER_PLAN = 100


def normalize_color(value: str | None) -> str:
    return (value or DEFAULT_COLOR).upper()


def parse_range(start: date | None, end: date | None) -> tuple[date, date]:
    """Default to the current week; refuse huge or inverted windows."""
    if start is None and end is None:
        start = date.today() - timedelta(days=date.today().weekday())
        end = start + timedelta(days=6)
    start = start or end
    end = end or start
    if end < start:
        raise ValidationError({"end": "End must be on or after start."})
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise ValidationError({"end": f"Range is limited to {MAX_RANGE_DAYS} days."})
    return start, end


class DaybookService:
    # ---- settings ----

    def settings_for(self, user) -> Daybook:
        daybook, _ = Daybook.objects.get_or_create(owner=user)
        return daybook

    def update_settings(self, user, **fields) -> Daybook:
        daybook = self.settings_for(user)
        for key in ("calendar_system", "default_view"):
            if key in fields:
                setattr(daybook, key, fields[key])
        daybook.save()
        return daybook

    # ---- notes ----

    def notes_for(self, user, start: date | None = None, end: date | None = None):
        qs = DayNote.objects.filter(owner=user)
        if start or end:
            start, end = parse_range(start, end)
            qs = qs.filter(date__range=(start, end))
        return qs

    def get_note(self, user, note_id) -> DayNote:
        note = DayNote.objects.filter(owner=user, pk=note_id).first()
        if note is None:
            raise NotFound("Note not found.")
        return note

    def _clean_note(self, title: str, body: str) -> tuple[str, str]:
        title = (title or "").strip()
        body = sanitize_html(body)
        if not title and not plain_text(body):
            raise ValidationError({"body": "Write something before saving the note."})
        return title, body

    def create_note(self, *, user, date, title="", body="", color=None, is_pinned=False) -> DayNote:
        title, body = self._clean_note(title, body)
        return DayNote.objects.create(
            owner=user,
            date=date,
            title=title,
            body=body,
            color=normalize_color(color),
            is_pinned=is_pinned,
        )

    def update_note(self, *, user, note: DayNote, **fields) -> DayNote:
        if note.owner_id != user.id:
            raise NotFound("Note not found.")
        title = fields.get("title", note.title)
        body = fields["body"] if "body" in fields else note.body
        note.title, note.body = self._clean_note(title, body)
        if "date" in fields:
            note.date = fields["date"]
        if "color" in fields:
            note.color = normalize_color(fields["color"])
        if "is_pinned" in fields:
            note.is_pinned = fields["is_pinned"]
        note.save()
        reminder_service.target_changed(NOTE, note.pk)
        return note

    def delete_note(self, *, user, note: DayNote) -> None:
        if note.owner_id != user.id:
            raise NotFound("Note not found.")
        reminder_service.target_deleted(NOTE, note.pk)
        note.delete()

    # ---- plans ----

    def _plan_qs(self, user):
        return (
            Plan.objects.filter(owner=user)
            .annotate(
                item_total=Count("items", distinct=True),
                item_done=Count("items", filter=Q(items__is_done=True), distinct=True),
            )
            .prefetch_related(Prefetch("items", queryset=PlanItem.objects.order_by("position", "id")))
            .order_by("start_date", "created_at", "id")
        )

    def plans_for(self, user, start: date | None = None, end: date | None = None, status: str | None = None):
        qs = self._plan_qs(user)
        if start or end:
            start, end = parse_range(start, end)
            qs = qs.filter(start_date__lte=end, end_date__gte=start)
        if status:
            if status not in Plan.Status.values:
                raise ValidationError({"status": "Unknown status."})
            qs = qs.filter(status=status)
        return qs

    def get_plan(self, user, plan_id) -> Plan:
        plan = self._plan_qs(user).filter(pk=plan_id).first()
        if plan is None:
            raise NotFound("Plan not found.")
        return plan

    def _check_dates(self, start: date, end: date | None) -> date:
        end = end or start
        if end < start:
            raise ValidationError({"end_date": "End date must be on or after the start date."})
        if (end - start).days + 1 > MAX_PLAN_DAYS:
            raise ValidationError({"end_date": f"A plan can cover at most {MAX_PLAN_DAYS} days."})
        return end

    def _clean_titles(self, titles) -> list[str]:
        rows = [str(t).strip()[:240] for t in (titles or []) if str(t).strip()]
        if len(rows) > MAX_ITEMS_PER_PLAN:
            raise ValidationError({"items": f"At most {MAX_ITEMS_PER_PLAN} items per plan."})
        return rows

    @transaction.atomic
    def create_plan(self, *, user, title, start_date, end_date=None, color=None, items=None) -> Plan:
        title = (title or "").strip()
        if not title:
            raise ValidationError({"title": "Give the plan a title."})
        end_date = self._check_dates(start_date, end_date)
        titles = self._clean_titles(items)
        plan = Plan.objects.create(
            owner=user,
            title=title,
            start_date=start_date,
            end_date=end_date,
            color=normalize_color(color),
        )
        PlanItem.objects.bulk_create(
            [PlanItem(plan=plan, title=text, position=index) for index, text in enumerate(titles)]
        )
        return self.get_plan(user, plan.pk)

    @transaction.atomic
    def update_plan(self, *, user, plan: Plan, **fields) -> Plan:
        if plan.owner_id != user.id:
            raise NotFound("Plan not found.")
        if "title" in fields:
            title = (fields["title"] or "").strip()
            if not title:
                raise ValidationError({"title": "Give the plan a title."})
            plan.title = title
        start = fields.get("start_date", plan.start_date)
        end = fields.get("end_date", plan.end_date)
        if "start_date" in fields and "end_date" not in fields and end < start:
            end = start
        plan.start_date, plan.end_date = start, self._check_dates(start, end)
        if "color" in fields:
            plan.color = normalize_color(fields["color"])
        if "status" in fields:
            self._set_status(plan, fields["status"])
        plan.save()
        if plan.status == Plan.Status.CANCELLED:
            reminder_service.target_deleted(PLAN, plan.pk)
        else:
            reminder_service.target_changed(PLAN, plan.pk)
        return self.get_plan(user, plan.pk)

    def _set_status(self, plan: Plan, status: str) -> None:
        if status == plan.status:
            return
        if status == Plan.Status.DONE:
            plan.items.filter(is_done=False).update(is_done=True, done_at=timezone.now())
            plan.closed_at = timezone.now()
        elif status == Plan.Status.CANCELLED:
            plan.closed_at = timezone.now()
        else:
            plan.closed_at = None
        plan.status = status

    def delete_plan(self, *, user, plan: Plan) -> None:
        if plan.owner_id != user.id:
            raise NotFound("Plan not found.")
        plan_id = plan.pk
        plan.delete()
        reminder_service.target_deleted(PLAN, plan_id)

    def _sync_status(self, plan: Plan) -> None:
        """Checking the last item closes the plan; unchecking one reopens it."""
        if plan.status == Plan.Status.CANCELLED:
            return
        total = plan.items.count()
        open_left = plan.items.filter(is_done=False).exists()
        if total and not open_left and plan.status != Plan.Status.DONE:
            plan.status, plan.closed_at = Plan.Status.DONE, timezone.now()
            plan.save(update_fields=["status", "closed_at", "updated_at"])
        elif open_left and plan.status == Plan.Status.DONE:
            plan.status, plan.closed_at = Plan.Status.OPEN, None
            plan.save(update_fields=["status", "closed_at", "updated_at"])

    def _require_editable(self, plan: Plan) -> None:
        if plan.status == Plan.Status.CANCELLED:
            raise ValidationError({"plan": "This plan is cancelled. Reopen it to change items."})

    # ---- plan items ----

    def get_item(self, plan: Plan, item_id) -> PlanItem:
        item = PlanItem.objects.filter(plan=plan, pk=item_id).first()
        if item is None:
            raise NotFound("Item not found.")
        return item

    @transaction.atomic
    def add_item(self, *, user, plan: Plan, title: str) -> PlanItem:
        if plan.owner_id != user.id:
            raise NotFound("Plan not found.")
        self._require_editable(plan)
        title = (title or "").strip()
        if not title:
            raise ValidationError({"title": "Write the item first."})
        if plan.items.count() >= MAX_ITEMS_PER_PLAN:
            raise ValidationError({"items": f"At most {MAX_ITEMS_PER_PLAN} items per plan."})
        position = (plan.items.aggregate(n=Max("position"))["n"] or 0) + 1
        item = PlanItem.objects.create(plan=plan, title=title[:240], position=position)
        self._sync_status(plan)
        return item

    @transaction.atomic
    def update_item(self, *, user, plan: Plan, item: PlanItem, **fields) -> PlanItem:
        if plan.owner_id != user.id or item.plan_id != plan.id:
            raise NotFound("Item not found.")
        self._require_editable(plan)
        if "title" in fields:
            title = (fields["title"] or "").strip()
            if not title:
                raise ValidationError({"title": "Item cannot be empty."})
            item.title = title[:240]
        if "position" in fields:
            item.position = fields["position"]
        if "is_done" in fields and fields["is_done"] != item.is_done:
            item.is_done = fields["is_done"]
            item.done_at = timezone.now() if item.is_done else None
        item.save()
        self._sync_status(plan)
        return item

    @transaction.atomic
    def delete_item(self, *, user, plan: Plan, item: PlanItem) -> None:
        if plan.owner_id != user.id or item.plan_id != plan.id:
            raise NotFound("Item not found.")
        self._require_editable(plan)
        item.delete()
        self._sync_status(plan)

    # ---- agenda ----

    def agenda(self, user, start: date | None, end: date | None) -> dict:
        start, end = parse_range(start, end)
        return {
            "start": start,
            "end": end,
            "settings": self.settings_for(user),
            "notes": self.notes_for(user, start, end),
            "plans": self.plans_for(user, start, end).exclude(status=Plan.Status.CANCELLED),
        }
