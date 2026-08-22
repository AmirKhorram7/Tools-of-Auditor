"""Project board columns and company labels (GitLab-style lists + tags)."""

from team_manage_services.models import BoardColumn, Project, Task, WorkLabel
from team_manage_services.services.access import is_company_manager, is_project_manager

DEFAULT_BOARD_COLUMNS = (
    {"name": "برای انجام", "color": "#14233A", "status_key": Task.Status.TODO, "is_closed": False},
    {
        "name": "در حال انجام",
        "color": "#1A2B49",
        "status_key": Task.Status.IN_PROGRESS,
        "is_closed": False,
    },
)


def seed_project_columns(project: Project) -> list[BoardColumn]:
    existing = list(project.board_columns.order_by("position", "id"))
    if existing:
        return existing
    created = []
    for index, spec in enumerate(DEFAULT_BOARD_COLUMNS):
        created.append(
            BoardColumn.objects.create(
                project=project,
                name=spec["name"],
                color=spec["color"],
                status_key=spec["status_key"],
                is_closed=spec["is_closed"],
                position=index,
            )
        )
    return created


def ensure_project_columns(project: Project) -> list[BoardColumn]:
    columns = seed_project_columns(project)
    by_status = {col.status_key: col for col in columns}
    hanging = Task.objects.filter(project=project, column__isnull=True)
    for task in hanging:
        column = by_status.get(task.status) or columns[0]
        task.column = column
        task.save(update_fields=["column", "updated_at"])
    return list(project.board_columns.order_by("position", "id"))


def column_for_status(project: Project, status_key: str) -> BoardColumn | None:
    columns = ensure_project_columns(project)
    for column in columns:
        if column.status_key == status_key:
            return column
    if status_key == Task.Status.DONE:
        return next((col for col in columns if col.is_closed), None)
    return None


def apply_column_to_task(task: Task, column: BoardColumn | None) -> None:
    task.column = column
    if column is None:
        return
    if column.is_closed:
        task.status = Task.Status.DONE
    elif column.status_key in Task.Status.values:
        task.status = column.status_key


def create_column(*, user, project: Project, name="", color="#1A2B49", status_key="", is_closed=False):
    from rest_framework.exceptions import PermissionDenied, ValidationError

    if not is_project_manager(user, project):
        raise PermissionDenied("Only a project manager can change the board.")
    name = (name or "").strip()
    if not name:
        raise ValidationError({"name": "Column name is required."})
    last = project.board_columns.order_by("-position").first()
    column = BoardColumn(
        project=project,
        name=name,
        color=(color or "#1A2B49").strip(),
        status_key=status_key or Task.Status.IN_PROGRESS,
        is_closed=bool(is_closed or status_key == Task.Status.DONE),
        position=(last.position + 1) if last else 0,
    )
    column.full_clean()
    column.save()
    return column


def update_column(*, user, column: BoardColumn, **fields) -> BoardColumn:
    from rest_framework.exceptions import PermissionDenied

    if not is_project_manager(user, column.project):
        raise PermissionDenied("Only a project manager can change the board.")
    fields.pop("project", None)
    for key, value in fields.items():
        setattr(column, key, value)
    if column.status_key == Task.Status.DONE:
        column.is_closed = True
    column.full_clean()
    column.save()
    return column


def delete_column(*, user, column: BoardColumn):
    from rest_framework.exceptions import PermissionDenied, ValidationError

    if not is_project_manager(user, column.project):
        raise PermissionDenied("Only a project manager can change the board.")
    siblings = list(
        BoardColumn.objects.filter(project=column.project).exclude(pk=column.pk).order_by("position")
    )
    if not siblings:
        raise ValidationError({"column": "Keep at least one board column."})
    fallback = siblings[0]
    column.tasks.update(column=fallback, status=fallback.status_key)
    column.delete()
    return fallback


def reorder_columns(*, user, project: Project, column_ids: list[int]) -> list[BoardColumn]:
    from rest_framework.exceptions import PermissionDenied, ValidationError

    if not is_project_manager(user, project):
        raise PermissionDenied("Only a project manager can change the board.")
    columns = {col.id: col for col in project.board_columns.all()}
    if set(column_ids) != set(columns):
        raise ValidationError({"column_ids": "Send every column id on this board."})
    for index, column_id in enumerate(column_ids):
        BoardColumn.objects.filter(pk=column_id, project=project).update(position=index)
    return list(project.board_columns.order_by("position", "id"))


def create_label(*, user, company, name: str, color: str, description: str = "") -> WorkLabel:
    from rest_framework.exceptions import PermissionDenied, ValidationError

    if not is_company_manager(user, company):
        raise PermissionDenied("Only the company manager can create labels.")
    name = (name or "").strip()
    if not name:
        raise ValidationError({"name": "Label name is required."})
    label = WorkLabel(
        company=company,
        name=name,
        color=(color or "#3A6B52").strip(),
        description=(description or "").strip(),
    )
    label.full_clean()
    label.save()
    return label


def update_label(*, user, label: WorkLabel, **fields) -> WorkLabel:
    from rest_framework.exceptions import PermissionDenied

    if not is_company_manager(user, label.company):
        raise PermissionDenied("Only the company manager can update labels.")
    fields.pop("company", None)
    for key, value in fields.items():
        setattr(label, key, value)
    label.full_clean()
    label.save()
    return label
