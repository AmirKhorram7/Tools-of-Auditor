"""Who can see/edit companies, teams, and work projects."""

from django.db.models import Q

from team_manage_services.models import Company, CompanyMember, Project, ProjectMember

COMPANY_MANAGE_ROLES = {
    CompanyMember.Role.OWNER,
    CompanyMember.Role.ADMIN,
    CompanyMember.Role.MANAGER,
}
PROJECT_MANAGE_ROLES = {
    ProjectMember.Role.OWNER,
    ProjectMember.Role.MAINTAINER,
    ProjectMember.Role.MANAGER,
}
PROJECT_ACT_ROLES = {
    ProjectMember.Role.OWNER,
    ProjectMember.Role.MAINTAINER,
    ProjectMember.Role.MANAGER,
    ProjectMember.Role.DEVELOPER,
    ProjectMember.Role.PLANNER,
    ProjectMember.Role.MEMBER,
}


def project_role(user, project: Project) -> str | None:
    if project.owner_id == user.id:
        return ProjectMember.Role.OWNER
    row = ProjectMember.objects.filter(
        project=project,
        user=user,
        status=ProjectMember.Status.ACTIVE,
    ).first()
    return row.role if row else None


def can_act_on_project(user, project: Project) -> bool:
    """Developer / planner / maintainer / owner can add and move work. Guest cannot."""
    if is_company_manager(user, project.company):
        return True
    role = project_role(user, project)
    return role in PROJECT_ACT_ROLES


def can_add_task(user, project: Project) -> bool:
    return can_act_on_project(user, project)


def companies_for_user(user):
    return Company.objects.filter(
        Q(owner=user)
        | Q(members__user=user, members__status=CompanyMember.Status.ACTIVE)
    ).distinct()


def can_view_company(user, company: Company) -> bool:
    if company.owner_id == user.id:
        return True
    return CompanyMember.objects.filter(
        company=company,
        user=user,
        status=CompanyMember.Status.ACTIVE,
    ).exists()


def is_company_manager(user, company: Company) -> bool:
    if company.owner_id == user.id:
        return True
    return CompanyMember.objects.filter(
        company=company,
        user=user,
        status=CompanyMember.Status.ACTIVE,
        role__in=COMPANY_MANAGE_ROLES,
    ).exists()


def projects_for_user(user):
    return Project.objects.filter(
        Q(company__owner=user)
        | Q(
            company__members__user=user,
            company__members__status=CompanyMember.Status.ACTIVE,
        )
        | Q(owner=user)
        | Q(members__user=user, members__status=ProjectMember.Status.ACTIVE)
    ).distinct()


def can_view_project(user, project: Project) -> bool:
    return projects_for_user(user).filter(pk=project.pk).exists()


def is_project_manager(user, project: Project) -> bool:
    if is_company_manager(user, project.company):
        return True
    if project.owner_id == user.id:
        return True
    return ProjectMember.objects.filter(
        project=project,
        user=user,
        status=ProjectMember.Status.ACTIVE,
        role__in=PROJECT_MANAGE_ROLES,
    ).exists()


def display_name(user) -> str:
    if user is None:
        return ""
    name = user.get_full_name().strip()
    return name or user.phone_number


def is_any_manager(user) -> bool:
    if Company.objects.filter(owner=user).exists():
        return True
    if CompanyMember.objects.filter(
        user=user,
        status=CompanyMember.Status.ACTIVE,
        role__in=COMPANY_MANAGE_ROLES,
    ).exists():
        return True
    return ProjectMember.objects.filter(
        user=user,
        status=ProjectMember.Status.ACTIVE,
        role__in=PROJECT_MANAGE_ROLES,
    ).exists()


def can_work_on_task(user, task) -> bool:
    if is_project_manager(user, task.project):
        return True
    if not can_view_project(user, task.project):
        return False
    if not can_act_on_project(user, task.project):
        return False
    if task.assigned_to_id and task.assigned_to.user_id == user.id:
        return True
    return ProjectMember.objects.filter(
        project=task.project,
        user=user,
        status=ProjectMember.Status.ACTIVE,
        role__in=PROJECT_ACT_ROLES,
    ).exists()


def can_move_task(user, task) -> bool:
    """Maintainer/owner/developer/planner can move cards. Guest cannot."""
    return can_act_on_project(user, task.project)
