from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from reminder_services.api.v1.serializers import (
    ChannelStatusSerializer,
    ContactSerializer,
    GroupSerializer,
    ReminderCreateSerializer,
    ReminderSerializer,
)
from reminder_services.models import Reminder, ReminderGroup
from reminder_services.services.reminders import ReminderService

reminder_service = ReminderService()

PRO_NOTE = "\n\nNeeds an active **Pro** subscription. Without it the API answers `402` with code `pro_required`."
SPEC_DOC = (
    "- `channels`: any of `email`, `telegram`, `whatsapp`, `sms`.\n"
    "- `mode: before` → `offset_days` (0–60) and `at_time` (`HH:MM`, default 09:00, Tehran time). "
    "Counts back from the item's due date (a plan's end date, a note's date).\n"
    "- `mode: at` → `fixed_at`, an exact ISO date-time in the future."
)


@extend_schema(tags=["Reminders"])
class ChannelsView(APIView):
    """Base: `/api/v1/reminders/channels/`"""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Which channels can I use?",
        description="`available`: the platform has this provider set up. `has_address`: you saved where to receive it.",
        responses={200: ChannelStatusSerializer(many=True)},
    )
    def get(self, request):
        return Response(ChannelStatusSerializer(reminder_service.channel_status(request.user), many=True).data)


@extend_schema(tags=["Reminders"])
class ContactView(APIView):
    """Base: `/api/v1/reminders/contact/`"""

    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Where my reminders go", responses={200: ContactSerializer})
    def get(self, request):
        return Response(ContactSerializer(reminder_service.contact_for(request.user)).data)

    @extend_schema(
        summary="Update where my reminders go",
        description=(
            "Body: `{email?, telegram_chat_id?, whatsapp_number?}`. "
            "SMS always uses your account phone (`sms_number`, read only). "
            "Telegram needs your chat id: open the platform bot and press Start."
        ),
        request=ContactSerializer,
        responses={200: ContactSerializer},
    )
    def patch(self, request):
        serializer = ContactSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        contact = reminder_service.update_contact(request.user, **serializer.validated_data)
        return Response(ContactSerializer(contact).data)


@extend_schema(tags=["Reminder groups"])
@extend_schema_view(
    list=extend_schema(summary="List my reminder groups"),
    retrieve=extend_schema(summary="Get a reminder group"),
    create=extend_schema(
        summary="Create a reminder group",
        description="A reusable preset. Body: `{name, channels, mode, offset_days?, at_time?, fixed_at?}`.\n\n"
        + SPEC_DOC
        + PRO_NOTE,
    ),
    partial_update=extend_schema(
        summary="Edit a reminder group",
        description="Scheduled reminders that use this group move to the new timing." + PRO_NOTE,
    ),
    destroy=extend_schema(
        summary="Delete a reminder group",
        description="Reminders already made from it keep their own copy of the timing.",
    ),
)
class GroupViewSet(viewsets.ModelViewSet):
    """Base: `/api/v1/reminders/groups/`"""

    permission_classes = [IsAuthenticated]
    serializer_class = GroupSerializer
    queryset = ReminderGroup.objects.none()
    lookup_value_regex = r"\d+"
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return reminder_service.groups_for(self.request.user)

    def get_object(self):
        return reminder_service.get_group(self.request.user, self.kwargs["pk"])

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = reminder_service.create_group(user=request.user, **serializer.validated_data)
        return Response(self.get_serializer(group).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        group = self.get_object()
        serializer = self.get_serializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        group = reminder_service.update_group(user=request.user, group=group, **serializer.validated_data)
        return Response(self.get_serializer(group).data)

    def destroy(self, request, *args, **kwargs):
        reminder_service.delete_group(user=request.user, group=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Reminders"])
@extend_schema_view(
    list=extend_schema(
        summary="List my reminders",
        description="Filter one item with `target_type` + `target_id` (e.g. `daybook.plan` / `12`).",
        parameters=[
            OpenApiParameter("target_type", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("target_id", OpenApiTypes.INT, OpenApiParameter.QUERY),
        ],
    ),
    create=extend_schema(
        summary="Add a reminder to an item",
        description=(
            "Body: `{target_type, target_id, group?}` to use a saved group, **or** "
            "`{target_type, target_id, channels, mode, ...}` to set it by hand.\n\n"
            "Targets: `daybook.plan`, `daybook.note`. You can only target your own items. "
            "Max 5 reminders per item. The time must be in the future.\n\n"
            "Message: a plan sends its title and due date; a note sends its title and first lines.\n\n"
            + SPEC_DOC
            + PRO_NOTE
        ),
        request=ReminderCreateSerializer,
        responses={201: ReminderSerializer},
    ),
    destroy=extend_schema(summary="Remove a reminder"),
)
class ReminderViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Base: `/api/v1/reminders/items/`"""

    permission_classes = [IsAuthenticated]
    serializer_class = ReminderSerializer
    queryset = Reminder.objects.none()
    lookup_value_regex = r"\d+"
    pagination_class = None

    def get_queryset(self):
        params = self.request.query_params
        target_id = params.get("target_id")
        return reminder_service.reminders_for(
            self.request.user,
            params.get("target_type") or None,
            int(target_id) if target_id and target_id.isdigit() else None,
        )

    def create(self, request, *args, **kwargs):
        serializer = ReminderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        reminder = reminder_service.create_reminder(
            user=request.user,
            target_type=data.pop("target_type"),
            target_id=data.pop("target_id"),
            group_id=data.pop("group", None),
            **data,
        )
        return Response(ReminderSerializer(reminder).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        reminder = reminder_service.get_reminder(request.user, kwargs["pk"])
        reminder_service.delete_reminder(user=request.user, reminder=reminder)
        return Response(status=status.HTTP_204_NO_CONTENT)
