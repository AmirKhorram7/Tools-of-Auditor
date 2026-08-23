"""Create / end / list project Google Meet rooms. Isolated from board logic."""

from django.core.exceptions import ValidationError, PermissionDenied
from django.utils import timezone

from team_manage_services.meetings import MEETINGS_ENABLED, ProjectMeeting
from team_manage_services.models import Project, ProjectMember
from team_manage_services.services.access import (
    can_act_on_project,
    can_view_project,
    display_name,
    is_project_manager,
)
from team_manage_services.services.meet_bridge import normalize_meet_url


def _require_enabled():
    if not MEETINGS_ENABLED:
        raise PermissionDenied("Meetings are turned off.")


def can_create_meeting(user, project: Project) -> bool:
    return can_act_on_project(user, project)


def can_end_meeting(user, meeting: ProjectMeeting) -> bool:
    return (
        meeting.created_by_id == user.id
        or is_project_manager(user, meeting.project)
    )


def meeting_visible(user, meeting: ProjectMeeting) -> bool:
    if not can_view_project(user, meeting.project):
        return False
    if meeting.status == ProjectMeeting.Status.ENDED:
        return can_end_meeting(user, meeting)
    if meeting.audience == ProjectMeeting.Audience.ALL:
        return True
    if meeting.created_by_id == user.id or is_project_manager(user, meeting.project):
        return True
    return meeting.guests.filter(pk=user.pk).exists()


def list_meetings(user, project: Project):
    _require_enabled()
    if not can_view_project(user, project):
        raise PermissionDenied("You cannot see this project.")
    rows = (
        ProjectMeeting.objects.filter(project=project)
        .select_related("created_by")
        .prefetch_related("guests")
        .order_by("-started_at")[:20]
    )
    return [row for row in rows if meeting_visible(user, row)]


def create_meeting(user, project: Project, *, title: str, meet_url: str, audience: str, user_ids):
    _require_enabled()
    if not can_create_meeting(user, project):
        raise PermissionDenied("You cannot start a meeting on this project.")
    name = (title or "").strip()
    if not name:
        raise ValidationError({"title": "Meeting title is required."})
    url = normalize_meet_url(meet_url)
    kind = audience if audience in ProjectMeeting.Audience.values else ProjectMeeting.Audience.ALL
    meeting = ProjectMeeting.objects.create(
        project=project,
        title=name[:160],
        meet_url=url,
        audience=kind,
        created_by=user,
        status=ProjectMeeting.Status.LIVE,
    )
    if kind == ProjectMeeting.Audience.SELECTED:
        raw_ids = user_ids if isinstance(user_ids, (list, tuple)) else [user_ids]
        wanted = [int(item) for item in raw_ids if str(item).isdigit() or isinstance(item, int)]
        allowed = set(
            ProjectMember.objects.filter(
                project=project,
                status=ProjectMember.Status.ACTIVE,
                user_id__in=wanted,
            ).values_list("user_id", flat=True)
        )
        if project.owner_id in wanted:
            allowed.add(project.owner_id)
        if not allowed:
            meeting.delete()
            raise ValidationError({"user_ids": "Choose at least one person from this project."})
        meeting.guests.set(allowed)
    return meeting


def end_meeting(user, meeting: ProjectMeeting):
    _require_enabled()
    if not can_end_meeting(user, meeting):
        raise PermissionDenied("You cannot end this meeting.")
    if meeting.status != ProjectMeeting.Status.ENDED:
        meeting.status = ProjectMeeting.Status.ENDED
        meeting.ended_at = timezone.now()
        meeting.save(update_fields=["status", "ended_at"])
    return meeting


def serialize_meeting(meeting: ProjectMeeting, user) -> dict:
    live = meeting.status == ProjectMeeting.Status.LIVE
    can_join = live and meeting_visible(user, meeting)
    return {
        "id": meeting.id,
        "title": meeting.title,
        "status": meeting.status,
        "audience": meeting.audience,
        "meet_url": meeting.meet_url if can_join else None,
        "host_name": display_name(meeting.created_by),
        "started_at": meeting.started_at,
        "ended_at": meeting.ended_at,
        "can_end": can_end_meeting(user, meeting),
        "is_live": live,
        "guest_count": meeting.guests.count() if meeting.audience == ProjectMeeting.Audience.SELECTED else None,
    }
