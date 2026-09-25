from django.conf import settings
from django.contrib.auth.models import Group

from education.models import TeacherGroup, TeacherGroupMember, TeacherProfile


def default_teacher_password() -> str:
    return getattr(settings, "TEACHER_DEFAULT_PASSWORD", "Teacher#2026")


def provision_teacher(user, *, password: str | None = None) -> dict:
    """Staff + login password so the teacher can open Wagtail. Safe to call twice."""
    flags = []
    if not user.is_staff:
        user.is_staff = True
        flags.append("is_staff")
    used_default = False
    if not user.has_login_password():
        user.set_password(password or default_teacher_password())
        flags.append("password")
        used_default = True
    if flags:
        user.save(update_fields=flags)
    if used_default:
        flags.append("used_default_password")
    group, _created = TeacherGroup.objects.get_or_create(
        name="Teachers",
        defaults={"is_active": True},
    )
    TeacherGroupMember.objects.get_or_create(
        teacher_group=group,
        member=user,
        defaults={"is_active": True},
    )
    TeacherProfile.objects.get_or_create(user=user)
    auth_group, _created = Group.objects.get_or_create(name="Teachers")
    user.groups.add(auth_group)
    from cms.services import access_service

    access_service.grant_teachers_admin_access()
    return {
        "is_staff": user.is_staff,
        "used_default_password": "used_default_password" in flags,
        "login": user.phone_number,
        "password_hint": default_teacher_password() if "used_default_password" in flags else None,
    }


def can_build_course(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    return TeacherGroupMember.objects.filter(
        member=user,
        is_active=True,
        teacher_group__is_active=True,
    ).exists()
