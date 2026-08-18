from django.contrib.auth import get_user_model
from django.db.models import Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from team_manage_services.api.v1.serializers import (
    AddProjectMemberSerializer,
    AddProjectTeamSerializer,
    AttachmentSerializer,
    CommentWriteSerializer,
    CompanyMemberSerializer,
    CompanySerializer,
    InvitationSerializer,
    InviteSerializer,
    NotificationSerializer,
    ProjectMemberSerializer,
    ProjectSerializer,
    TaskCommentSerializer,
    TaskDetailSerializer,
    TaskSerializer,
    TaskStepSerializer,
    TaskStepWriteSerializer,
    TeamMemberSerializer,
    TeamMemberUpdateSerializer,
    TeamSerializer,
)
from team_manage_services.models import (
    Invitation,
    Notification,
    Task,
    TaskComment,
    TaskStep,
    Team,
    TeamMember,
)
from team_manage_services.repositories.employee_dashboard import employee_dashboard
from team_manage_services.repositories.manager_dashboard import manager_dashboard
from team_manage_services.repositories.timeline import timeline_for_user
from team_manage_services.services.access import (
    can_work_on_task,
    companies_for_user,
    is_any_manager,
    is_company_manager,
    is_project_manager,
    projects_for_user,
)
from team_manage_services.services.errors import call_service
from team_manage_services.services.org import (
    create_company,
    create_team,
    invite_to_team,
    respond_to_invitation,
)
from team_manage_services.services.work import (
    add_comment,
    add_project_member,
    add_task_step,
    add_team_to_project,
    create_project,
    create_task,
    set_step_done,
    update_task,
)

User = get_user_model()


def _q(name, description, typ=OpenApiTypes.STR):
    return OpenApiParameter(name, typ, OpenApiParameter.QUERY, description=description)


def _int_param(request, name):
    raw = request.query_params.get(name)
    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError) as exc:
        raise ValidationError({name: "Must be an integer."}) from exc


@extend_schema(tags=["Work Companies"])
@extend_schema_view(
    list=extend_schema(
        summary="List my companies",
        description="Companies you own or are an active member of. One user can own several companies (including a holding with one-level sub-companies).",
    ),
    retrieve=extend_schema(summary="Get company"),
    create=extend_schema(
        summary="Create a company",
        description=(
            "Any authenticated user. You become **owner**. "
            "Optional `parent` = holding company (one level only; you must manage the parent)."
        ),
    ),
    partial_update=extend_schema(
        summary="Update company",
        description="Owner / admin / manager of this company only.",
    ),
)
class CompanyViewSet(viewsets.ModelViewSet):
    """Org root. Base: `/api/v1/work/companies/`"""
    permission_classes = [IsAuthenticated]
    serializer_class = CompanySerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return companies_for_user(self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parent = serializer.validated_data.get("parent")
        company = call_service(
            create_company,
            user=request.user,
            name=serializer.validated_data["name"],
            parent=parent,
        )
        return Response(self.get_serializer(company).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        company = self.get_object()
        if not is_company_manager(request.user, company):
            raise PermissionDenied("Only the company manager can update this company.")
        return super().partial_update(request, *args, **kwargs)

    def perform_update(self, serializer):
        instance = serializer.instance
        for attr, value in serializer.validated_data.items():
            setattr(instance, attr, value)
        call_service(instance.full_clean)
        instance.save()

    @extend_schema(
        summary="List company members",
        responses={200: CompanyMemberSerializer(many=True)},
    )
    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        company = self.get_object()
        qs = company.members.select_related("user").order_by("role", "id")
        return Response(CompanyMemberSerializer(qs, many=True).data)


@extend_schema(tags=["Work Teams"])
@extend_schema_view(
    list=extend_schema(
        summary="List teams",
        description="Teams in companies you can see.",
        parameters=[_q("company", "Filter by company id.", OpenApiTypes.INT)],
    ),
    retrieve=extend_schema(summary="Get team"),
    create=extend_schema(
        summary="Create a team",
        description="Company manager only. Body: `{company, name}`. Creator is added as a team member.",
    ),
    partial_update=extend_schema(
        summary="Update team",
        description="Company manager only.",
    ),
)
class TeamViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TeamSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = Team.objects.filter(
            company_id__in=companies_for_user(self.request.user).values("id")
        ).select_related("company", "owner")
        company_id = _int_param(self.request, "company")
        if company_id:
            qs = qs.filter(company_id=company_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        team = call_service(
            create_team,
            user=request.user,
            company=serializer.validated_data["company"],
            name=serializer.validated_data["name"],
        )
        return Response(self.get_serializer(team).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        team = self.get_object()
        if not is_company_manager(request.user, team.company):
            raise PermissionDenied("Only the company manager can update this team.")
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(
        summary="List team members",
        responses={200: TeamMemberSerializer(many=True)},
    )
    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        team = self.get_object()
        qs = team.members.select_related("user", "user__profile").order_by("id")
        return Response(TeamMemberSerializer(qs, many=True).data)

    @extend_schema(
        summary="Invite to team by phone",
        description=(
            "Company manager only. `{phone_number, position_title}`.\n"
            "- Registered user → in-app invitation notification\n"
            "- Unknown phone → SMS hook (logged until bulk SMS is configured)\n"
            "After they log in, pending invites attach automatically."
        ),
        request=InviteSerializer,
        responses={201: InvitationSerializer},
    )
    @action(detail=True, methods=["post"])
    def invite(self, request, pk=None):
        team = self.get_object()
        serializer = InviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = call_service(
            invite_to_team,
            user=request.user,
            team=team,
            phone_number=serializer.validated_data["phone_number"],
            position_title=serializer.validated_data.get("position_title", ""),
        )
        return Response(
            InvitationSerializer(invitation).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="Update a team member",
        description="Company manager only. `{position_title?, status?}` (`active` | `inactive`).",
        request=TeamMemberUpdateSerializer,
        responses={200: TeamMemberSerializer},
    )
    @action(
        detail=True,
        methods=["patch"],
        url_path=r"members/(?P<member_id>[^/.]+)",
    )
    def update_member(self, request, pk=None, member_id=None):
        team = self.get_object()
        if not is_company_manager(request.user, team.company):
            raise PermissionDenied("Only the company manager can update team members.")
        member = (
            TeamMember.objects.filter(pk=member_id, team=team)
            .select_related("user", "user__profile")
            .first()
        )
        if member is None:
            raise ValidationError({"member_id": "Member not found."})
        serializer = TeamMemberUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for attr, value in serializer.validated_data.items():
            setattr(member, attr, value)
        member.save()
        return Response(TeamMemberSerializer(member).data)


@extend_schema(tags=["Work Invitations"])
@extend_schema_view(
    list=extend_schema(
        summary="List invitations",
        description=(
            "`scope=inbox` (default): invites for **you** (by user or phone).\n"
            "`scope=sent`: invites you sent."
        ),
        parameters=[_q("scope", "`inbox` (default) or `sent`.")],
    ),
    retrieve=extend_schema(summary="Get invitation"),
)
class InvitationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvitationSerializer

    def get_queryset(self):
        user = self.request.user
        scope = self.request.query_params.get("scope", "inbox")
        qs = Invitation.objects.select_related(
            "team", "team__company", "invited_by", "invited_user"
        )
        if scope == "sent":
            return qs.filter(invited_by=user)
        return qs.filter(Q(invited_user=user) | Q(phone_number=user.phone_number)).distinct()

    @extend_schema(
        summary="Accept invitation",
        description="Joins the team (with `position_title`) and the company as employee. Phone must match.",
        responses={200: InvitationSerializer},
    )
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        invitation = call_service(
            respond_to_invitation,
            user=request.user,
            invitation=self.get_object(),
            accept=True,
        )
        return Response(self.get_serializer(invitation).data)

    @extend_schema(
        summary="Reject invitation",
        responses={200: InvitationSerializer},
    )
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        invitation = call_service(
            respond_to_invitation,
            user=request.user,
            invitation=self.get_object(),
            accept=False,
        )
        return Response(self.get_serializer(invitation).data)


@extend_schema(tags=["Work Projects"])
@extend_schema_view(
    list=extend_schema(
        summary="List work projects",
        description="Projects in companies/teams you can see. `progress_percent` is weighted by task difficulty (1–5).",
        parameters=[_q("company", "Filter by company id.", OpenApiTypes.INT)],
    ),
    retrieve=extend_schema(summary="Get work project"),
    create=extend_schema(
        summary="Create work project",
        description="Company manager only. You become project owner. This is **not** the documentation `projects` API.",
    ),
    partial_update=extend_schema(
        summary="Update work project",
        description="Project manager or company manager.",
    ),
)
class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = projects_for_user(self.request.user).select_related("company", "owner")
        company_id = _int_param(self.request, "company")
        if company_id:
            qs = qs.filter(company_id=company_id)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        company = data.pop("company")
        project = call_service(create_project, user=request.user, company=company, **data)
        return Response(self.get_serializer(project).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        project = self.get_object()
        if not is_project_manager(request.user, project):
            raise PermissionDenied("Only a project manager can update this project.")
        return super().partial_update(request, *args, **kwargs)

    def perform_update(self, serializer):
        instance = serializer.instance
        for attr, value in serializer.validated_data.items():
            setattr(instance, attr, value)
        call_service(instance.full_clean)
        instance.save()

    @extend_schema(
        methods=["GET"],
        operation_id="work_projects_members_list",
        summary="List project members",
        responses={200: ProjectMemberSerializer(many=True)},
    )
    @extend_schema(
        methods=["POST"],
        operation_id="work_projects_members_add",
        summary="Add a person to the project",
        description="Project manager only. `{user_id, role}` (`owner` | `manager` | `member`).",
        request=AddProjectMemberSerializer,
        responses={201: ProjectMemberSerializer},
    )
    @action(detail=True, methods=["get", "post"])
    def members(self, request, pk=None):
        project = self.get_object()
        if request.method == "GET":
            qs = project.members.select_related("user").order_by("role", "id")
            return Response(ProjectMemberSerializer(qs, many=True).data)
        serializer = AddProjectMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member_user = User.objects.filter(pk=serializer.validated_data["user_id"]).first()
        if member_user is None:
            raise ValidationError({"user_id": "User not found."})
        member = call_service(
            add_project_member,
            user=request.user,
            project=project,
            member_user=member_user,
            role=serializer.validated_data.get("role"),
        )
        return Response(ProjectMemberSerializer(member).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Add a whole team to the project",
        description="Project manager only. `{team_id}` — team must be in the same company. Active team members become project members. Returns the member list.",
        request=AddProjectTeamSerializer,
        responses={200: ProjectMemberSerializer(many=True)},
    )
    @action(detail=True, methods=["post"], url_path="add-team")
    def add_team(self, request, pk=None):
        project = self.get_object()
        serializer = AddProjectTeamSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        team = Team.objects.filter(pk=serializer.validated_data["team_id"]).first()
        if team is None:
            raise ValidationError({"team_id": "Team not found."})
        call_service(add_team_to_project, user=request.user, project=project, team=team)
        qs = project.members.select_related("user")
        return Response(ProjectMemberSerializer(qs, many=True).data)


@extend_schema(tags=["Work Tasks"])
@extend_schema_view(
    list=extend_schema(
        summary="List tasks",
        description="Tasks on work projects you can see. `assigned_to` is a **project member id** (not a user id), and may be null (plan first, assign later).",
        parameters=[
            _q("project", "Filter by work project id.", OpenApiTypes.INT),
            _q("mine", "If true, only tasks assigned to you.", OpenApiTypes.BOOL),
        ],
        responses={200: TaskSerializer},
    ),
    retrieve=extend_schema(
        summary="Get task (steps + comments)",
        responses={200: TaskDetailSerializer},
    ),
    create=extend_schema(
        summary="Create task",
        description=(
            "Project manager only. `difficulty` 1–5 is the weight for project progress (manager-only later). "
            "Assigning someone sends an in-app notification and SMS hook."
        ),
        request=TaskSerializer,
        responses={201: TaskSerializer},
    ),
    partial_update=extend_schema(
        summary="Update task",
        description=(
            "Assignee / project member can change status and similar fields. "
            "**Employees cannot change `difficulty`.** Managers can reassign (`assigned_to` = project member id)."
        ),
        request=TaskSerializer,
        responses={200: TaskSerializer},
    ),
)
class TaskViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TaskDetailSerializer
        return TaskSerializer

    def get_queryset(self):
        qs = (
            Task.objects.filter(project__in=projects_for_user(self.request.user))
            .select_related(
                "project",
                "assigned_to",
                "assigned_to__user",
                "created_by",
            )
            .prefetch_related("steps")
        )
        if self.action == "retrieve":
            qs = qs.prefetch_related("comments__author", "comments__attachments")
        project_id = _int_param(self.request, "project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        if self.request.query_params.get("mine", "").lower() in ("1", "true", "yes"):
            qs = qs.filter(assigned_to__user=self.request.user)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        project = data.pop("project")
        task = call_service(create_task, user=request.user, project=project, **data)
        return Response(TaskSerializer(task, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.get("partial", False)
        task = self.get_object()
        serializer = self.get_serializer(task, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        task = call_service(
            update_task, user=request.user, task=task, **serializer.validated_data
        )
        return Response(self.get_serializer(task).data)

    @extend_schema(
        methods=["GET"],
        operation_id="work_tasks_steps_list",
        summary="List task steps",
        description="If a task has no steps, progress is 0 until status is `done` (then 100%). With steps: completed/total.",
        responses={200: TaskStepSerializer(many=True)},
    )
    @extend_schema(
        methods=["POST"],
        operation_id="work_tasks_steps_create",
        summary="Add a task step",
        description="Project manager only. `order` is auto-incremented if omitted.",
        request=TaskStepWriteSerializer,
        responses={201: TaskStepSerializer},
    )
    @action(detail=True, methods=["get", "post"])
    def steps(self, request, pk=None):
        task = self.get_object()
        if request.method == "GET":
            return Response(TaskStepSerializer(task.steps.all(), many=True).data)
        serializer = TaskStepWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        step = call_service(
            add_task_step,
            user=request.user,
            task=task,
            title=serializer.validated_data["title"],
            order=serializer.validated_data.get("order"),
        )
        return Response(TaskStepSerializer(step).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Mark a step done / not done",
        description="Assignee or project manager. Body: `{is_completed: true|false}`.",
        responses={200: TaskStepSerializer},
    )
    @action(
        detail=True,
        methods=["patch"],
        url_path=r"steps/(?P<step_id>[^/.]+)",
    )
    def update_step(self, request, pk=None, step_id=None):
        task = self.get_object()
        step = TaskStep.objects.filter(pk=step_id, task=task).first()
        if step is None:
            raise ValidationError({"step_id": "Step not found."})
        if "is_completed" in request.data:
            raw = request.data.get("is_completed")
            if isinstance(raw, str):
                done = raw.lower() in ("1", "true", "yes")
            else:
                done = bool(raw)
            step = call_service(
                set_step_done,
                user=request.user,
                step=step,
                done=done,
            )
        return Response(TaskStepSerializer(step).data)

    @extend_schema(
        methods=["GET"],
        operation_id="work_tasks_comments_list",
        summary="List task comments",
        responses={200: TaskCommentSerializer(many=True)},
    )
    @extend_schema(
        methods=["POST"],
        operation_id="work_tasks_comments_create",
        summary="Add a comment or reply",
        description="`{body, reply_to?}`. `reply_to` is another comment id on the same task.",
        request=CommentWriteSerializer,
        responses={201: TaskCommentSerializer},
    )
    @action(detail=True, methods=["get", "post"])
    def comments(self, request, pk=None):
        task = self.get_object()
        if request.method == "GET":
            qs = task.comments.select_related("author").prefetch_related("attachments")
            return Response(TaskCommentSerializer(qs, many=True).data)
        serializer = CommentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reply_to = None
        reply_id = serializer.validated_data.get("reply_to")
        if reply_id:
            reply_to = TaskComment.objects.filter(pk=reply_id, task=task).first()
            if reply_to is None:
                raise ValidationError({"reply_to": "Comment not found on this task."})
        comment = call_service(
            add_comment,
            user=request.user,
            task=task,
            body=serializer.validated_data["body"],
            reply_to=reply_to,
        )
        return Response(TaskCommentSerializer(comment).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Work Tasks"])
class CommentAttachmentViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = AttachmentSerializer
    queryset = TaskComment.objects.all()

    def get_queryset(self):
        return TaskComment.objects.filter(
            task__project__in=projects_for_user(self.request.user)
        )

    @extend_schema(
        summary="Attach a file to a comment",
        description="`multipart/form-data` field `file`. Path: `POST /api/v1/work/comments/{id}/attachments/`.",
        request=AttachmentSerializer,
        responses={201: AttachmentSerializer},
    )
    @action(detail=True, methods=["post"], url_path="attachments")
    def attachments(self, request, pk=None):
        comment = self.get_object()
        if not can_work_on_task(request.user, comment.task):
            raise PermissionDenied("You cannot attach files to this comment.")
        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "A file is required."})
        attachment = comment.attachments.create(
            file=upload,
            original_name=getattr(upload, "name", "")[:255],
            uploaded_by=request.user,
            file_size=getattr(upload, "size", None),
        )
        return Response(AttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Work Notifications"])
@extend_schema_view(
    list=extend_schema(
        summary="List my inbox",
        description="Newest first. Timeline due-dates can later create `deadline` rows here.",
        parameters=[_q("unread", "If true, only unread.", OpenApiTypes.BOOL)],
    ),
    retrieve=extend_schema(summary="Get notification"),
)
class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user)
        unread = self.request.query_params.get("unread", "").lower()
        if unread in ("1", "true", "yes"):
            qs = qs.filter(is_read=False)
        return qs

    @extend_schema(summary="Unread count")
    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        return Response({"unread": count})

    @extend_schema(summary="Mark one notification read")
    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read", "updated_at"])
        return Response(self.get_serializer(notification).data)

    @extend_schema(summary="Mark all notifications read")
    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True)
        return Response({"updated": updated})


@extend_schema(
    tags=["Work Dashboard"],
    summary="Work dashboard (employee + manager + timeline)",
    description=(
        "Not paginated. Always includes `timeline` so notifications can reuse the same feed later.\n\n"
        "`GET /api/v1/work/dashboard/?company=&project=`\n\n"
        "- `employee`: `today`, `overdue`, `assigned`, `counts` (your open tasks)\n"
        "- `manager`: null unless you manage a company/project. Then `projects` (weighted progress), "
        "`at_risk`, `unassigned_count`, `workload`, `pending_invites`, `completed_this_week`\n"
        "- `timeline.due`: overdue + due in 14 days (`kind` overdue|due, `notification_type` deadline)\n"
        "- `timeline.activity`: فعالیت log\n"
        "- `timeline.items`: mixed feed sorted by time"
    ),
    parameters=[
        _q("company", "Filter manager + timeline by company id.", OpenApiTypes.INT),
        _q("project", "Filter timeline by work project id.", OpenApiTypes.INT),
    ],
)
class WorkDashboardView(APIView):
    """Employee + manager widgets, always including timeline for later notifications."""

    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get(self, request):
        company_id = _int_param(request, "company")
        project_id = _int_param(request, "project")
        timeline = timeline_for_user(
            request.user, company_id=company_id, project_id=project_id
        )
        employee = employee_dashboard(request.user)
        manager = None
        if is_any_manager(request.user):
            manager = manager_dashboard(request.user, company_id=company_id)
        return Response(
            {
                "is_manager": manager is not None,
                "employee": employee,
                "manager": manager,
                "timeline": timeline,
            }
        )


@extend_schema(
    tags=["Work Dashboard"],
    summary="Timeline feed (activity + due dates)",
    description=(
        "Same `timeline` object as the dashboard. Use this later to generate inbox/SMS deadline notifications.\n\n"
        "Each item: `id`, `kind` (activity|due|overdue), `occurred_at`, `title`, `message`, "
        "`entity_type`, `entity_id`, `project_id`, `company_id`, `notification_type`, `reference_type`, `reference_id`."
    ),
    parameters=[
        _q("company", "Filter by company id.", OpenApiTypes.INT),
        _q("project", "Filter by work project id.", OpenApiTypes.INT),
    ],
)
class WorkTimelineView(APIView):
    """Standalone timeline feed — reused later to generate user notifications."""

    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get(self, request):
        company_id = _int_param(request, "company")
        project_id = _int_param(request, "project")
        return Response(
            timeline_for_user(
                request.user, company_id=company_id, project_id=project_id
            )
        )
