"""Manager dashboard: projects, teams, progress, risks."""

from datetime import date, timedelta

from django.db.models import Count, Q

from team_manage_services.models import Invitation, Project, Task
from team_manage_services.services.access import projects_for_user
from team_manage_services.services.progress import project_progress_percent

OPEN = ~Q(status__in=[Task.Status.DONE, Task.Status.CANCELLED])


def manager_dashboard(user, *, company_id: int | None = None, today: date | None = None) -> dict:
    today = today or date.today()
    week = today + timedelta(days=7)
    projects = projects_for_user(user).select_related("company", "owner")
    if company_id:
        projects = projects.filter(company_id=company_id)
    projects = list(projects.exclude(status=Project.Status.CANCELLED))

    project_rows = []
    at_risk = []
    unassigned_total = 0
    for project in projects:
        progress = project_progress_percent(project)
        overdue = project.tasks.filter(OPEN, due_date__lt=today).count()
        blocked = project.tasks.filter(status=Task.Status.BLOCKED).count()
        due_soon = project.tasks.filter(OPEN, due_date__gte=today, due_date__lte=week).count()
        unassigned = project.tasks.filter(OPEN, assigned_to__isnull=True).count()
        unassigned_total += unassigned
        row = {
            "id": project.id,
            "name": project.name,
            "status": project.status,
            "priority": project.priority,
            "due_date": project.due_date,
            "progress_percent": progress,
            "overdue_count": overdue,
            "blocked_count": blocked,
            "due_soon_count": due_soon,
            "unassigned_count": unassigned,
        }
        project_rows.append(row)
        if overdue or blocked or due_soon:
            at_risk.append(row)

    load = list(
        Task.objects.filter(OPEN, project__in=projects, assigned_to__isnull=False)
        .values(
            "assigned_to__user_id",
            "assigned_to__user__first_name",
            "assigned_to__user__last_name",
            "assigned_to__user__phone_number",
        )
        .annotate(open_tasks=Count("id"))
        .order_by("-open_tasks")[:12]
    )
    workload = [
        {
            "user_id": row["assigned_to__user_id"],
            "name": (
                f"{row['assigned_to__user__first_name'] or ''} {row['assigned_to__user__last_name'] or ''}".strip()
                or row["assigned_to__user__phone_number"]
            ),
            "open_tasks": row["open_tasks"],
        }
        for row in load
    ]

    company_ids = {p.company_id for p in projects}
    pending_invites = Invitation.objects.filter(
        team__company_id__in=company_ids,
        status=Invitation.Status.PENDING,
    ).count()
    done_this_week = Task.objects.filter(
        project__in=projects,
        status=Task.Status.DONE,
        completed_at__date__gte=today - timedelta(days=7),
    ).count()

    return {
        "projects": project_rows,
        "at_risk": at_risk,
        "unassigned_count": unassigned_total,
        "workload": workload,
        "pending_invites": pending_invites,
        "completed_this_week": done_this_week,
    }
