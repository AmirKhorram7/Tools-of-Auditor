from datetime import date

from rest_framework import serializers

from meeting_minutes_servicesclear.models import (
    Company,
    Group,
    GroupInvitation,
    GroupMember,
    Meeting,
    MeetingItem,
    MeetingItemComment,
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


class RelativeImageField(serializers.ImageField):
    """Return storage-relative URLs (/media/...) for Docker/nginx."""

    def to_representation(self, value):
        if not value:
            return None
        try:
            return value.url
        except (AttributeError, ValueError):
            return None


def person_name(user):
    return user.get_full_name().strip() or user.phone_number


def profile_image_url(user):
    profile = getattr(user, "profile", None)
    if not profile:
        return None
    return profile.avatar_url()


MAX_LOGO_BYTES = 2 * 1024 * 1024


def validate_logo_file(value):
    if value and getattr(value, "size", 0) > MAX_LOGO_BYTES:
        raise serializers.ValidationError("Image must be 2 MB or smaller.")
    return value


class CompanySerializer(serializers.ModelSerializer):
    is_owner = serializers.SerializerMethodField(
        help_text="True when the current user owns this company."
    )
    owner_name = serializers.SerializerMethodField()
    logo = RelativeImageField(required=False, allow_null=True)

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "parent",
            "owner",
            "owner_name",
            "logo",
            "status",
            "is_owner",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "owner_name", "is_owner", "created_at", "updated_at"]
        extra_kwargs = {
            "name": {"help_text": "Company display name."},
            "parent": {"help_text": "Optional holding company. One level only.", "required": False},
            "status": {"help_text": "`active` or `inactive`."},
            "logo": {"help_text": "Optional company logo."},
        }

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(
            request
            and request.user.is_authenticated
            and obj.owner_id == request.user.id
        )

    def get_owner_name(self, obj):
        return person_name(obj.owner)

    def validate_logo(self, value):
        return validate_logo_file(value)


class GroupSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    owner_name = serializers.SerializerMethodField()
    logo = RelativeImageField(required=False, allow_null=True)
    my_role = serializers.SerializerMethodField(
        help_text="Current user's role on this group: `owner`, `maintainer`, `guest`, or null."
    )
    can_manage = serializers.SerializerMethodField(
        help_text="True if the current user can invite, update, or remove members."
    )
    can_edit = serializers.SerializerMethodField(
        help_text="True if the current user can rename, upload a logo, or delete this group."
    )

    class Meta:
        model = Group
        fields = [
            "id",
            "company",
            "company_name",
            "name",
            "owner",
            "owner_name",
            "logo",
            "status",
            "is_default",
            "my_role",
            "can_manage",
            "can_edit",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "owner",
            "owner_name",
            "company_name",
            "my_role",
            "can_manage",
            "can_edit",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "company": {"help_text": "Company this group belongs to."},
            "name": {"help_text": "Unique group name inside the company."},
            "status": {"help_text": "`active` or `archived`."},
            "logo": {"help_text": "Optional group picture."},
            "is_default": {
                "help_text": "On/off. Default group for new minutes in this company. Turning this on turns the previous default off."
            },
        }

    def get_owner_name(self, obj):
        return person_name(obj.owner)

    def validate_logo(self, value):
        return validate_logo_file(value)

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

    def get_can_edit(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return group_service.is_company_owner(request.user, obj.company)


class GroupMemberSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    full_name = serializers.SerializerMethodField()
    profile_image = serializers.SerializerMethodField()

    class Meta:
        model = GroupMember
        fields = [
            "id",
            "user",
            "phone_number",
            "full_name",
            "profile_image",
            "role",
            "position_title",
            "status",
            "joined_at",
        ]
        read_only_fields = ["user", "phone_number", "full_name", "profile_image", "joined_at"]

    def get_full_name(self, obj):
        return obj.user.get_full_name().strip() or obj.user.phone_number

    def get_profile_image(self, obj):
        return profile_image_url(obj.user)


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
    invited_name = serializers.SerializerMethodField()

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
            "invited_name",
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

    def get_invited_name(self, obj):
        if obj.invited_user:
            return person_name(obj.invited_user)
        return ""


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
    can_comment = serializers.SerializerMethodField(
        help_text="True if the current user can add a comment on this line."
    )
    comment_count = serializers.SerializerMethodField()

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
            "can_comment",
            "comment_count",
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
            "can_comment",
            "comment_count",
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

    def get_can_comment(self, obj):
        request = self.context.get("request")
        if not request:
            return False
        return meeting_service.can_comment(request.user, obj)

    def get_comment_count(self, obj):
        count = getattr(obj, "comment_count", None)
        if count is not None:
            return count
        return obj.comments.filter(deleted_at__isnull=True).count()


class MeetingItemCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_image = serializers.SerializerMethodField()

    class Meta:
        model = MeetingItemComment
        fields = [
            "id",
            "body",
            "author_name",
            "author_image",
            "created_at",
        ]
        read_only_fields = ["author_name", "author_image", "created_at"]
        extra_kwargs = {
            "body": {"help_text": "Short note from the assignee about this line."},
        }

    def get_author_name(self, obj):
        return person_name(obj.created_by)

    def get_author_image(self, obj):
        return profile_image_url(obj.created_by)


class MeetingSerializer(serializers.ModelSerializer):
    company_id = serializers.IntegerField(source="group.company_id", read_only=True)
    company_name = serializers.CharField(source="group.company.name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    group_logo = RelativeImageField(source="group.logo", read_only=True)
    clerk_name = serializers.SerializerMethodField(
        help_text="Person who created these minutes."
    )
    clerk_image = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    open_item_count = serializers.SerializerMethodField(
        help_text="Lines still in created / in_progress / test."
    )
    can_clerk = serializers.SerializerMethodField(
        help_text="True if the current user can add/edit/close minutes."
    )
    can_delete = serializers.SerializerMethodField(
        help_text="True if the current user can delete these minutes."
    )
    items = MeetingItemSerializer(many=True, read_only=True)

    class Meta:
        model = Meeting
        fields = [
            "id",
            "name",
            "group",
            "group_name",
            "group_logo",
            "company_id",
            "company_name",
            "date",
            "year",
            "meeting_number",
            "description",
            "status",
            "clerk_name",
            "clerk_image",
            "item_count",
            "open_item_count",
            "can_clerk",
            "can_delete",
            "items",
            "closed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "year",
            "meeting_number",
            "group_name",
            "group_logo",
            "company_id",
            "company_name",
            "clerk_name",
            "clerk_image",
            "item_count",
            "open_item_count",
            "can_clerk",
            "can_delete",
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

    def get_clerk_image(self, obj):
        return profile_image_url(obj.created_by)

    def get_item_count(self, obj):
        return obj.items.filter(deleted_at__isnull=True).count()

    def get_open_item_count(self, obj):
        return obj.items.filter(deleted_at__isnull=True, status__in=OPEN_ITEM_STATUSES).count()

    def get_can_clerk(self, obj):
        request = self.context.get("request")
        if not request:
            return False
        return meeting_service.can_clerk(request.user, obj)

    def get_can_delete(self, obj):
        request = self.context.get("request")
        if not request:
            return False
        return obj.created_by_id == request.user.id or meeting_service.can_clerk(request.user, obj)


class MeetingListSerializer(MeetingSerializer):
    class Meta(MeetingSerializer.Meta):
        fields = [f for f in MeetingSerializer.Meta.fields if f != "items"]


class CarryOverSerializer(serializers.Serializer):
    target_meeting = serializers.IntegerField(
        required=False,
        help_text="Existing open meeting id. Omit to create a new meeting in the same group and copy unfinished lines into it.",
    )
