"""
Dashboard timeline: activity (فعالیت) + due dates.

Due items use the same shape as in-app notifications so a later job can
create Notification(DEADLINE) rows without another query design.
"""

from datetime import date, datetime, time, timedelta

from django.db.models import Q
from django.utils import timezone

from team_manage_services.models import ActivityLog, Notification, Project, Task
from team_manage_services.services.access import (
    companies_for_user,
    display_name,
    projects_for_user,
)

OPEN = ~Q(status__in=[Task.Status.DONE, Task.Status.CANCELLED])
DUE_LOOKAHEAD_DAYS = 14


def _as_datetime(day: date):
    dt = datetime.combine(day, time.min)
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _due_item(*, task: Task, today: date, kind: str) -> dict:
    due = task.due_date
    return {
        "id": f"due:task:{task.id}",
        "kind": kind,
        "occurred_at": _as_datetime(due) if due else None,
        "title": "سررسید گذشته" if kind == "overdue" else "سررسید کار",
        "message": f"کار «{task.title}» در پروژه «{task.project.name}».",
        "entity_type": "task",
        "entity_id": task.id,
        "project_id": task.project_id,
        "company_id": task.project.company_id,
        "action": None,
        "notification_type": Notification.Type.DEADLINE,
        "reference_type": "task",
        "reference_id": task.id,
    }


def _project_due_item(*, project: Project, today: date, kind: str) -> dict:
    due = project.due_date
    return {
        "id": f"due:project:{project.id}",
        "kind": kind,
        "occurred_at": _as_datetime(due) if due else None,
        "title": "سررسید گذشته پروژه" if kind == "overdue" else "سررسید پروژه",
        "message": f"پروژه «{project.name}».",
        "entity_type": "project",
        "entity_id": project.id,
        "project_id": project.id,
        "company_id": project.company_id,
        "action": None,
        "notification_type": Notification.Type.DEADLINE,
        "reference_type": "project",
        "reference_id": project.id,
    }


def _activity_item(log: ActivityLog) -> dict:
    actor = display_name(log.actor) if log.actor_id else "سیستم"
    return {
        "id": f"activity:{log.id}",
        "kind": "activity",
        "occurred_at": log.created_at,
        "title": log.get_action_display(),
        "message": log.description or f"{actor}: {log.action} {log.entity_type}",
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "project_id": log.project_id,
        "company_id": log.company_id,
        "action": log.action,
        "actor_name": actor,
        "notification_type": None,
        "reference_type": log.entity_type,
        "reference_id": log.entity_id,
    }


def visible_activity(user, *, company_id=None, project_id=None, limit=40):
    company_ids = companies_for_user(user).values_list("id", flat=True)
    project_ids = projects_for_user(user).values_list("id", flat=True)
    logs = ActivityLog.objects.filter(
        Q(company_id__in=company_ids)
        | Q(project_id__in=project_ids)
        | Q(actor=user)
    ).select_related("actor", "company", "project")
    if company_id:
        logs = logs.filter(company_id=company_id)
    if project_id:
        logs = logs.filter(project_id=project_id)
    return list(logs[:limit])


def deadline_items(user, *, company_id=None, project_id=None, today: date | None = None):
    """Open tasks/projects with due dates — feed for dashboard and later SMS/inbox."""
    today = today or date.today()
    horizon = today + timedelta(days=DUE_LOOKAHEAD_DAYS)
    projects = projects_for_user(user).exclude(status=Project.Status.CANCELLED)
    if company_id:
        projects = projects.filter(company_id=company_id)
    if project_id:
        projects = projects.filter(pk=project_id)
    project_list = list(projects.select_related("company"))
    project_ids = [p.id for p in project_list]

    tasks = (
        Task.objects.filter(OPEN, project_id__in=project_ids, due_date__isnull=False)
        .filter(Q(due_date__lt=today) | Q(due_date__gte=today, due_date__lte=horizon))
        .select_related("project")
    )

    items = []
    for task in tasks:
        kind = "overdue" if task.due_date < today else "due"
        items.append(_due_item(task=task, today=today, kind=kind))
    for project in project_list:
        if not project.due_date:
            continue
        if project.status in (Project.Status.COMPLETED, Project.Status.CANCELLED):
            continue
        if project.due_date < today:
            items.append(_project_due_item(project=project, today=today, kind="overdue"))
        elif project.due_date <= horizon:
            items.append(_project_due_item(project=project, today=today, kind="due"))

    items.sort(key=lambda row: (0 if row["kind"] == "overdue" else 1, row["occurred_at"] or timezone.now()))
    return items


def timeline_for_user(
    user,
    *,
    company_id=None,
    project_id=None,
    limit: int = 40,
    today: date | None = None,
) -> dict:
    due = deadline_items(
        user, company_id=company_id, project_id=project_id, today=today
    )
    activity = [
        _activity_item(log)
        for log in visible_activity(
            user, company_id=company_id, project_id=project_id, limit=limit
        )
    ]
    items = list(due) + list(activity)
    items.sort(
        key=lambda row: row["occurred_at"] or timezone.now(),
        reverse=True,
    )
    return {
        "due": due,
        "activity": activity,
        "items": items[: limit + len(due)],
    }
