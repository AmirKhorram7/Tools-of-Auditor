"""Project board columns and company labels (GitLab-style lists + tags)."""

from team_manage_services.models import (
    BoardColumn,
    BoardTemplate,
    BoardTemplateColumn,
    Project,
    Task,
    WorkLabel,
)
from team_manage_services.services.access import is_company_manager, is_project_manager

DEFAULT_BOARD_COLUMNS = (
    {"name": "برای انجام", "color": "#14233A", "status_key": Task.Status.TODO, "is_closed": False},
    {
        "name": "در حال انجام",
        "color": "#1A2B49",
        "status_key": Task.Status.IN_PROGRESS,
        "is_closed": False,
    },
    {"name": "بسته", "color": "#1E3328", "status_key": Task.Status.DONE, "is_closed": True},
)


PLATFORM_BOARD_COLUMNS = (
    {"name": "برای انجام", "color": "#14233A", "status_key": Task.Status.TODO, "is_closed": False},
    {
        "name": "در حال انجام",
        "color": "#1A2B49",
        "status_key": Task.Status.IN_PROGRESS,
        "is_closed": False,
    },
    {"name": "تست", "color": "#243656", "status_key": Task.Status.IN_PROGRESS, "is_closed": False},
    {
        "name": "در انتظار تأیید",
        "color": "#3A2430",
        "status_key": Task.Status.IN_REVIEW,
        "is_closed": False,
    },
    {"name": "بسته", "color": "#1E3328", "status_key": Task.Status.DONE, "is_closed": True},
)


def infer_column_status(name: str, is_closed=False) -> tuple[str, bool]:
    text = (name or "").strip().lower()
    closed_words = ("بسته", "تمام", "close", "closed", "done", "finished")
    review_words = ("تأیید", "تاييد", "تایید", "approve", "approval", "بازبینی", "review")
    progress_words = ("انجام", "progress", "doing")
    if is_closed or any(word in text for word in closed_words):
        return Task.Status.DONE, True
    if any(word in text for word in review_words):
        return Task.Status.IN_REVIEW, False
    if any(word in text for word in progress_words) and "برای" not in text:
        return Task.Status.IN_PROGRESS, False
    return Task.Status.TODO, False


def default_template_columns(company) -> list[BoardTemplateColumn] | None:
    template = (
        BoardTemplate.objects.filter(company=company, is_default=True)
        .prefetch_related("columns")
        .first()
    )
    if template is None:
        return None
    columns = list(template.columns.all())
    return columns or None


def platform_board_template() -> BoardTemplate | None:
    return (
        BoardTemplate.objects.filter(is_platform=True)
        .prefetch_related("columns")
        .order_by("id")
        .first()
    )


def seed_project_columns(project: Project, template: BoardTemplate | None = None) -> list[BoardColumn]:
    existing = list(project.board_columns.order_by("position", "id"))
    if existing:
        return existing
    specs = None
    if template is not None:
        specs = list(template.columns.all())
    if not specs:
        specs = default_template_columns(project.company)
    created = []
    if specs:
        for index, spec in enumerate(specs):
            status_key, is_closed = infer_column_status(spec.name, spec.is_closed)
            created.append(
                BoardColumn.objects.create(
                    project=project,
                    name=spec.name,
                    color=spec.color or "#1A2B49",
                    status_key=spec.status_key or status_key,
                    is_closed=spec.is_closed or is_closed,
                    position=spec.position if spec.position is not None else index,
                )
            )
        return created
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


def delete_label(*, user, label: WorkLabel):
    from rest_framework.exceptions import PermissionDenied

    if not is_company_manager(user, label.company):
        raise PermissionDenied("Only the company manager can delete labels.")
    label.delete()


def ensure_approval_column(project: Project) -> BoardColumn:
    from django.db.models import F

    columns = list(project.board_columns.order_by("position", "id"))
    for column in columns:
        if column.status_key == Task.Status.IN_REVIEW or any(
            word in (column.name or "") for word in ("تأیید", "تایید", "تاييد")
        ):
            return column
    closed = next((col for col in columns if col.is_closed), None)
    position = closed.position if closed else ((columns[-1].position + 1) if columns else 0)
    if closed:
        BoardColumn.objects.filter(project=project, position__gte=position).update(
            position=F("position") + 1
        )
    return BoardColumn.objects.create(
        project=project,
        name="در انتظار تأیید",
        color="#3A2430",
        status_key=Task.Status.IN_REVIEW,
        is_closed=False,
        position=position,
    )


def apply_template_to_project(*, user, project: Project, template: BoardTemplate):
    from rest_framework.exceptions import PermissionDenied

    if not is_project_manager(user, project):
        raise PermissionDenied("Only a project manager can change the board.")
    existing_names = {col.name.strip() for col in project.board_columns.all()}
    last = project.board_columns.order_by("-position").first()
    position = (last.position + 1) if last else 0
    for spec in template.columns.all():
        if spec.name.strip() in existing_names:
            continue
        status_key, is_closed = infer_column_status(spec.name, spec.is_closed)
        BoardColumn.objects.create(
            project=project,
            name=spec.name,
            color=spec.color or "#1A2B49",
            status_key=spec.status_key or status_key,
            is_closed=spec.is_closed or is_closed,
            position=position,
        )
        position += 1
    if template.requires_approval or template.is_platform:
        project.require_approval_before_close = True
        project.save(update_fields=["require_approval_before_close", "updated_at"])
        ensure_approval_column(project)
    return list(project.board_columns.order_by("position", "id"))


def save_board_template(*, user, company, name: str, columns: list, is_default=False, template=None):
    from rest_framework.exceptions import PermissionDenied, ValidationError

    if template is not None and template.is_platform:
        raise PermissionDenied("The platform board cannot be changed.")
    if not is_company_manager(user, company):
        raise PermissionDenied("Only the company manager can save a default board.")
    name = (name or "").strip()
    if not name:
        raise ValidationError({"name": "Template name is required."})
    rows = [row for row in (columns or []) if (row.get("name") or "").strip()]
    if not rows:
        raise ValidationError({"columns": "Add at least one column."})
    if template is None:
        template = BoardTemplate(company=company, created_by=user)
    template.name = name
    template.is_default = bool(is_default)
    template.full_clean()
    template.save()
    if is_default:
        BoardTemplate.objects.filter(company=company).exclude(pk=template.pk).update(is_default=False)
        template.is_default = True
        template.save(update_fields=["is_default"])
    template.columns.all().delete()
    for index, row in enumerate(rows):
        col_name = row["name"].strip()
        status_key, is_closed = infer_column_status(col_name, row.get("is_closed", False))
        BoardTemplateColumn.objects.create(
            template=template,
            name=col_name,
            color=(row.get("color") or "#1A2B49").strip(),
            position=index,
            status_key=row.get("status_key") or status_key,
            is_closed=bool(row.get("is_closed") or is_closed),
        )
    return template


def set_default_board_template(*, user, template: BoardTemplate) -> BoardTemplate:
    from rest_framework.exceptions import PermissionDenied, ValidationError

    if template.is_platform:
        raise ValidationError({"template": "Set the platform board on a project instead."})
    if not is_company_manager(user, template.company):
        raise PermissionDenied("Only the company manager can set the default board.")
    BoardTemplate.objects.filter(company=template.company).update(is_default=False)
    template.is_default = True
    template.save(update_fields=["is_default", "updated_at"])
    return template


def delete_board_template(*, user, template: BoardTemplate):
    from rest_framework.exceptions import PermissionDenied

    if template.is_platform:
        raise PermissionDenied("The platform board cannot be deleted.")
    if not is_company_manager(user, template.company):
        raise PermissionDenied("Only the company manager can delete a default board.")
    template.delete()
