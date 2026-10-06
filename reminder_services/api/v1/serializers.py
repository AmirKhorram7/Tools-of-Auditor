from rest_framework import serializers

from reminder_services.models import Channel, Mode, Reminder, ReminderContact, ReminderGroup

SPEC_FIELDS = ["channels", "mode", "offset_days", "at_time", "fixed_at"]


class ChannelStatusSerializer(serializers.Serializer):
    channel = serializers.ChoiceField(choices=Channel.choices)
    available = serializers.BooleanField(help_text="The platform can send on this channel.")
    has_address = serializers.BooleanField(help_text="You saved where to receive it.")


class ContactSerializer(serializers.ModelSerializer):
    sms_number = serializers.CharField(source="user.phone_number", read_only=True)
    telegram_chat_id = serializers.RegexField(r"^-?\d{3,20}$", required=False, allow_blank=True)
    whatsapp_number = serializers.RegexField(r"^\+?\d{8,15}$", required=False, allow_blank=True)

    class Meta:
        model = ReminderContact
        fields = ["email", "telegram_chat_id", "whatsapp_number", "sms_number"]


class SpecSerializer(serializers.Serializer):
    channels = serializers.ListField(
        child=serializers.ChoiceField(choices=Channel.choices),
        allow_empty=False,
        max_length=4,
    )
    mode = serializers.ChoiceField(choices=Mode.choices, default=Mode.BEFORE)
    offset_days = serializers.IntegerField(required=False, min_value=0, max_value=60)
    at_time = serializers.TimeField(required=False, allow_null=True)
    fixed_at = serializers.DateTimeField(required=False, allow_null=True)


class GroupSerializer(serializers.ModelSerializer):
    channels = serializers.ListField(
        child=serializers.ChoiceField(choices=Channel.choices),
        allow_empty=False,
        max_length=4,
    )

    class Meta:
        model = ReminderGroup
        fields = ["id", "name", *SPEC_FIELDS, "created_at"]
        read_only_fields = ["id", "created_at"]


class ReminderSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True, default=None)

    class Meta:
        model = Reminder
        fields = [
            "id",
            "target_type",
            "target_id",
            "group",
            "group_name",
            *SPEC_FIELDS,
            "send_at",
            "status",
            "results",
            "sent_at",
            "created_at",
        ]
        read_only_fields = fields


class ReminderCreateSerializer(serializers.Serializer):
    target_type = serializers.CharField(max_length=40)
    target_id = serializers.IntegerField(min_value=1)
    group = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    channels = serializers.ListField(
        child=serializers.ChoiceField(choices=Channel.choices),
        required=False,
        max_length=4,
    )
    mode = serializers.ChoiceField(choices=Mode.choices, required=False)
    offset_days = serializers.IntegerField(required=False, min_value=0, max_value=60)
    at_time = serializers.TimeField(required=False, allow_null=True)
    fixed_at = serializers.DateTimeField(required=False, allow_null=True)
