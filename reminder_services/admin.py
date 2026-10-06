from django.contrib import admin, messages
from django.utils import timezone

from reminder_services.models import Reminder, ReminderContact, ReminderGroup
from reminder_services.services.reminders import ReminderService


@admin.register(ReminderGroup)
class ReminderGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "mode", "offset_days", "at_time", "fixed_at")
    raw_id_fields = ("owner",)


@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    list_display = ("target_type", "target_id", "owner", "send_at", "status", "attempts")
    list_filter = ("status", "target_type", "mode")
    raw_id_fields = ("owner", "group")
    readonly_fields = ("results", "message", "sent_at", "attempts")
    actions = ["send_now"]

    @admin.action(description="Send selected reminders now")
    def send_now(self, request, queryset):
        service = ReminderService()
        now = timezone.now()
        done = 0
        for row in queryset.select_related("owner"):
            service._send_one(row, now)
            done += 1
        self.message_user(request, f"{done} reminder(s) processed. Check status and results.", messages.SUCCESS)


@admin.register(ReminderContact)
class ReminderContactAdmin(admin.ModelAdmin):
    list_display = ("user", "email", "telegram_chat_id", "whatsapp_number")
    raw_id_fields = ("user",)
