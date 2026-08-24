from rest_framework import serializers

from team_manage_services.models import (
    Attachment,
    BoardColumn,
    BoardTemplate,
    BoardTemplateColumn,
    Company,
    CompanyMember,
    Invitation,
    Notification,
    Project,
    ProjectMember,
    Task,
    TaskComment,
    TaskStep,
    Team,
    TeamMember,
    WorkLabel,
)
from team_manage_services.services.access import (
    can_add_task,
    can_move_task,
    is_company_manager,
    is_project_manager,
    project_requires_approval,
)
from team_manage_services.services.progress import (
    project_progress_percent,
    task_progress_percent,
)


class CompanySerializer(serializers.ModelSerializer):
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "parent",
            "owner",
            "status",
            "require_approval_before_close",
            "can_manage",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "can_manage", "created_at", "updated_at"]

    def get_can_manage(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return is_company_manager(request.user, obj)


class CompanyMemberSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = CompanyMember
        fields = [
            "id",
            "user",
            "phone_number",
            "full_name",
            "role",
            "status",
            "joined_at",
        ]
        read_only_fields = ["user", "joined_at"]

    def get_full_name(self, obj):
        return obj.user.get_full_name().strip() or obj.user.phone_number


class TeamSerializer(serializers.ModelSerializer):
    can_manage = serializers.SerializerMethodField()
    company_name = serializers.CharField(source="company.name", read_only=True)
    member_count = serializers.SerializerMethodField()
    project_count = serializers.SerializerMethodField()
    preview_members = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = [
            "id",
            "company",
            "company_name",
            "name",
            "owner",
            "status",
            "can_manage",
            "member_count",
            "project_count",
            "preview_members",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "owner",
            "can_manage",
            "member_count",
            "project_count",
            "preview_members",
            "created_at",
            "updated_at",
        ]

    def get_can_manage(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return is_company_manager(request.user, obj.company)

    def get_member_count(self, obj):
        annotated = getattr(obj, "member_count", None)
        if isinstance(annotated, int):
            return annotated
        return obj.members.filter(status=TeamMember.Status.ACTIVE).count()

    def get_project_count(self, obj):
        annotated = getattr(obj, "project_count", None)
        if isinstance(annotated, int):
            return annotated
        return obj.project_links.count()

    def get_preview_members(self, obj):
        members = getattr(obj, "active_members", None)
        if members is None:
            members = obj.members.filter(status=TeamMember.Status.ACTIVE).select_related(
                "user",
                "user__profile",
            )
        return TeamMemberSerializer(list(members)[:5], many=True).data


class TeamMemberSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    full_name = serializers.SerializerMethodField()
    profile_image = serializers.SerializerMethodField()

    class Meta:
        model = TeamMember
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
        read_only_fields = ["user", "joined_at"]

    def get_full_name(self, obj):
        return obj.user.get_full_name().strip() or obj.user.phone_number

    def get_profile_image(self, obj):
        profile = getattr(obj.user, "profile", None)
        image = getattr(profile, "profile_image", None) if profile else None
        if not image:
            return None
        try:
            return image.url
        except (AttributeError, ValueError):
            return None


class TeamMemberUpdateSerializer(serializers.Serializer):
    position_title = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=TeamMember.Role.choices, required=False)
    status = serializers.ChoiceField(
        choices=TeamMember.Status.choices,
        required=False,
    )


class InviteSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    position_title = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(
        choices=TeamMember.Role.choices,
        required=False,
        default=TeamMember.Role.DEVELOPER,
    )


class InvitationSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source="team.name", read_only=True)
    company_id = serializers.IntegerField(source="team.company_id", read_only=True)
    invited_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Invitation
        fields = [
            "id",
            "team",
            "team_name",
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


class ProjectMemberSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMember
        fields = [
            "id",
            "user",
            "phone_number",
            "full_name",
            "role",
            "status",
            "added_from_team",
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name().strip() or obj.user.phone_number


class AddProjectMemberSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    role = serializers.ChoiceField(
        choices=ProjectMember.Role.choices,
        required=False,
        default=ProjectMember.Role.MEMBER,
    )


class AddProjectTeamSerializer(serializers.Serializer):
    team_id = serializers.IntegerField()


class BoardTemplateColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoardTemplateColumn
        fields = ["id", "name", "color", "position", "status_key", "is_closed"]
        read_only_fields = ["id", "position"]


class BoardTemplateSerializer(serializers.ModelSerializer):
    columns = BoardTemplateColumnSerializer(many=True, read_only=True)

    class Meta:
        model = BoardTemplate
        fields = [
            "id",
            "company",
            "name",
            "is_default",
            "is_platform",
            "requires_approval",
            "columns",
            "created_at",
        ]
        read_only_fields = ["company", "is_default", "is_platform", "requires_approval", "created_at"]


class BoardTemplateWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, required=False)
    is_default = serializers.BooleanField(required=False, default=False)
    columns = serializers.ListField(child=serializers.DictField(), required=False)


class WorkLabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkLabel
        fields = ["id", "company", "name", "color", "description", "created_at"]
        read_only_fields = ["company", "created_at"]


class BoardColumnSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoardColumn
        fields = [
            "id",
            "project",
            "name",
            "color",
            "position",
            "status_key",
            "is_closed",
        ]
        read_only_fields = ["project", "position"]


class BoardColumnWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80, required=False)
    color = serializers.CharField(max_length=7, required=False)
    status_key = serializers.ChoiceField(
        choices=Task.Status.choices,
        required=False,
    )
    is_closed = serializers.BooleanField(required=False)


class BoardColumnReorderSerializer(serializers.Serializer):
    column_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class ProjectSerializer(serializers.ModelSerializer):
    progress_percent = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()
    can_add_task = serializers.SerializerMethodField()
    can_manage_company = serializers.SerializerMethodField()
    require_approval = serializers.SerializerMethodField()
    company_name = serializers.CharField(source="company.name", read_only=True)
    team_names = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "company",
            "company_name",
            "team_names",
            "name",
            "description",
            "owner",
            "status",
            "priority",
            "start_date",
            "due_date",
            "progress_percent",
            "can_manage",
            "can_add_task",
            "can_manage_company",
            "require_approval_before_close",
            "require_approval",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "created_at", "updated_at"]

    def get_progress_percent(self, obj):
        return project_progress_percent(obj)

    def get_can_manage(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return is_project_manager(request.user, obj)

    def get_can_add_task(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return can_add_task(request.user, obj)

    def get_can_manage_company(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return is_company_manager(request.user, obj.company)

    def get_require_approval(self, obj):
        return project_requires_approval(obj)

    def get_team_names(self, obj):
        links = obj.project_teams.all()
        names = []
        for link in links:
            team = getattr(link, "team", None)
            if team and team.name:
                names.append(team.name)
        return names


class TaskStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskStep
        fields = [
            "id",
            "title",
            "order",
            "is_completed",
            "completed_by",
            "completed_at",
        ]
        read_only_fields = ["completed_by", "completed_at"]


class TaskStepWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    order = serializers.IntegerField(required=False, min_value=1)


class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ["id", "file", "original_name", "file_size", "uploaded_by", "created_at"]
        read_only_fields = ["original_name", "file_size", "uploaded_by", "created_at"]


class TaskCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = TaskComment
        fields = [
            "id",
            "author",
            "author_name",
            "body",
            "reply_to",
            "attachments",
            "created_at",
        ]
        read_only_fields = ["author", "created_at"]

    def get_author_name(self, obj):
        return obj.author.get_full_name().strip() or obj.author.phone_number


class CommentWriteSerializer(serializers.Serializer):
    body = serializers.CharField()
    reply_to = serializers.IntegerField(required=False)


class TaskSerializer(serializers.ModelSerializer):
    progress_percent = serializers.SerializerMethodField()
    assignee_user_id = serializers.IntegerField(
        source="assigned_to.user_id", read_only=True, allow_null=True
    )
    assignee_name = serializers.SerializerMethodField()
    assignee_avatar = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True)
    column_name = serializers.CharField(source="column.name", read_only=True, allow_null=True)
    column_color = serializers.CharField(source="column.color", read_only=True, allow_null=True)
    labels = WorkLabelSerializer(many=True, read_only=True)
    label_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=WorkLabel.objects.all(),
        required=False,
        write_only=True,
        source="labels",
    )
    prerequisites = serializers.SerializerMethodField()
    prerequisite_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Task.objects.all(),
        required=False,
        write_only=True,
        source="prerequisites",
    )
    can_move = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id",
            "project",
            "project_name",
            "title",
            "description",
            "assigned_to",
            "assignee_user_id",
            "assignee_name",
            "assignee_avatar",
            "created_by",
            "status",
            "column",
            "column_name",
            "column_color",
            "labels",
            "label_ids",
            "prerequisites",
            "prerequisite_ids",
            "priority",
            "difficulty",
            "start_date",
            "due_date",
            "completed_at",
            "progress_percent",
            "can_move",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_by", "completed_at", "created_at", "updated_at"]

    def get_progress_percent(self, obj):
        return task_progress_percent(obj)

    def get_assignee_name(self, obj):
        if not obj.assigned_to_id:
            return None
        user = obj.assigned_to.user
        return user.get_full_name().strip() or user.phone_number

    def get_assignee_avatar(self, obj):
        if not obj.assigned_to_id:
            return None
        profile = getattr(obj.assigned_to.user, "profile", None)
        image = getattr(profile, "profile_image", None) if profile else None
        if not image:
            return None
        try:
            return image.url
        except (AttributeError, ValueError):
            return None

    def get_prerequisites(self, obj):
        return [
            {"id": row.id, "title": row.title, "status": row.status}
            for row in obj.prerequisites.all()
        ]

    def get_can_move(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return can_move_task(request.user, obj)


class TaskDetailSerializer(TaskSerializer):
    steps = TaskStepSerializer(many=True, read_only=True)
    comments = TaskCommentSerializer(many=True, read_only=True)

    class Meta(TaskSerializer.Meta):
        fields = TaskSerializer.Meta.fields + ["steps", "comments"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "message",
            "is_read",
            "reference_type",
            "reference_id",
            "send_sms",
            "sms_sent_at",
            "created_at",
        ]
        read_only_fields = fields
