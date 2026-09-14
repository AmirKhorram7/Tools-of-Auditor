from datetime import date

from rest_framework import serializers

from meeting_minutes_servicesclear.models import (
    Company,
    Group,
    GroupInvitation,
    GroupMember,
    Meeting,
    MeetingItem,
)
from meeting_minutes_servicesclear.services.groups import GroupService
from meeting_minutes_servicesclear.services.meetings_minutes import (
    OPEN_ITEM_STATUSES,
    MeetingService,
)

group_service = GroupService()
meeting_service = MeetingService()


def remaining_days(due, status):
    if due is None:
        return None
    if status in (MeetingItem.Status.COMPLETED, MeetingItem.Status.CANCELLED):
        return None
    return (due - date.today()).days


class CompanySerializer(serializers.ModelSerializer):
    is_owner = serializers.SerializerMethodField(
        help_text="True when the current user owns this company."
    )

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "parent",
            "owner",
            "status",
            "is_owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "is_owner", "created_at", "updated_at"]
        extra_kwargs = {
            "name": {"help_text": "Company display name."},
            "parent": {"help_text": "Optional holding company. One level only.", "required": False},
            "status": {"help_text": "`active` or `inactive`."},
        }

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(
            request
            and request.user.is_authenticated
            and obj.owner_id == request.user.id
        )


class GroupSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    my_role = serializers.SerializerMethodField(
        help_text="Current user's role on this group: `owner`, `maintainer`, `guest`, or null."
    )
    can_manage = serializers.SerializerMethodField(
        help_text="True if the current user can invite, update, or remove members."
    )

    class Meta:
        model = Group
        fields = [
            "id",
            "company",
            "company_name",
            "name",
            "owner",
            "status",
            "my_role",
            "can_manage",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "owner",
            "company_name",
            "my_role",
            "can_manage",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "company": {"help_text": "Company this group belongs to."},
            "name": {"help_text": "Unique group name inside the company."},
            "status": {"help_text": "`active` or `archived`."},
        }

    def get_my_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if obj.company.owner_id == request.user.id:
            return GroupMember.Role.OWNER
        return group_service.member_role(request.user, obj)

    def get_can_manage(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return group_service.can_manage_members(request.user, obj)


class GroupMemberSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = GroupMember
        fields = [
            "id",
            "user",
            "phone_number",
            "full_name",
            "role",
            "position_title",
            "status",
            "joined_at",
        ]
        read_only_fields = ["user", "phone_number", "full_name", "joined_at"]

    def get_full_name(self, obj):
        return obj.user.get_full_name().strip() or obj.user.phone_number


class InviteSerializer(serializers.Serializer):
    phone_number = serializers.CharField(
        max_length=15,
        help_text="Invite by phone. Existing users accept in-app; new users see it after OTP login.",
    )
    position_title = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        help_text="Optional job title shown on the member row.",
    )
    role = serializers.ChoiceField(
        choices=[
            (GroupMember.Role.MAINTAINER, "Maintainer"),
            (GroupMember.Role.GUEST, "Guest"),
        ],
        required=False,
        default=GroupMember.Role.GUEST,
        help_text="`maintainer` (same group access as owner) or `guest` (can be assigned jobs). Cannot invite as owner.",
    )


class GroupMemberUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(
        choices=[
            (GroupMember.Role.MAINTAINER, "Maintainer"),
            (GroupMember.Role.GUEST, "Guest"),
        ],
        required=False,
        help_text="`maintainer` or `guest`. Cannot change the group owner.",
    )
    status = serializers.ChoiceField(
        choices=GroupMember.Status.choices,
        required=False,
        help_text="`active` or `inactive`.",
    )
    position_title = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
    )


class InvitationSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)
    company_id = serializers.IntegerField(source="group.company_id", read_only=True)
    invited_by_name = serializers.SerializerMethodField()

    class Meta:
        model = GroupInvitation
        fields = [
            "id",
            "group",
            "group_name",
            "company_id",
            "invited_by",
            "invited_by_name",
            "invited_user",
            "phone_number",
            "role",
            "position_title",
            "status",
            "expires_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_invited_by_name(self, obj):
        return obj.invited_by.get_full_name().strip() or obj.invited_by.phone_number


class MeetingItemSerializer(serializers.ModelSerializer):
    assignee_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="GroupMember ids from this meeting's group. One or many.",
    )
    assignees = GroupMemberSerializer(many=True, read_only=True)
    remaining_days = serializers.SerializerMethodField(
        help_text="Days left until due_date. Negative means overdue. Null if no due date or the line is done/cancelled."
    )
    is_overdue = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField(
        help_text="True if the current user can edit subject, assignees, due date, etc."
    )
    can_set_status = serializers.SerializerMethodField(
        help_text="True if the current user can change this line's status."
    )

    class Meta:
        model = MeetingItem
        fields = [
            "id",
            "title",
            "description",
            "priority",
            "status",
            "order",
            "due_date",
            "remaining_days",
            "is_overdue",
            "assignee_ids",
            "assignees",
            "cloned_from",
            "completed_at",
            "can_edit",
            "can_set_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "order",
            "assignees",
            "cloned_from",
            "completed_at",
            "remaining_days",
            "is_overdue",
            "can_edit",
            "can_set_status",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "title": {"help_text": "Subject / decision line."},
            "description": {"help_text": "Optional details."},
            "priority": {"help_text": "1=low, 2=medium, 3=high, 4=critical."},
            "status": {
                "help_text": "`created` | `in_progress` | `test` | `completed` | `cancelled`."
            },
            "due_date": {"help_text": "Deadline. Frontend can show remaining_days from this."},
        }

    def get_remaining_days(self, obj):
        return remaining_days(obj.due_date, obj.status)

    def get_is_overdue(self, obj):
        days = remaining_days(obj.due_date, obj.status)
        return days is not None and days < 0

    def get_can_edit(self, obj):
        request = self.context.get("request")
        return bool(request and meeting_service.can_clerk(request.user, obj.meeting))

    def get_can_set_status(self, obj):
        request = self.context.get("request")
        if not request:
            return False
        return meeting_service.can_clerk(request.user, obj.meeting) or meeting_service.is_assignee(
            request.user, obj
        )


class MeetingSerializer(serializers.ModelSerializer):
    company_id = serializers.IntegerField(source="group.company_id", read_only=True)
    company_name = serializers.CharField(source="group.company.name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    clerk_name = serializers.SerializerMethodField(
        help_text="Person who created these minutes."
    )
    item_count = serializers.SerializerMethodField()
    open_item_count = serializers.SerializerMethodField(
        help_text="Lines still in created / in_progress / test."
    )
    can_clerk = serializers.SerializerMethodField(
        help_text="True if the current user can add/edit/close minutes."
    )
    items = MeetingItemSerializer(many=True, read_only=True)

    class Meta:
        model = Meeting
        fields = [
            "id",
            "name",
            "group",
            "group_name",
            "company_id",
            "company_name",
            "date",
            "meeting_number",
            "description",
            "status",
            "clerk_name",
            "item_count",
            "open_item_count",
            "can_clerk",
            "items",
            "closed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "meeting_number",
            "group_name",
            "company_id",
            "company_name",
            "clerk_name",
            "item_count",
            "open_item_count",
            "can_clerk",
            "items",
            "closed_at",
            "status",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "group": {"help_text": "Group this meeting belongs to. Defaults to the group the clerk is in."},
            "name": {"help_text": "Optional title. Defaults to the group name.", "required": False},
            "date": {"help_text": "Meeting date. Defaults to today.", "required": False},
            "description": {"help_text": "Optional header notes."},
        }

    def get_clerk_name(self, obj):
        user = obj.created_by
        return user.get_full_name().strip() or user.phone_number

    def get_item_count(self, obj):
        return obj.items.filter(deleted_at__isnull=True).count()

    def get_open_item_count(self, obj):
        return obj.items.filter(deleted_at__isnull=True, status__in=OPEN_ITEM_STATUSES).count()

    def get_can_clerk(self, obj):
        request = self.context.get("request")
        if not request:
            return False
        return meeting_service.can_clerk(request.user, obj)


class MeetingListSerializer(MeetingSerializer):
    class Meta(MeetingSerializer.Meta):
        fields = [f for f in MeetingSerializer.Meta.fields if f != "items"]


class CarryOverSerializer(serializers.Serializer):
    target_meeting = serializers.IntegerField(
        required=False,
        help_text="Existing open meeting id. Omit to create a new meeting in the same group and copy unfinished lines into it.",
    )
