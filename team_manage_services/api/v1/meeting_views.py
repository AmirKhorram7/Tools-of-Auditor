"""Isolated Google Meet endpoints. Cut this file + urls if the feature is removed."""

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from team_manage_services.meetings import MEETINGS_ENABLED, ProjectMeeting
from team_manage_services.models import Project
from team_manage_services.services.access import projects_for_user
from team_manage_services.services.errors import call_service
from team_manage_services.services.meet_bridge import MEET_NEW_URL
from team_manage_services.services.meetings import (
    can_create_meeting,
    create_meeting,
    end_meeting,
    list_meetings,
    serialize_meeting,
)


def _project_for(user, project_id: int) -> Project:
    return get_object_or_404(projects_for_user(user), pk=project_id)


class ProjectMeetingListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id: int):
        if not MEETINGS_ENABLED:
            return Response({"detail": "Meetings are turned off."}, status=404)
        project = _project_for(request.user, project_id)
        rows = list_meetings(request.user, project)
        return Response(
            {
                "enabled": True,
                "can_create": can_create_meeting(request.user, project),
                "meet_new_url": MEET_NEW_URL,
                "results": [serialize_meeting(row, request.user) for row in rows],
            }
        )

    def post(self, request, project_id: int):
        if not MEETINGS_ENABLED:
            return Response({"detail": "Meetings are turned off."}, status=404)
        project = _project_for(request.user, project_id)
        meeting = call_service(
            create_meeting,
            user=request.user,
            project=project,
            title=request.data.get("title") or "",
            meet_url=request.data.get("meet_url") or "",
            audience=request.data.get("audience") or ProjectMeeting.Audience.ALL,
            user_ids=request.data.get("user_ids") or [],
        )
        return Response(serialize_meeting(meeting, request.user), status=status.HTTP_201_CREATED)


class ProjectMeetingEndView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id: int, meeting_id: int):
        if not MEETINGS_ENABLED:
            return Response({"detail": "Meetings are turned off."}, status=404)
        project = _project_for(request.user, project_id)
        meeting = get_object_or_404(ProjectMeeting, pk=meeting_id, project=project)
        meeting = call_service(end_meeting, user=request.user, meeting=meeting)
        return Response(serialize_meeting(meeting, request.user))
