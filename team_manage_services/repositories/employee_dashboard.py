"""Employee dashboard: my work, today, overdue, assigned."""

from datetime import date

from django.db.models import Q

from team_manage_services.models import ProjectMember, Task
from team_manage_services.services.progress import task_progress_percent

OPEN = ~Q(status__in=[Task.Status.DONE, Task.Status.CANCELLED])


def _my_open_tasks(user):
    return (
        Task.objects.filter(
            assigned_to__user=user,
            assigned_to__status=ProjectMember.Status.ACTIVE,
        )
        .filter(OPEN)
        .select_related("project", "assigned_to", "assigned_to__user")
        .prefetch_related("steps")
    )


def serialize_task_row(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "status": task.status,
        "priority": task.priority,
        "difficulty": task.difficulty,
        "due_date": task.due_date,
        "project_id": task.project_id,
        "project_name": task.project.name,
        "progress_percent": task_progress_percent(task),
    }


def employee_dashboard(user, *, today: date | None = None) -> dict:
    today = today or date.today()
    mine = _my_open_tasks(user)
    tasks = list(mine)
    today_tasks = [t for t in tasks if t.due_date == today or t.status == Task.Status.IN_PROGRESS]
    overdue = [t for t in tasks if t.due_date and t.due_date < today]
    return {
        "today": [serialize_task_row(t) for t in today_tasks],
        "overdue": [serialize_task_row(t) for t in overdue],
        "assigned": [serialize_task_row(t) for t in tasks],
        "counts": {
            "today": len(today_tasks),
            "overdue": len(overdue),
            "assigned": len(tasks),
        },
    }
