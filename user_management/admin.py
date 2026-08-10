from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from user_management.models import CustomUser, Profile, Ticket, TicketMessage


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = "Profile"
    fk_name = "user"
    extra = 0


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    model = CustomUser
    list_display = ("id","first_name","last_name", "phone_number", "is_phone_verified", "is_staff", "is_active")
    list_filter = ("is_phone_verified", "is_staff", "is_active")
    search_fields = ("phone_number", "first_name", "last_name")
    ordering = ("id",)
    fieldsets = (
        (None, {"fields": ("phone_number", "password")}),
        (_("Personal info"), {"fields": ("first_name", "last_name")}),
        (
            _("Permissions"),
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("phone_number", "password1", "password2", "is_staff", "is_superuser"),
            },
        ),
    )
    inlines = [ProfileInline]


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "user__first_name", "user__last_name", "company_name", "job_title", "created_at")
    search_fields = ("user__first_name", "user__last_name", "user__phone_number", "company_name", "job_title")
    readonly_fields = ("created_at", "updated_at")


class TicketMessageInline(admin.TabularInline):
    model = TicketMessage
    extra = 0
    fields = ("sender", "message", "is_admin_message", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("id", "subject", "user", "status", "priority", "created_at")
    list_filter = ("status", "priority")
    search_fields = ("subject", "user__phone_number")
    inlines = [TicketMessageInline]

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for obj in instances:
            if isinstance(obj, TicketMessage):
                if not obj.sender_id:
                    obj.sender = request.user
                obj.is_admin_message = True
                obj.save()
        for obj in formset.deleted_objects:
            obj.delete()
        formset.save_m2m()
