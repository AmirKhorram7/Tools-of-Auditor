from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from daybook_services.api.v1.serializers import (
    AgendaSerializer,
    DaybookSettingsSerializer,
    DayNoteSerializer,
    PlanItemWriteSerializer,
    PlanSerializer,
)
from daybook_services.models import DayNote, Plan
from daybook_services.services.daybook import MAX_RANGE_DAYS, DaybookService

daybook_service = DaybookService()

_date_field = serializers.DateField()


def _q(name, description, typ=OpenApiTypes.STR):
    return OpenApiParameter(name, typ, OpenApiParameter.QUERY, description=description)


RANGE_PARAMS = [
    _q("start", "First day, `YYYY-MM-DD` (Gregorian).", OpenApiTypes.DATE),
    _q("end", f"Last day, inclusive. Max window {MAX_RANGE_DAYS} days.", OpenApiTypes.DATE),
]


def _date_param(request, name):
    raw = request.query_params.get(name)
    if not raw:
        return None
    try:
        return _date_field.to_internal_value(raw)
    except serializers.ValidationError as exc:
        raise ValidationError({name: "Use YYYY-MM-DD."}) from exc


@extend_schema(tags=["Daybook"])
class DaybookSettingsView(APIView):
    """Base: `/api/v1/daybook/settings/`"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get my calendar settings",
        description=(
            "Created on first call.\n\n"
            "- `calendar_system`: `jalali` (default) or `gregorian`.\n"
            "- `default_view`: `day`, `week` (default) or `month`."
        ),
        responses={200: DaybookSettingsSerializer},
    )
    def get(self, request):
        return Response(DaybookSettingsSerializer(daybook_service.settings_for(request.user)).data)

    @extend_schema(
        summary="Update my calendar settings",
        description="Body: `{calendar_system?, default_view?}`. The app remembers the last choice.",
        request=DaybookSettingsSerializer,
        responses={200: DaybookSettingsSerializer},
    )
    def patch(self, request):
        serializer = DaybookSettingsSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        daybook = daybook_service.update_settings(request.user, **serializer.validated_data)
        return Response(DaybookSettingsSerializer(daybook).data)


@extend_schema(tags=["Daybook"])
class AgendaView(APIView):
    """Base: `/api/v1/daybook/agenda/`"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Calendar window: notes + plans",
        description=(
            "One call per screen. Returns your settings, notes dated in the window, and plans "
            "that **overlap** the window (a plan from the 1st to the 10th appears on every day "
            "in between). Cancelled plans are left out.\n\n"
            "No params → the current week (Monday to Sunday). Dates are Gregorian ISO; the "
            "client converts to Jalali for display."
        ),
        parameters=RANGE_PARAMS,
        responses={200: AgendaSerializer},
    )
    def get(self, request):
        data = daybook_service.agenda(
            request.user,
            _date_param(request, "start"),
            _date_param(request, "end"),
        )
        return Response(AgendaSerializer(data).data)


@extend_schema(tags=["Daybook Notes"])
@extend_schema_view(
    list=extend_schema(
        summary="List my notes",
        description="Only your own notes. Paginated. Filter a window with `start` / `end`.",
        parameters=RANGE_PARAMS,
    ),
    retrieve=extend_schema(summary="Get a note"),
    create=extend_schema(
        summary="Add a note to a day",
        description=(
            "Body: `{date, title?, body?, color?, is_pinned?}`.\n\n"
            "- `body` is HTML from the editor (bold, lists, font, size, text colour, emoji). "
            "Scripts, event handlers and `javascript:` links are stripped.\n"
            "- `color`: hex such as `#0F766E`; it tints the note on the calendar.\n"
            "- A title or some body text is required."
        ),
    ),
    partial_update=extend_schema(
        summary="Edit a note",
        description="Body: any of `{date, title, body, color, is_pinned}`. Change `date` to move it.",
    ),
    destroy=extend_schema(summary="Delete a note"),
)
class DayNoteViewSet(viewsets.ModelViewSet):
    """Base: `/api/v1/daybook/notes/`"""

    permission_classes = [IsAuthenticated]
    serializer_class = DayNoteSerializer
    queryset = DayNote.objects.none()
    lookup_value_regex = r"\d+"
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return daybook_service.notes_for(
            self.request.user,
            _date_param(self.request, "start"),
            _date_param(self.request, "end"),
        )

    def get_object(self):
        return daybook_service.get_note(self.request.user, self.kwargs["pk"])

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = daybook_service.create_note(user=request.user, **serializer.validated_data)
        return Response(self.get_serializer(note).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        note = self.get_object()
        serializer = self.get_serializer(note, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        note = daybook_service.update_note(user=request.user, note=note, **serializer.validated_data)
        return Response(self.get_serializer(note).data)

    def destroy(self, request, *args, **kwargs):
        daybook_service.delete_note(user=request.user, note=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Daybook Plans"])
@extend_schema_view(
    list=extend_schema(
        summary="List my plans",
        description="Only your own plans. Paginated. `start` / `end` keep plans that overlap the window.",
        parameters=[
            *RANGE_PARAMS,
            _q("status", "`open`, `done` or `cancelled`."),
        ],
    ),
    retrieve=extend_schema(summary="Get a plan with its checklist"),
    create=extend_schema(
        summary="Create a plan",
        description=(
            "Body: `{title, start_date, end_date?, color?, item_titles?}`.\n\n"
            "- Omit `end_date` for a one-day plan; set it for a period (max 366 days).\n"
            "- `item_titles`: checklist lines, e.g. `[\"Call bank\", \"Send report\"]`.\n"
            "- New plans start as `open`."
        ),
    ),
    partial_update=extend_schema(
        summary="Edit a plan",
        description=(
            "Body: any of `{title, start_date, end_date, color, status}`.\n\n"
            "**State rules**\n"
            "- `open` → `done`: every item is checked and `closed_at` is set.\n"
            "- `cancelled`: the plan is hidden from the agenda and its items are locked.\n"
            "- back to `open`: reopens it.\n"
            "- Checking the last open item closes the plan automatically; unchecking reopens it.\n\n"
            "Move an unfinished plan to today by sending new `start_date` / `end_date`."
        ),
    ),
    destroy=extend_schema(summary="Delete a plan and its checklist"),
)
class PlanViewSet(viewsets.ModelViewSet):
    """Base: `/api/v1/daybook/plans/`"""

    permission_classes = [IsAuthenticated]
    serializer_class = PlanSerializer
    queryset = Plan.objects.none()
    lookup_value_regex = r"\d+"
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return daybook_service.plans_for(
            self.request.user,
            _date_param(self.request, "start"),
            _date_param(self.request, "end"),
            self.request.query_params.get("status") or None,
        )

    def get_object(self):
        return daybook_service.get_plan(self.request.user, self.kwargs["pk"])

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        plan = daybook_service.create_plan(
            user=request.user,
            title=data["title"],
            start_date=data["start_date"],
            end_date=data.get("end_date"),
            color=data.get("color"),
            items=data.get("item_titles"),
        )
        return Response(self.get_serializer(plan).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        plan = self.get_object()
        serializer = self.get_serializer(plan, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        fields = {
            key: value
            for key, value in serializer.validated_data.items()
            if key in {"title", "start_date", "end_date", "color", "status"}
        }
        plan = daybook_service.update_plan(user=request.user, plan=plan, **fields)
        return Response(self.get_serializer(plan).data)

    def destroy(self, request, *args, **kwargs):
        daybook_service.delete_plan(user=request.user, plan=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        summary="Add a checklist item",
        description="Body: `{title}`. Adding to a `done` plan reopens it. Returns the whole plan.",
        request=PlanItemWriteSerializer,
        responses={201: PlanSerializer},
    )
    @action(detail=True, methods=["post"])
    def items(self, request, pk=None):
        plan = self.get_object()
        serializer = PlanItemWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        daybook_service.add_item(
            user=request.user,
            plan=plan,
            title=serializer.validated_data.get("title", ""),
        )
        plan = daybook_service.get_plan(request.user, plan.pk)
        return Response(self.get_serializer(plan).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        methods=["PATCH"],
        summary="Check, rename or move a checklist item",
        description=(
            "Body: any of `{is_done, title, position}`. Returns the whole plan so the "
            "client sees the new progress and status in one response."
        ),
        request=PlanItemWriteSerializer,
        responses={200: PlanSerializer},
    )
    @extend_schema(
        methods=["DELETE"],
        summary="Remove a checklist item",
        responses={200: PlanSerializer},
    )
    @action(detail=True, methods=["patch", "delete"], url_path=r"items/(?P<item_id>\d+)")
    def item_detail(self, request, pk=None, item_id=None):
        plan = self.get_object()
        item = daybook_service.get_item(plan, item_id)
        if request.method == "DELETE":
            daybook_service.delete_item(user=request.user, plan=plan, item=item)
        else:
            serializer = PlanItemWriteSerializer(data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            daybook_service.update_item(
                user=request.user,
                plan=plan,
                item=item,
                **serializer.validated_data,
            )
        plan = daybook_service.get_plan(request.user, plan.pk)
        return Response(self.get_serializer(plan).data)
