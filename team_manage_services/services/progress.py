"""Task and project progress. Difficulty is the task weight."""

from team_manage_services.models import Project, Task


def task_progress_percent(task: Task, steps=None) -> int:
    if task.status == Task.Status.CANCELLED:
        return 0
    if task.status == Task.Status.DONE:
        return 100
    if steps is None:
        steps = list(task.steps.all())
    if not steps:
        return 0
    done = sum(1 for step in steps if step.is_completed)
    return round(100 * done / len(steps))


def project_progress_percent(project: Project) -> int:
    tasks = list(
        project.tasks.exclude(status=Task.Status.CANCELLED).prefetch_related("steps")
    )
    if not tasks:
        return 0
    total_weight = 0
    earned = 0.0
    for task in tasks:
        weight = task.difficulty or 1
        total_weight += weight
        earned += weight * task_progress_percent(task)
    if total_weight == 0:
        return 0
    return round(earned / total_weight)
