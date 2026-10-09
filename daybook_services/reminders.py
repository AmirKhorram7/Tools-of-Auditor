"""Daybook plans and notes as reminder targets."""

from django.conf import settings

from daybook_services.models import DayNote, Plan
from daybook_services.services.html import plain_text
from reminder_services import targets
from reminder_services.jalali import fa_digits, format_fa

PLAN = "daybook.plan"
NOTE = "daybook.note"


def _person_name(user) -> str:
    full = f"{getattr(user, 'first_name', '')} {getattr(user, 'last_name', '')}".strip()
    if full:
        return full
    profile = getattr(user, "profile", None)
    if profile is not None:
        full = f"{getattr(profile, 'first_name', '')} {getattr(profile, 'last_name', '')}".strip()
        if full:
            return full
    return "کاربر"


def _period(start, end) -> str:
    if start and end and start != end:
        return f"{format_fa(start)} تا {format_fa(end)}"
    return format_fa(end or start)


def _item_url(kind: str, pk: int) -> str:
    """Absolute daybook URL. Empty when SITE_URL is unset."""
    base = (getattr(settings, "SITE_URL", "") or "").rstrip("/")
    if not base:
        return ""
    return f"{base}/daybook?{kind}={int(pk)}"


def _with_link(lines: list[str], url: str) -> str:
    if url:
        lines.extend(["", url])
    return "\n".join(lines)


def plan_target(user, plan_id):
    plan = Plan.objects.filter(owner=user, pk=plan_id).first()
    if plan is None or plan.status == Plan.Status.CANCELLED:
        return None
    name = _person_name(user)
    period = _period(plan.start_date, plan.end_date)
    url = _item_url("plan", plan.pk)
    left = plan.items.filter(is_done=False).count()
    lines = [f"{name} عزیز", f"برنامه: {plan.title}", f"بازه: {period}"]
    if left:
        lines.append(f"{fa_digits(left)} مورد هنوز باز است.")
    return targets.Target(
        title=plan.title,
        message=_with_link(lines, url),
        due=plan.end_date,
        owner_name=name,
        period=period,
        url=url,
    )


def note_target(user, note_id):
    note = DayNote.objects.filter(owner=user, pk=note_id).first()
    if note is None:
        return None
    name = _person_name(user)
    period = format_fa(note.date)
    heading = note.title or "یادداشت"
    body = plain_text(note.body)
    url = _item_url("note", note.pk)
    lines = [f"{name} عزیز", heading, period]
    if body:
        lines.append(body)
    return targets.Target(
        title=heading,
        message=_with_link(lines, url),
        due=note.date,
        owner_name=name,
        period=period,
        url=url,
    )


def register():
    targets.register(PLAN, plan_target)
    targets.register(NOTE, note_target)
