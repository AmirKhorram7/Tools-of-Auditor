from django.conf import settings
from django.contrib.auth.models import Group
from django.core.exceptions import ObjectDoesNotExist

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


def _file_url(file_field) -> str:
    if not file_field:
        return ""
    try:
        return file_field.url
    except ValueError:
        return ""


def _related(user, name):
    try:
        return getattr(user, name)
    except ObjectDoesNotExist:
        return None


def teacher_name(user, profile=None) -> str:
    row = profile if profile is not None else _related(user, "teacher_profile")
    if row and row.display_name:
        return row.display_name
    name = (user.get_full_name() or "").strip()
    return name


def teacher_photo_url(user, profile=None) -> str:
    row = profile if profile is not None else _related(user, "teacher_profile")
    url = _file_url(getattr(row, "photo", None))
    if url:
        return url
    user_profile = _related(user, "profile")
    if user_profile is None:
        return ""
    return user_profile.avatar_url() or ""


def teacher_projects(profile) -> list[str]:
    if not profile or not profile.projects:
        return []
    return [line.strip() for line in profile.projects.splitlines() if line.strip()]


def teacher_card_payload(user) -> dict | None:
    if user is None:
        return None
    profile = _related(user, "teacher_profile")
    return {
        "id": user.id,
        "name": teacher_name(user, profile),
        "headline": (profile.headline if profile else "") or "",
        "photo_url": teacher_photo_url(user, profile),
    }


def teacher_profile_payload(user, profile=None) -> dict:
    row = profile if profile is not None else _related(user, "teacher_profile")
    return {
        "user": user.id,
        "name": teacher_name(user, row),
        "display_name": (row.display_name if row else "") or "",
        "headline": (row.headline if row else "") or "",
        "bio": (row.bio if row else "") or "",
        "photo_url": teacher_photo_url(user, row),
        "website": (row.website if row else "") or "",
        "linkedin_url": (row.linkedin_url if row else "") or "",
        "telegram_url": (row.telegram_url if row else "") or "",
        "instagram_url": (row.instagram_url if row else "") or "",
        "projects": teacher_projects(row),
        "projects_text": (row.projects if row else "") or "",
    }
