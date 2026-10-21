"""Project, members, tasks, and steps."""

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from team_manage_services.models import (
    ActivityLog,
    DeskChatCursor,
    DeskChatMessage,
    Notification,
    Project,
    ProjectMember,
    ProjectTeam,
    Task,
    TaskComment,
    TaskStep,
    Team,
    TeamMember,
)
from team_manage_services.services.access import (
    can_add_task,
    can_move_task,
    can_move_task_to_column,
    can_view_project,
    can_work_on_task,
    is_company_manager,
    is_project_manager,
    project_requires_approval,
)
from team_manage_services.services.org import create_team, workspace_for
from team_manage_services.services.board import (
    apply_column_to_task,
    column_for_status,
    ensure_approval_column,
    ensure_project_columns,
    seed_project_columns,
)
from team_manage_services.services.notify import log_activity, notify_user


def project_role_from_team(role: str) -> str:
    if role in (TeamMember.Role.OWNER, TeamMember.Role.MAINTAINER):
        return ProjectMember.Role.MAINTAINER
    if role == TeamMember.Role.PLANNER:
        return ProjectMember.Role.PLANNER
    if role == TeamMember.Role.GUEST:
        return ProjectMember.Role.GUEST
    return ProjectMember.Role.DEVELOPER


def sync_team_role_to_projects(team_member: TeamMember) -> None:
    mapped = project_role_from_team(team_member.role)
    ProjectMember.objects.filter(
        added_from_team=team_member.team,
        user=team_member.user,
    ).exclude(role=ProjectMember.Role.OWNER).update(role=mapped)


def _upsert_project_member_from_team(*, project: Project, team: Team, team_member: TeamMember) -> ProjectMember:
    mapped = project_role_from_team(team_member.role)
    member, created = ProjectMember.objects.get_or_create(
        project=project,
        user=team_member.user,
        defaults={
            "role": mapped,
            "status": ProjectMember.Status.ACTIVE,
            "added_from_team": team,
        },
    )
    if created:
        return member
    updates = []
    if member.status != ProjectMember.Status.ACTIVE:
        member.status = ProjectMember.Status.ACTIVE
        updates.append("status")
    if member.role != ProjectMember.Role.OWNER:
        if member.role != mapped:
            member.role = mapped
            updates.append("role")
        if member.added_from_team_id is None:
            member.added_from_team = team
            updates.append("added_from_team")
    if updates:
        updates.append("updated_at")
        member.save(update_fields=updates)
    return member


def sync_team_members_onto_project(project: Project, team: Team) -> None:
    members = team.members.filter(status=TeamMember.Status.ACTIVE).select_related("user")
    for team_member in members:
        _upsert_project_member_from_team(project=project, team=team, team_member=team_member)


def add_user_to_linked_desks(*, team: Team, team_member: TeamMember) -> None:
    """When someone joins a team, they become assignable on every desk that team is on."""
    links = team.project_links.select_related("project")
    for link in links:
        _upsert_project_member_from_team(project=link.project, team=team, team_member=team_member)


def _ensure_project_owner_member(project: Project) -> ProjectMember:
    member, _ = ProjectMember.objects.get_or_create(
        project=project,
        user=project.owner,
        defaults={
            "role": ProjectMember.Role.OWNER,
            "status": ProjectMember.Status.ACTIVE,
        },
    )
    return member


@transaction.atomic
def create_project(*, user, company, board_template=None, **fields) -> Project:
    if not is_company_manager(user, company):
        raise PermissionDenied("Only the company manager can create a project.")
    owner = fields.pop("owner", user) or user
    if board_template is not None and (
        board_template.requires_approval or board_template.is_platform
    ):
        fields.setdefault("require_approval_before_close", True)
    project = Project(company=company, owner=owner, **fields)
    project.full_clean()
    project.save()
    _ensure_project_owner_member(project)
    seed_project_columns(project, template=board_template)
    if project_requires_approval(project):
        ensure_approval_column(project)
    log_activity(
        actor=user,
        action=ActivityLog.Action.CREATED,
        entity_type="project",
        entity_id=project.id,
        description=f"پروژه «{project.name}» ساخته شد.",
        company=company,
        project=project,
    )
    return project


@transaction.atomic
def delete_project(*, user, project: Project) -> None:
    if not is_project_manager(user, project) and project.owner_id != user.id:
        raise PermissionDenied("Only the project creator or a manager can remove this project.")
    name = project.name
    company = project.company
    log_activity(
        actor=user,
        action=ActivityLog.Action.DELETED,
        entity_type="project",
        entity_id=project.id,
        description=f"پروژه «{name}» حذف شد.",
        company=company,
        project=None,
    )
    project.delete()


@transaction.atomic
def add_team_to_project(*, user, project: Project, team: Team) -> ProjectTeam:
    if not is_project_manager(user, project):
        raise PermissionDenied("Only a project manager can add a team.")
    if team.company_id != project.company_id:
        raise ValidationError({"team": "Team must belong to the same company."})
    link, created = ProjectTeam.objects.get_or_create(project=project, team=team)
    sync_team_members_onto_project(project, team)
    if created:
        log_activity(
            actor=user,
            action=ActivityLog.Action.MEMBER_ADDED,
            entity_type="project",
            entity_id=project.id,
            description=f"تیم «{team.name}» به پروژه اضافه شد.",
            company=project.company,
            project=project,
        )
    return link


@transaction.atomic
def remove_team_from_project(*, user, project: Project, team: Team) -> None:
    if not is_project_manager(user, project):
        raise PermissionDenied("Only a project manager can remove a team.")
    link = ProjectTeam.objects.filter(project=project, team=team).first()
    if link is None:
        raise ValidationError({"team": "This team is not linked to the desk."})
    team_name = team.name
    link.delete()
    leftover = list(ProjectMember.objects.filter(project=project, added_from_team=team))
    other_team_by_user: dict[int, Team] = {}
    leftover_ids = [member.user_id for member in leftover]
    if leftover_ids:
        for team_member in TeamMember.objects.filter(
            status=TeamMember.Status.ACTIVE,
            user_id__in=leftover_ids,
            team__project_links__project=project,
        ).select_related("team"):
            other_team_by_user.setdefault(team_member.user_id, team_member.team)
    for member in leftover:
        if member.user_id == project.owner_id or member.role == ProjectMember.Role.OWNER:
            member.added_from_team = None
            member.save(update_fields=["added_from_team", "updated_at"])
            continue
        other = other_team_by_user.get(member.user_id)
        if other is not None:
            member.added_from_team = other
            member.save(update_fields=["added_from_team", "updated_at"])
            continue
        member.status = ProjectMember.Status.INACTIVE
        member.added_from_team = None
        member.save(update_fields=["status", "added_from_team", "updated_at"])
    log_activity(
        actor=user,
        action=ActivityLog.Action.MEMBER_REMOVED,
        entity_type="project",
        entity_id=project.id,
        description=f"تیم «{team_name}» از میز کار برداشته شد.",
        company=project.company,
        project=project,
    )


def _require_assignable_member(project: Project, assigned) -> None:
    if assigned is None:
        return
    if assigned.project_id != project.id or assigned.status != ProjectMember.Status.ACTIVE:
        raise ValidationError({"assigned_to": "Assignee must be an active member of this desk."})


@transaction.atomic
def add_project_member(*, user, project: Project, member_user, role=None) -> ProjectMember:
    if not is_project_manager(user, project):
        raise PermissionDenied("Only a project manager can add members.")
    member, created = ProjectMember.objects.update_or_create(
        project=project,
        user=member_user,
        defaults={
            "role": role or ProjectMember.Role.MEMBER,
            "status": ProjectMember.Status.ACTIVE,
        },
    )
    if created:
        notify_user(
            recipient=member_user,
            notification_type=Notification.Type.MEMBER_CHANGED,
            title="افزوده شدن به پروژه",
            message=f"شما به پروژه «{project.name}» اضافه شدید.",
            reference_type="project",
            reference_id=project.id,
        )
        log_activity(
            actor=user,
            action=ActivityLog.Action.MEMBER_ADDED,
            entity_type="project",
            entity_id=project.id,
            description=f"{member_user.phone_number} به پروژه اضافه شد.",
            company=project.company,
            project=project,
        )
    return member


MAX_TASK_PREREQUISITES = 2


@transaction.atomic
def create_task(*, user, project: Project, labels=None, prerequisites=None, **fields) -> Task:
    if not can_add_task(user, project):
        raise PermissionDenied("Guests can view the board but cannot add work.")
    assigned = fields.get("assigned_to")
    _require_assignable_member(project, assigned)
    column = fields.pop("column", None)
    fields.pop("prerequisites", None)
    ensure_project_columns(project)
    if column is None:
        columns = list(project.board_columns.order_by("position", "id"))
        column = column_for_status(project, fields.get("status") or Task.Status.TODO)
        if column is None and columns:
            column = columns[0]
    elif column.project_id != project.id:
        raise ValidationError({"column": "Column must belong to this project."})
    task = Task(
        project=project,
        created_by=user,
        difficulty_set_by=user,
        column=column,
        **fields,
    )
    apply_column_to_task(task, column)
    task.full_clean()
    task.save()
    if labels:
        _set_task_labels(task, labels)
    if prerequisites is not None:
        _set_task_prerequisites(task, prerequisites)
    log_activity(
        actor=user,
        action=ActivityLog.Action.CREATED,
        entity_type="task",
        entity_id=task.id,
        description=f"کار «{task.title}» ساخته شد.",
        company=project.company,
        project=project,
    )
    _notify_assignment(user, task)
    return task


def _set_task_labels(task: Task, labels) -> None:
    label_list = list(labels)
    for label in label_list:
        if label.company_id != task.project.company_id:
            raise ValidationError({"labels": "Labels must belong to the same company."})
    task.labels.set(label_list)


def _task_depends_on(start: Task, target_id: int) -> bool:
    seen = {start.id}
    stack = [start]
    while stack:
        node = stack.pop()
        for other in node.prerequisites.all():
            if other.id == target_id:
                return True
            if other.id in seen:
                continue
            seen.add(other.id)
            stack.append(other)
    return False


def _set_task_prerequisites(task: Task, prerequisites) -> None:
    items = list(prerequisites or [])
    if len(items) > MAX_TASK_PREREQUISITES:
        raise ValidationError(
            {"prerequisite_ids": "A task can have at most two prerequisite tasks."}
        )
    seen_ids = set()
    for other in items:
        if other.pk == task.pk:
            raise ValidationError({"prerequisite_ids": "A task cannot depend on itself."})
        if other.project_id != task.project_id:
            raise ValidationError(
                {"prerequisite_ids": "Prerequisites must belong to the same project."}
            )
        if other.pk in seen_ids:
            continue
        if _task_depends_on(other, task.id):
            raise ValidationError(
                {"prerequisite_ids": "That would create a loop in the work flow."}
            )
        seen_ids.add(other.pk)
    task.prerequisites.set(items)
    cache = getattr(task, "_prefetched_objects_cache", None)
    if cache is not None:
        cache.pop("prerequisites", None)


def _notify_assignment(actor, task: Task):
    if not task.assigned_to_id:
        return
    assignee = task.assigned_to.user
    if assignee.id == actor.id:
        return
    manager_name = actor.get_full_name().strip() or actor.phone_number
    notify_user(
        recipient=assignee,
        notification_type=Notification.Type.TASK_ASSIGNED,
        title="کار جدید",
        message=(
            f"مدیر شما ({manager_name}) یک کار برای شما ساخت: «{task.title}». "
            "وارد تی آدیتر شوید و کار را ببینید."
        ),
        reference_type="task",
        reference_id=task.id,
        send_sms=True,
    )
    log_activity(
        actor=actor,
        action=ActivityLog.Action.ASSIGNED,
        entity_type="task",
        entity_id=task.id,
        description=f"کار به {assignee.phone_number} واگذار شد.",
        company=task.project.company,
        project=task.project,
    )


@transaction.atomic
def update_task(*, user, task: Task, **fields) -> Task:
    if not can_work_on_task(user, task):
        raise PermissionDenied("You cannot update this task.")
    fields.pop("project", None)
    labels = fields.pop("labels", None)
    prerequisites = fields.pop("prerequisites", None)
    moving = "status" in fields or "column" in fields
    if moving and not can_move_task(user, task):
        raise PermissionDenied("You cannot move this task.")
    dest_column = fields.get("column")
    if dest_column is not None and not can_move_task_to_column(user, task, dest_column):
        raise PermissionDenied("این کار باید اول تأیید شود.")
    if (
        fields.get("status") == Task.Status.DONE
        and project_requires_approval(task.project)
        and not is_project_manager(user, task.project)
    ):
        raise PermissionDenied("این کار باید اول تأیید شود.")
    if not is_project_manager(user, task.project):
        if "difficulty" in fields and fields["difficulty"] != task.difficulty:
            raise PermissionDenied("Employees cannot change task difficulty.")
        fields.pop("difficulty", None)
        fields.pop("assigned_to", None)
        fields.pop("priority", None)
        if labels is not None:
            raise PermissionDenied("Only a manager can change labels.")
    if "assigned_to" in fields:
        _require_assignable_member(task.project, fields.get("assigned_to"))

    old_assignee_id = task.assigned_to_id
    old_status = task.status
    column = fields.pop("column", None)
    for key, value in fields.items():
        setattr(task, key, value)
    if column is not None:
        if column.project_id != task.project_id:
            raise ValidationError({"column": "Column must belong to this project."})
        apply_column_to_task(task, column)
    elif "status" in fields:
        matched = column_for_status(task.project, task.status)
        if matched is not None:
            apply_column_to_task(task, matched)
    if task.status == Task.Status.DONE and not task.completed_at:
        task.completed_at = timezone.now()
    if task.status != Task.Status.DONE:
        task.completed_at = None
    if "difficulty" in fields:
        task.difficulty_set_by = user
    task.full_clean()
    task.save()
    if labels is not None:
        _set_task_labels(task, labels)
    if prerequisites is not None:
        _set_task_prerequisites(task, prerequisites)

    if fields.get("assigned_to") and task.assigned_to_id != old_assignee_id:
        _notify_assignment(user, task)
    if task.status != old_status:
        log_activity(
            actor=user,
            action=ActivityLog.Action.STATUS_CHANGED,
            entity_type="task",
            entity_id=task.id,
            description=f"وضعیت کار «{task.title}» به {task.status} تغییر کرد.",
            company=task.project.company,
            project=task.project,
        )
        if task.status == Task.Status.DONE and task.assigned_to_id:
            managers = {task.project.owner_id, task.project.company.owner_id}
            for uid in managers:
                if uid == user.id:
                    continue
                from django.contrib.auth import get_user_model

                User = get_user_model()
                recipient = User.objects.filter(pk=uid).first()
                if recipient:
                    notify_user(
                        recipient=recipient,
                        notification_type=Notification.Type.TASK_COMPLETED,
                        title="کار تمام شد",
                        message=f"«{task.title}» تکمیل شد.",
                        reference_type="task",
                        reference_id=task.id,
                    )
    return task


@transaction.atomic
def delete_task(*, user, task: Task) -> None:
    if not is_project_manager(user, task.project):
        raise PermissionDenied("Only a manager or maintainer can remove a task.")
    title = task.title
    project = task.project
    log_activity(
        actor=user,
        action=ActivityLog.Action.DELETED,
        entity_type="task",
        entity_id=task.id,
        description=f"کار «{title}» حذف شد.",
        company=project.company,
        project=project,
    )
    task.delete()


@transaction.atomic
def set_step_done(*, user, step: TaskStep, done: bool) -> TaskStep:
    if not can_work_on_task(user, step.task):
        raise PermissionDenied("You cannot update this step.")
    if not is_project_manager(user, step.task.project):
        if not step.task.assigned_to_id or step.task.assigned_to.user_id != user.id:
            raise PermissionDenied("Only the assignee can complete steps.")
    step.is_completed = done
    step.completed_by = user if done else None
    step.completed_at = timezone.now() if done else None
    step.save(update_fields=["is_completed", "completed_by", "completed_at", "updated_at"])
    if done:
        log_activity(
            actor=user,
            action=ActivityLog.Action.COMPLETED,
            entity_type="task_step",
            entity_id=step.id,
            description=f"گام «{step.title}» انجام شد.",
            company=step.task.project.company,
            project=step.task.project,
        )
    return step


@transaction.atomic
def add_task_step(*, user, task: Task, title: str, order: int | None = None) -> TaskStep:
    if not is_project_manager(user, task.project):
        raise PermissionDenied("Only a project manager can add steps.")
    if order is None:
        last = task.steps.order_by("-order").first()
        order = (last.order + 1) if last else 1
    step = TaskStep(task=task, title=title.strip(), order=order)
    step.full_clean()
    step.save()
    log_activity(
        actor=user,
        action=ActivityLog.Action.UPDATED,
        entity_type="task",
        entity_id=task.id,
        description=f"گام «{step.title}» به کار اضافه شد.",
        company=task.project.company,
        project=task.project,
    )
    return step


@transaction.atomic
def add_comment(*, user, task: Task, body: str, reply_to=None) -> TaskComment:
    if not can_work_on_task(user, task):
        raise PermissionDenied("You cannot comment on this task.")
    comment = TaskComment(task=task, author=user, body=body, reply_to=reply_to)
    comment.full_clean()
    comment.save()
    log_activity(
        actor=user,
        action=ActivityLog.Action.COMMENTED,
        entity_type="task",
        entity_id=task.id,
        description="نظر جدید ثبت شد.",
        company=task.project.company,
        project=task.project,
    )
    recipients = set()
    if task.assigned_to_id:
        recipients.add(task.assigned_to.user_id)
    recipients.add(task.created_by_id)
    recipients.discard(user.id)
    from django.contrib.auth import get_user_model

    User = get_user_model()
    for uid in recipients:
        recipient = User.objects.filter(pk=uid).first()
        if recipient:
            notify_user(
                recipient=recipient,
                notification_type=Notification.Type.TASK_COMMENT,
                title="نظر جدید",
                message=f"روی کار «{task.title}» نظر ثبت شد.",
                reference_type="task",
                reference_id=task.id,
            )
    return comment


@transaction.atomic
def create_desk(*, user, name: str, board_template=None, **fields) -> Project:
    company = workspace_for(user)
    return create_project(
        user=user,
        company=company,
        board_template=board_template,
        name=name,
        **fields,
    )


@transaction.atomic
def create_desk_team(*, user, project: Project, name: str) -> Team:
    if not is_project_manager(user, project):
        raise PermissionDenied("Only a desk manager can create a team.")
    team = create_team(user=user, company=project.company, name=name)
    add_team_to_project(user=user, project=project, team=team)
    return team


def others_chat_read_id(*, user, project: Project) -> int:
    value = (
        DeskChatCursor.objects.filter(project=project)
        .exclude(user=user)
        .aggregate(m=Max("last_read_id"))
        .get("m")
    )
    return int(value or 0)


def mark_desk_chat_seen(*, user, project: Project) -> None:
    latest = (
        DeskChatMessage.objects.filter(project=project)
        .order_by("-id")
        .values_list("id", flat=True)
        .first()
    )
    if not latest:
        return
    DeskChatCursor.objects.update_or_create(
        project=project,
        user=user,
        defaults={"last_read_id": latest},
    )


def list_desk_chat(*, user, project: Project, after_id: int | None = None, limit: int = 100):
    if not can_view_project(user, project):
        raise PermissionDenied("You cannot view this desk.")
    qs = DeskChatMessage.objects.filter(project=project).select_related(
        "author",
        "author__profile",
    )
    cap = max(1, min(int(limit or 100), 200))
    if after_id:
        return list(qs.filter(id__gt=after_id).order_by("id")[:cap])
    recent_ids = list(qs.order_by("-id").values_list("id", flat=True)[:cap])
    if not recent_ids:
        return []
    return list(qs.filter(id__in=recent_ids).order_by("id"))


CHAT_KIND_LIMITS = {
    "image": 8 * 1024 * 1024,
    "video": 40 * 1024 * 1024,
    "audio": 12 * 1024 * 1024,
    "file": 20 * 1024 * 1024,
}
CHAT_KIND_EXTS = {
    "image": {"jpg", "jpeg", "png", "gif", "webp"},
    "video": {"mp4", "webm", "mov", "m4v"},
    "audio": {"mp3", "ogg", "wav", "m4a", "aac", "weba", "webm"},
}


def _chat_file_kind(name: str, content_type: str = "") -> str:
    ext = (name or "").rsplit(".", 1)[-1].lower() if "." in (name or "") else ""
    ctype = (content_type or "").lower()
    if ext in CHAT_KIND_EXTS["image"] or ctype.startswith("image/"):
        return "image"
    if ext in {"mp4", "mov", "m4v"} or ctype.startswith("video/"):
        return "video"
    if ext in CHAT_KIND_EXTS["audio"] or ctype.startswith("audio/"):
        return "audio"
    if ext == "webm":
        return "video" if ctype.startswith("video/") else "audio"
    return "file"


def _validate_chat_file(upload) -> None:
    name = getattr(upload, "name", "") or "file"
    size = int(getattr(upload, "size", 0) or 0)
    kind = _chat_file_kind(name, getattr(upload, "content_type", "") or "")
    limit = CHAT_KIND_LIMITS[kind]
    if size <= 0:
        raise ValidationError({"file": "Empty file."})
    if size > limit:
        raise ValidationError({"file": "File is too large."})
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    allowed = CHAT_KIND_EXTS["image"] | CHAT_KIND_EXTS["video"] | CHAT_KIND_EXTS["audio"] | {
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "ppt",
        "pptx",
        "txt",
        "zip",
        "rar",
        "csv",
    }
    if ext and ext not in allowed and kind == "file":
        raise ValidationError({"file": "This file type is not allowed."})


@transaction.atomic
def post_desk_chat(*, user, project: Project, body: str = "", upload=None) -> DeskChatMessage:
    if not can_view_project(user, project):
        raise PermissionDenied("You cannot chat in this desk.")
    text = (body or "").strip()
    if upload:
        _validate_chat_file(upload)
    elif not text:
        raise ValidationError({"body": "Message is required."})
    message = DeskChatMessage(
        project=project,
        author=user,
        body=text[:2000],
        file=upload if upload else None,
        original_name=(getattr(upload, "name", "") or "")[:255] if upload else "",
        file_size=getattr(upload, "size", None) if upload else None,
    )
    message.full_clean()
    message.save()
    return message
