from rest_framework import serializers

from daybook_services.models import HEX_COLOR, Daybook, DayNote, Plan, PlanItem


class DaybookSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Daybook
        fields = ["calendar_system", "default_view"]


class DayNoteSerializer(serializers.ModelSerializer):
    color = serializers.CharField(required=False, validators=[HEX_COLOR])
    body = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=50_000,
        help_text="HTML. Unsafe tags, attributes and links are removed on save.",
    )

    class Meta:
        model = DayNote
        fields = ["id", "date", "title", "body", "color", "is_pinned", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class PlanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanItem
        fields = ["id", "title", "is_done", "done_at", "position"]
        read_only_fields = ["id", "done_at"]


class PlanItemWriteSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, max_length=240)
    is_done = serializers.BooleanField(required=False)
    position = serializers.IntegerField(required=False, min_value=0)


class PlanSerializer(serializers.ModelSerializer):
    color = serializers.CharField(required=False, validators=[HEX_COLOR])
    end_date = serializers.DateField(required=False, help_text="Defaults to `start_date` (a one-day plan).")
    items = PlanItemSerializer(many=True, read_only=True)
    item_titles = serializers.ListField(
        child=serializers.CharField(max_length=240, allow_blank=True),
        write_only=True,
        required=False,
        help_text="Create only: checklist lines to add with the plan.",
    )
    progress = serializers.SerializerMethodField(help_text="Done items as a 0–100 integer.")
    item_total = serializers.SerializerMethodField()
    item_done = serializers.SerializerMethodField()

    class Meta:
        model = Plan
        fields = [
            "id",
            "title",
            "start_date",
            "end_date",
            "color",
            "status",
            "closed_at",
            "item_total",
            "item_done",
            "progress",
            "items",
            "item_titles",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "closed_at", "created_at", "updated_at"]

    def _counts(self, plan) -> tuple[int, int]:
        total = getattr(plan, "item_total", None)
        done = getattr(plan, "item_done", None)
        if total is None or done is None:
            items = list(plan.items.all())
            total, done = len(items), sum(1 for row in items if row.is_done)
        return total, done

    def get_item_total(self, plan) -> int:
        return self._counts(plan)[0]

    def get_item_done(self, plan) -> int:
        return self._counts(plan)[1]

    def get_progress(self, plan) -> int:
        total, done = self._counts(plan)
        if not total:
            return 100 if plan.status == Plan.Status.DONE else 0
        return round(done * 100 / total)


class AgendaSerializer(serializers.Serializer):
    start = serializers.DateField()
    end = serializers.DateField()
    settings = DaybookSettingsSerializer()
    notes = DayNoteSerializer(many=True)
    plans = PlanSerializer(many=True)
