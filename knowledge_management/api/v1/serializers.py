from rest_framework import serializers

from knowledge_management.models import (
    Attachment,
    InkDrawing,
    Node,
    PlanDay,
    Review,
    StudyPlan,
    Template,
)
from knowledge_management.services.nodes import snippet


class NodeTreeSerializer(serializers.ModelSerializer):
    parent_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Node
        fields = [
            "id",
            "parent_id",
            "type",
            "title",
            "icon",
            "path",
            "depth",
            "position",
            "is_daily",
            "daily_date",
        ]


class LinkTargetSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="target_id")
    title = serializers.CharField(source="target.title")
    path = serializers.CharField(source="target.path")
    broken = serializers.BooleanField(source="target.is_deleted")


class BacklinkSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="source_id")
    title = serializers.CharField(source="source.title")
    path = serializers.CharField(source="source.path")


class NodeSerializer(serializers.ModelSerializer):
    parent_id = serializers.IntegerField(read_only=True)
    links = LinkTargetSerializer(source="outgoing_links", many=True, read_only=True)
    drawings = serializers.SerializerMethodField()
    files = serializers.SerializerMethodField()

    class Meta:
        model = Node
        fields = [
            "id",
            "parent_id",
            "type",
            "title",
            "icon",
            "content",
            "schema_version",
            "version",
            "position",
            "path",
            "depth",
            "is_daily",
            "daily_date",
            "links",
            "drawings",
            "files",
            "created_at",
            "updated_at",
        ]

    def get_drawings(self, node):
        return InkSerializer(node.ink_drawings.all(), many=True).data

    def get_files(self, node):
        return AttachmentSerializer(node.attachments.all(), many=True, context=self.context).data


class NodeCreateSerializer(serializers.Serializer):
    parent_id = serializers.IntegerField(required=False, allow_null=True)
    type = serializers.ChoiceField(choices=Node.Type.choices)
    title = serializers.CharField(max_length=200)
    icon = serializers.CharField(required=False, allow_blank=True, max_length=32)
    template_id = serializers.IntegerField(required=False, allow_null=True)


class NodeUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, max_length=200)
    icon = serializers.CharField(required=False, allow_blank=True, max_length=32)
    content = serializers.JSONField(required=False)
    version = serializers.IntegerField(required=False, min_value=1)


class MoveSerializer(serializers.Serializer):
    parent_id = serializers.IntegerField(allow_null=True)
    position = serializers.IntegerField(min_value=0)


class SearchHitSerializer(serializers.ModelSerializer):
    snippet = serializers.SerializerMethodField()

    class Meta:
        model = Node
        fields = ["id", "parent_id", "type", "title", "path", "snippet"]

    def get_snippet(self, node):
        query = self.context.get("query") or ""
        text = node.content_text or node.title
        return snippet(text, query)


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = ["id", "title", "content", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class PlanDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanDay
        fields = ["id", "day_number", "date", "node", "status"]


class PlanSerializer(serializers.ModelSerializer):
    days_rows = PlanDaySerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = StudyPlan
        fields = ["id", "title", "start_date", "days", "progress", "days_rows", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_progress(self, plan):
        from knowledge_management.services.plans import PlanService

        return PlanService().progress(plan)


class PlanCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    start_date = serializers.DateField()
    days = serializers.IntegerField(required=False, min_value=1, max_value=366)


class PlanDayUpdateSerializer(serializers.Serializer):
    node_id = serializers.IntegerField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=PlanDay.Status.choices, required=False)


class ShiftSerializer(serializers.Serializer):
    days = serializers.IntegerField()


class ReviewSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source="node.title", read_only=True)
    path = serializers.CharField(source="node.path", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "node", "plan_day", "due_date", "step", "done_at", "title", "path"]


class ReviewDoneSerializer(serializers.Serializer):
    done = serializers.BooleanField()


class TodaySerializer(serializers.Serializer):
    date = serializers.DateField()
    plan_days = PlanDaySerializer(many=True)
    reviews = ReviewSerializer(many=True)
    daily_note = NodeSerializer()


class InkSerializer(serializers.ModelSerializer):
    class Meta:
        model = InkDrawing
        fields = ["id", "node", "strokes", "width", "height", "updated_at"]
        read_only_fields = ["id", "updated_at"]


class InkWriteSerializer(serializers.Serializer):
    node_id = serializers.IntegerField()
    strokes = serializers.JSONField()
    width = serializers.IntegerField()
    height = serializers.IntegerField()


class AttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ["id", "node", "kind", "size", "name", "url", "created_at"]

    def get_url(self, row):
        request = self.context.get("request")
        url = row.file.url
        if request is None:
            return url
        return request.build_absolute_uri(url)
