from rest_framework import serializers

from system_explanation_services.models import (
    Process,
    ProcessStep,
    Project,
    StepConnection,
    StepControl,
    StepMedia,
    StepRisk,
)


class ProjectSerializer(serializers.ModelSerializer):
    process_count = serializers.IntegerField(read_only=True, required=False)
    sub_project_count = serializers.IntegerField(read_only=True, required=False)
    is_root = serializers.BooleanField(read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "parent",
            "name",
            "company_name",
            "description",
            "status",
            "is_active",
            "is_root",
            "owner",
            "process_count",
            "sub_project_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "created_at", "updated_at"]

    def validate_parent(self, parent):
        if parent is None:
            return parent
        request = self.context.get("request")
        if request and parent.owner_id != request.user.id:
            raise serializers.ValidationError("You do not own the parent project.")
        if parent.parent_id is not None:
            raise serializers.ValidationError(
                "Sub-projects can only be created under a root project."
            )
        return parent


class ProjectDetailSerializer(ProjectSerializer):
    """Root/sub project detail including nested sub-projects list."""

    sub_projects = ProjectSerializer(many=True, read_only=True)

    class Meta(ProjectSerializer.Meta):
        fields = ProjectSerializer.Meta.fields + ["sub_projects"]


class ProcessSerializer(serializers.ModelSerializer):
    step_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Process
        fields = [
            "id",
            "project",
            "name",
            "description",
            "process_owner_name",
            "department",
            "order",
            "owner",
            "step_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "created_at", "updated_at"]


class StepMediaSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = StepMedia
        fields = [
            "id",
            "step",
            "section",
            "risk",
            "control",
            "kind",
            "title",
            "file",
            "file_url",
            "url",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "file_url"]
        extra_kwargs = {
            "file": {"required": False, "allow_null": True},
            "risk": {"required": False, "allow_null": True},
            "control": {"required": False, "allow_null": True},
        }

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get("request")
        url = obj.file.url
        if request:
            return request.build_absolute_uri(url)
        return url

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        section = attrs.get("section", getattr(instance, "section", None))
        kind = attrs.get("kind", getattr(instance, "kind", None))
        risk = attrs.get("risk", getattr(instance, "risk", None))
        control = attrs.get("control", getattr(instance, "control", None))
        step = attrs.get("step", getattr(instance, "step", None))
        file = attrs.get("file", getattr(instance, "file", None))
        url = attrs.get("url", getattr(instance, "url", ""))

        if section == StepMedia.Section.EXPLANATION and (risk or control):
            raise serializers.ValidationError(
                "Explanation media must not set risk or control."
            )
        if section == StepMedia.Section.RISK:
            if not risk:
                raise serializers.ValidationError({"risk": "Required for risk media."})
            if control:
                raise serializers.ValidationError(
                    {"control": "Must be empty for risk media."}
                )
            if step and risk.step_id != step.id:
                raise serializers.ValidationError(
                    {"risk": "Risk must belong to the same step."}
                )
        if section == StepMedia.Section.CONTROL:
            if not control:
                raise serializers.ValidationError(
                    {"control": "Required for control media."}
                )
            if risk:
                raise serializers.ValidationError(
                    {"risk": "Must be empty for control media."}
                )
            if step and control.step_id != step.id:
                raise serializers.ValidationError(
                    {"control": "Control must belong to the same step."}
                )

        if kind == StepMedia.Kind.LINK and not url:
            raise serializers.ValidationError({"url": "Required for link media."})
        if kind in (StepMedia.Kind.IMAGE, StepMedia.Kind.FILE) and not file and not url:
            raise serializers.ValidationError(
                {"file": "Upload a file or provide a URL for image/file media."}
            )
        return attrs


class StepRiskSerializer(serializers.ModelSerializer):
    media_items = StepMediaSerializer(many=True, read_only=True)

    class Meta:
        model = StepRisk
        fields = [
            "id",
            "step",
            "title",
            "content",
            "order",
            "media_items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "media_items"]


class StepControlSerializer(serializers.ModelSerializer):
    media_items = StepMediaSerializer(many=True, read_only=True)

    class Meta:
        model = StepControl
        fields = [
            "id",
            "step",
            "title",
            "content",
            "order",
            "media_items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "media_items"]


class ProcessStepListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessStep
        fields = [
            "id",
            "process",
            "title",
            "shape_type",
            "position_x",
            "position_y",
            "order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class ProcessStepDetailSerializer(serializers.ModelSerializer):
    """Full step page: explanation + media + risks + controls."""

    risks = StepRiskSerializer(many=True, read_only=True)
    controls = StepControlSerializer(many=True, read_only=True)
    explanation_media = serializers.SerializerMethodField()

    class Meta:
        model = ProcessStep
        fields = [
            "id",
            "process",
            "title",
            "shape_type",
            "position_x",
            "position_y",
            "order",
            "explanation",
            "explanation_media",
            "risks",
            "controls",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_explanation_media(self, obj):
        items = [
            m
            for m in obj.media_items.all()
            if m.section == StepMedia.Section.EXPLANATION
        ]
        return StepMediaSerializer(items, many=True, context=self.context).data


class ProcessStepWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessStep
        fields = [
            "id",
            "process",
            "title",
            "shape_type",
            "position_x",
            "position_y",
            "order",
            "explanation",
        ]


class StepConnectionSerializer(serializers.ModelSerializer):
    # Derived from the steps, so the client only has to send from_step/to_step.
    process = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = StepConnection
        fields = [
            "id",
            "process",
            "from_step",
            "to_step",
            "label",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["process", "created_at", "updated_at"]

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        from_step = attrs.get("from_step", getattr(instance, "from_step", None))
        to_step = attrs.get("to_step", getattr(instance, "to_step", None))

        if from_step and to_step:
            if from_step.pk == to_step.pk:
                raise serializers.ValidationError(
                    {"to_step": "A step cannot be connected to itself."}
                )
            if from_step.process_id != to_step.process_id:
                raise serializers.ValidationError(
                    {"to_step": "Both steps must belong to the same process."}
                )
            duplicate = StepConnection.objects.filter(
                from_step=from_step, to_step=to_step
            )
            if instance is not None:
                duplicate = duplicate.exclude(pk=instance.pk)
            if duplicate.exists():
                raise serializers.ValidationError(
                    {"to_step": "These steps are already connected."}
                )
            attrs["process"] = from_step.process
        return attrs
