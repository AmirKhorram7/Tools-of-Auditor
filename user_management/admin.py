from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from user_management.models import (
    CustomUser,
    Profile,
    Ticket,
    TicketMessage,
    TicketStatus,
)


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = "Profile"
    fk_name = "user"
    extra = 0


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    model = CustomUser
    list_display = (
        "id",
        "first_name",
        "last_name",
        "phone_number",
        "is_phone_verified",
        "is_staff",
        "is_active",
    )
    list_filter = ("is_phone_verified", "is_staff", "is_active")
    search_fields = ("phone_number", "first_name", "last_name")
    ordering = ("id",)
    fieldsets = (
        (None, {"fields": ("phone_number", "password")}),
        (_("Personal info"), {"fields": ("first_name", "last_name")}),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "phone_number",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
    )
    inlines = [ProfileInline]


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "user__first_name",
        "user__last_name",
        "company_name",
        "job_title",
        "created_at",
    )
    search_fields = (
        "user__first_name",
        "user__last_name",
        "user__phone_number",
        "company_name",
        "job_title",
    )
    readonly_fields = ("created_at", "updated_at")


class TicketMessageInline(admin.TabularInline):
    """
    Read past messages and type a new reply in the empty row at the bottom.
    New rows are attributed to the logged-in staff user automatically.
    """

    model = TicketMessage
    extra = 1
    fields = ("message", "is_admin_message", "created_at")
    readonly_fields = ("is_admin_message", "created_at")
    ordering = ("created_at",)
    verbose_name = _("Message")
    verbose_name_plural = _("Messages — type your reply in the empty row below")


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "subject",
        "user_display",
        "phone",
        "status",
        "priority",
        "created_at",
        "updated_at",
    )
    list_filter = ("status", "priority", "created_at")
    search_fields = (
        "subject",
        "user__phone_number",
        "user__first_name",
        "user__last_name",
        "messages__message",
    )
    readonly_fields = ("created_at", "updated_at", "closed_at")
    autocomplete_fields = ("user",)
    inlines = [TicketMessageInline]
    date_hierarchy = "created_at"

    @admin.display(description=_("User"), ordering="user__first_name")
    def user_display(self, obj):
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name or "—"

    @admin.display(description=_("Phone"), ordering="user__phone_number")
    def phone(self, obj):
        return obj.user.phone_number

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        replied = False
        for obj in instances:
            if isinstance(obj, TicketMessage):
                is_new = obj.pk is None
                if is_new:
                    obj.sender = request.user
                    obj.is_admin_message = True
                    replied = True
                obj.save()
        for obj in formset.deleted_objects:
            obj.delete()
        formset.save_m2m()

        ticket = form.instance
        if replied and ticket.status != TicketStatus.CLOSED:
            ticket.status = TicketStatus.WAITING_FOR_USER
            ticket.save(update_fields=["status", "updated_at"])
