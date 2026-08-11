"""
Project-level sharing helpers.

Access is always evaluated on the root project. Sub-projects and processes
inherit the same membership (owner / editor / viewer).
"""

from __future__ import annotations

from django.db.models import Q, QuerySet

from system_explanation_services.models import Process, Project, ProjectMember

ROLE_OWNER = ProjectMember.Role.OWNER
ROLE_EDITOR = ProjectMember.Role.EDITOR
ROLE_VIEWER = ProjectMember.Role.VIEWER

EDIT_ROLES = {ROLE_OWNER, ROLE_EDITOR}
MANAGE_ROLES = {ROLE_OWNER}
VIEW_ROLES = {ROLE_OWNER, ROLE_EDITOR, ROLE_VIEWER}


def get_root_project(project: Project) -> Project:
    if project.parent_id is None:
        return project
    return project.parent


def accessible_root_ids(user) -> QuerySet:
    """IDs of root projects the user owns or is a member of."""
    return (
        Project.objects.filter(parent__isnull=True)
        .filter(Q(owner=user) | Q(memberships__user=user))
        .values_list("id", flat=True)
        .distinct()
    )


def projects_for_user(user) -> QuerySet:
    """Root + sub-projects the user can see."""
    root_ids = accessible_root_ids(user)
    return Project.objects.filter(
        Q(id__in=root_ids) | Q(parent_id__in=root_ids)
    ).distinct()


def processes_for_user(user) -> QuerySet:
    root_ids = accessible_root_ids(user)
    return Process.objects.filter(
        Q(project_id__in=root_ids) | Q(project__parent_id__in=root_ids)
    ).distinct()


def user_role_on_project(user, project: Project) -> str | None:
    """Return owner/editor/viewer or None if no access."""
    root = get_root_project(project)
    if root.owner_id == user.id:
        return ROLE_OWNER
    membership = (
        ProjectMember.objects.filter(project=root, user=user)
        .values_list("role", flat=True)
        .first()
    )
    return membership


def can_view_project(user, project: Project) -> bool:
    return user_role_on_project(user, project) in VIEW_ROLES


def can_edit_project(user, project: Project) -> bool:
    return user_role_on_project(user, project) in EDIT_ROLES


def can_manage_members(user, project: Project) -> bool:
    return user_role_on_project(user, project) in MANAGE_ROLES


def can_delete_project(user, project: Project) -> bool:
    """Only the owner may delete a root; editors may delete content they can edit."""
    role = user_role_on_project(user, project)
    if project.parent_id is None:
        return role == ROLE_OWNER
    return role in EDIT_ROLES


def ensure_owner_membership(project: Project, user=None) -> ProjectMember:
    """Create the owner membership row for a root project (idempotent)."""
    root = get_root_project(project)
    owner = user or root.owner
    member, _ = ProjectMember.objects.get_or_create(
        project=root,
        user=owner,
        defaults={"role": ROLE_OWNER, "invited_by": owner},
    )
    if member.role != ROLE_OWNER:
        member.role = ROLE_OWNER
        member.save(update_fields=["role", "updated_at"])
    return member
