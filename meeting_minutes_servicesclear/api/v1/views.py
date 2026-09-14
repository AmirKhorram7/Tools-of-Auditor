from django.db.models import Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from meeting_minutes_servicesclear.api.v1.serializers import (
    CarryOverSerializer,
    CompanySerializer,
    GroupMemberSerializer,
    GroupMemberUpdateSerializer,
    GroupSerializer,
    InvitationSerializer,
    InviteSerializer,
    MeetingItemSerializer,
    MeetingListSerializer,
    MeetingSerializer,
)
from meeting_minutes_servicesclear.models import (
    Company,
    Group,
    GroupInvitation,
    GroupMember,
    MeetingItem,
)
from meeting_minutes_servicesclear.services.company import CompanyService
from meeting_minutes_servicesclear.services.groups import GroupService
from meeting_minutes_servicesclear.services.meetings_minutes import MeetingService

company_service = CompanyService()
group_service = GroupService()
meeting_service = MeetingService()


def _q(name, description, typ=OpenApiTypes.STR):
    return OpenApiParameter(name, typ, OpenApiParameter.QUERY, description=description)


@extend_schema(tags=["Minutes Companies"])
@extend_schema_view(
    list=extend_schema(
        summary="List my companies",
        description="Companies you created. One user can own several companies.",
    ),
    retrieve=extend_schema(summary="Get a company"),
    create=extend_schema(
        summary="Create a company",
        description=(
            "Any authenticated user. You become **owner**.\n\n"
            "Body: `{name, parent?}`. `parent` is optional (one-level holding only)."
        ),
    ),
    partial_update=extend_schema(
        summary="Update a company",
        description="Owner only. Body: `{name?, parent?, status?}`.",
    ),
    destroy=extend_schema(
        summary="Delete a company",
        description="Owner only. Soft-delete (sets `inactive`).",
    ),
)
class CompanyViewSet(viewsets.ModelViewSet):
    """Base: `/api/v1/minutes/companies/`"""

    permission_classes = [IsAuthenticated]
    serializer_class = CompanySerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return company_service.companies_for_user(self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = company_service.create_company(
            user=request.user,
            name=serializer.validated_data["name"],
            parent=serializer.validated_data.get("parent"),
        )
        return Response(self.get_serializer(company).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        company = self.get_object()
        serializer = self.get_serializer(company, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        company = company_service.update_company(
            user=request.user,
            company=company,
            **serializer.validated_data,
        )
        return Response(self.get_serializer(company).data)

    def destroy(self, request, *args, **kwargs):
        company_service.delete_company(user=request.user, company=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Minutes Groups"])
@extend_schema_view(
    list=extend_schema(
        summary="List my groups",
        description="Groups in companies you own, plus groups you are an active member of.",
        parameters=[_q("company", "Filter by company id.", OpenApiTypes.INT)],
    ),
    retrieve=extend_schema(summary="Get a group"),
    create=extend_schema(
        summary="Create a group",
        description="Company owner only. Body: `{company, name}`. Creator is added as group **owner**. The first group in a company is set as `is_default` automatically.",
    ),
    partial_update=extend_schema(
        summary="Update a group",
        description=(
            "Company owner only. Body: `{name?, status?, is_default?}`.\n\n"
            "`is_default: true` makes this the default group for new meeting minutes "
            "and turns the previous default **off**. Only one default per company."
        ),
    ),
    destroy=extend_schema(
        summary="Delete a group",
        description="Company owner only. Soft-delete (sets `archived`).",
    ),
)
class GroupViewSet(viewsets.ModelViewSet):
    """Base: `/api/v1/minutes/groups/`"""

    permission_classes = [IsAuthenticated]
    serializer_class = GroupSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        company = None
        company_id = self.request.query_params.get("company")
        if company_id:
            company = Company.objects.filter(pk=company_id, deleted_at__isnull=True).first()
        return group_service.groups_for_user(self.request.user, company=company)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = group_service.create_group(
            user=request.user,
            company=serializer.validated_data["company"],
            name=serializer.validated_data["name"],
        )
        return Response(self.get_serializer(group).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        group = self.get_object()
        serializer = self.get_serializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        group = group_service.update_group(
            user=request.user,
            group=group,
            **serializer.validated_data,
        )
        return Response(self.get_serializer(group).data)

    def destroy(self, request, *args, **kwargs):
        group_service.delete_group(user=request.user, group=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        summary="List group members",
        responses={200: GroupMemberSerializer(many=True)},
    )
    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        group = self.get_object()
        qs = (
            group.members.filter(
                status=GroupMember.Status.ACTIVE,
                deleted_at__isnull=True,
            )
            .select_related("user")
            .order_by("role", "id")
        )
        return Response(GroupMemberSerializer(qs, many=True).data)

    @extend_schema(
        summary="Invite to group by phone",
        description=(
            "Owner or maintainer. Body: `{phone_number, role?, position_title?}`.\n\n"
            "- Role: `maintainer` or `guest` (default `guest`).\n"
            "- If the phone is already registered, they see the invite in `/invitations/`.\n"
            "- If not, the invite is stored and attached when they log in with that phone."
        ),
        request=InviteSerializer,
        responses={201: InvitationSerializer},
    )
    @action(detail=True, methods=["post"])
    def invite(self, request, pk=None):
        group = self.get_object()
        serializer = InviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = group_service.invite(
            user=request.user,
            group=group,
            **serializer.validated_data,
        )
        return Response(InvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        methods=["PATCH"],
        summary="Update a group member",
        description="Owner or maintainer. Body: `{role?, status?, position_title?}`. Cannot change the group owner.",
        request=GroupMemberUpdateSerializer,
        responses={200: GroupMemberSerializer},
    )
    @extend_schema(
        methods=["DELETE"],
        summary="Remove a group member",
        description="Owner or maintainer. Soft-delete. Cannot remove the group owner.",
    )
    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"members/(?P<member_id>[^/.]+)",
    )
    def member_detail(self, request, pk=None, member_id=None):
        group = self.get_object()
        member = group.members.filter(pk=member_id, deleted_at__isnull=True).first()
        if member is None:
            raise ValidationError({"member_id": "Member not found."})
        if request.method == "DELETE":
            group_service.remove_member(user=request.user, group=group, member=member)
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = GroupMemberUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        member = group_service.update_member(
            user=request.user,
            group=group,
            member=member,
            **serializer.validated_data,
        )
        return Response(GroupMemberSerializer(member).data)


@extend_schema(tags=["Minutes Invitations"])
@extend_schema_view(
    list=extend_schema(
        summary="List invitations",
        description=(
            "`scope=inbox` (default): invites for **you** (by user or phone).\n"
            "`scope=sent`: invites you sent."
        ),
        parameters=[_q("scope", "`inbox` (default) or `sent`.")],
    ),
    retrieve=extend_schema(summary="Get an invitation"),
)
class InvitationViewSet(viewsets.ReadOnlyModelViewSet):
    """Base: `/api/v1/minutes/invitations/`"""

    permission_classes = [IsAuthenticated]
    serializer_class = InvitationSerializer

    def get_queryset(self):
        user = self.request.user
        scope = self.request.query_params.get("scope", "inbox")
        qs = GroupInvitation.objects.select_related(
            "group", "group__company", "invited_by", "invited_user"
        )
        if scope == "sent":
            return qs.filter(invited_by=user)
        return qs.filter(Q(invited_user=user) | Q(phone_number=user.phone_number)).distinct()

    @extend_schema(
        summary="Accept invitation",
        description="Joins the group with the invited role. Phone must match.",
        responses={200: InvitationSerializer},
    )
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        invitation = group_service.respond(
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
        invitation = group_service.respond(
            user=request.user,
            invitation=self.get_object(),
            accept=False,
        )
        return Response(self.get_serializer(invitation).data)


@extend_schema(tags=["Minutes Meetings"])
@extend_schema_view(
    list=extend_schema(
        summary="List meeting minutes",
        description=(
            "Minutes in groups you can see. List returns the **header** only "
            "(no item lines). Use retrieve for the full board."
        ),
        parameters=[_q("group", "Filter by group id.", OpenApiTypes.INT)],
    ),
    retrieve=extend_schema(
        summary="Get meeting minutes (header + items)",
        description=(
            "Header: company, group, date, clerk, meeting number, status.\n"
            "Each item includes `remaining_days` and `is_overdue`."
        ),
    ),
    create=extend_schema(
        summary="Create meeting minutes",
        description=(
            "Owner or maintainer of the group. Body: `{group, name?, date?, description?}`.\n"
            "`meeting_number` is assigned automatically. `date` defaults to today. "
            "`name` defaults to the group name."
        ),
    ),
    partial_update=extend_schema(
        summary="Update meeting header",
        description="Owner or maintainer. Body: `{name?, date?, description?, group?}`. "
        "Group change must stay in the same company.",
    ),
    destroy=extend_schema(
        summary="Delete meeting minutes",
        description="Owner or maintainer. Soft-delete.",
    ),
)
class MeetingViewSet(viewsets.ModelViewSet):
    """Base: `/api/v1/minutes/meetings/`"""

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return MeetingListSerializer
        return MeetingSerializer

    def get_queryset(self):
        group = None
        group_id = self.request.query_params.get("group")
        if group_id:
            group = Group.objects.filter(pk=group_id, deleted_at__isnull=True).first()
        return meeting_service.meetings_for_user(self.request.user, group=group)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting = meeting_service.create_meeting(
            user=request.user,
            group=serializer.validated_data["group"],
            name=serializer.validated_data.get("name", ""),
            meeting_date=serializer.validated_data.get("date"),
            description=serializer.validated_data.get("description", ""),
        )
        return Response(self.get_serializer(meeting).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        meeting = meeting_service.get_meeting(request.user, kwargs["pk"])
        data = self.get_serializer(meeting).data
        data["items"] = MeetingItemSerializer(
            meeting_service.items_for_meeting(request.user, meeting),
            many=True,
            context=self.get_serializer_context(),
        ).data
        return Response(data)

    def partial_update(self, request, *args, **kwargs):
        meeting = meeting_service.get_meeting(request.user, kwargs["pk"])
        serializer = self.get_serializer(meeting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        meeting = meeting_service.update_meeting(
            user=request.user,
            meeting=meeting,
            **serializer.validated_data,
        )
        return Response(self.get_serializer(meeting).data)

    def destroy(self, request, *args, **kwargs):
        meeting = meeting_service.get_meeting(request.user, kwargs["pk"])
        meeting_service.delete_meeting(user=request.user, meeting=meeting)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        summary="Close meeting minutes",
        description=(
            "Marks the session as finished. No new lines can be added after close. "
            "Assignees can still update status. Use carry-over for unfinished jobs."
        ),
        request=None,
        responses={200: MeetingSerializer},
    )
    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        meeting = meeting_service.close_meeting(
            user=request.user,
            meeting=meeting_service.get_meeting(request.user, pk),
        )
        return Response(self.get_serializer(meeting).data)

    @extend_schema(
        methods=["GET"],
        summary="List meeting items",
        responses={200: MeetingItemSerializer(many=True)},
    )
    @extend_schema(
        methods=["POST"],
        summary="Add a meeting item",
        description=(
            "Owner or maintainer, and only while the meeting is **open**.\n\n"
            "Body: `{title, description?, priority?, due_date?, assignee_ids?}`.\n"
            "`priority`: 1 low, 2 medium, 3 high, 4 critical.\n"
            "`assignee_ids`: GroupMember ids from this group."
        ),
        request=MeetingItemSerializer,
        responses={201: MeetingItemSerializer},
    )
    @action(detail=True, methods=["get", "post"])
    def items(self, request, pk=None):
        meeting = meeting_service.get_meeting(request.user, pk)
        ctx = self.get_serializer_context()
        if request.method == "GET":
            rows = meeting_service.items_for_meeting(request.user, meeting)
            return Response(MeetingItemSerializer(rows, many=True, context=ctx).data)
        serializer = MeetingItemSerializer(data=request.data, context=ctx)
        serializer.is_valid(raise_exception=True)
        item = meeting_service.create_item(
            user=request.user,
            meeting=meeting,
            title=serializer.validated_data["title"],
            description=serializer.validated_data.get("description", ""),
            priority=serializer.validated_data.get("priority", MeetingItem.Priority.MEDIUM),
            due_date=serializer.validated_data.get("due_date"),
            assignee_ids=serializer.validated_data.get("assignee_ids"),
        )
        return Response(
            MeetingItemSerializer(item, context=ctx).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        methods=["PATCH"],
        summary="Update a meeting item",
        description=(
            "Clerk (owner/maintainer): can edit subject, description, priority, due date, assignees, status.\n"
            "Assignee: `{status}` only (`created` | `in_progress` | `test` | `completed`). "
            "Only a clerk can set `cancelled`."
        ),
        request=MeetingItemSerializer,
        responses={200: MeetingItemSerializer},
    )
    @extend_schema(
        methods=["DELETE"],
        summary="Delete a meeting item",
        description="Owner or maintainer. Soft-delete.",
    )
    @action(detail=True, methods=["patch", "delete"], url_path=r"items/(?P<item_id>[^/.]+)")
    def item_detail(self, request, pk=None, item_id=None):
        meeting = meeting_service.get_meeting(request.user, pk)
        item = meeting.items.filter(pk=item_id, deleted_at__isnull=True).first()
        if item is None:
            raise ValidationError({"item_id": "Item not found."})
        ctx = self.get_serializer_context()
        if request.method == "DELETE":
            meeting_service.delete_item(user=request.user, item=item)
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = MeetingItemSerializer(item, data=request.data, partial=True, context=ctx)
        serializer.is_valid(raise_exception=True)
        item = meeting_service.update_item(
            user=request.user,
            item=item,
            **serializer.validated_data,
        )
        return Response(MeetingItemSerializer(item, context=ctx).data)

    @extend_schema(
        summary="Carry unfinished items to the next meeting",
        description=(
            "Copies lines that are still `created`, `in_progress`, or `test`.\n\n"
            "- Empty body `{}`: creates a **new** meeting in the same group and copies into it.\n"
            "- `{target_meeting: id}`: copies into an existing **open** meeting in the same company.\n\n"
            "Original lines stay on the old minutes (`cloned_from` points back)."
        ),
        request=CarryOverSerializer,
        responses={201: MeetingSerializer},
    )
    @action(detail=True, methods=["post"], url_path="carry-over")
    def carry_over(self, request, pk=None):
        meeting = meeting_service.get_meeting(request.user, pk)
        serializer = CarryOverSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = None
        target_id = serializer.validated_data.get("target_meeting")
        if target_id:
            target = meeting_service.get_meeting(request.user, target_id)
        target = meeting_service.carry_over(
            user=request.user,
            meeting=meeting,
            target=target,
        )
        return Response(self.get_serializer(target).data, status=status.HTTP_201_CREATED)
