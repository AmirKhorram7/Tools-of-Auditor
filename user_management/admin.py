from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.core.exceptions import PermissionDenied
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, render
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _

from user_management.models import (
    BuilderContactClick,
    CustomUser,
    Profile,
    Ticket,
    TicketMessage,
    TicketStatus,
)
from user_management.ranking import build_explanation_ranking, build_work_ranking
from user_management.reports import build_user_activity


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = "Profile"
    fk_name = "user"
    extra = 0


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    model = CustomUser
    change_form_template = "admin/user_management/customuser/change_form.html"
    change_list_template = "admin/user_management/customuser/change_list.html"
    list_display = (
        "id",
        "first_name",
        "last_name",
        "phone_number",
        "is_phone_verified",
        "is_active",
        "last_login",
        "folder_count",
        "process_count",
        "activity_link",
    )
    list_filter = ("is_phone_verified", "is_staff", "is_active", "last_login", "date_joined")
    search_fields = ("phone_number", "first_name", "last_name")
    ordering = ("-date_joined",)
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

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .annotate(
                folder_count=Count(
                    "owned_projects",
                    filter=Q(
                        owned_projects__parent__isnull=True,
                        owned_projects__is_deleted=False,
                    ),
                    distinct=True,
                ),
                process_count=Count(
                    "owned_processes",
                    filter=Q(owned_processes__is_deleted=False),
                    distinct=True,
                ),
            )
        )

    def get_urls(self):
        urls = super().get_urls()
        extra = [
            path(
                "ranking/explanation/",
                self.admin_site.admin_view(self.explanation_ranking_view),
                name="user_explanation_ranking",
            ),
            path(
                "ranking/work/",
                self.admin_site.admin_view(self.work_ranking_view),
                name="user_work_ranking",
            ),
            path(
                "<int:user_id>/activity/",
                self.admin_site.admin_view(self.activity_report_view),
                name="user_activity_report",
            ),
        ]
        return extra + urls

    def _ranking_view(self, request, builder):
        if not self.has_view_permission(request):
            raise PermissionDenied
        context = {
            **self.admin_site.each_context(request),
            **builder(),
            "opts": self.model._meta,
            "has_view_permission": True,
        }
        return render(
            request,
            "admin/user_management/customuser/ranking_report.html",
            context,
        )

    def explanation_ranking_view(self, request):
        return self._ranking_view(request, build_explanation_ranking)

    def work_ranking_view(self, request):
        return self._ranking_view(request, build_work_ranking)

    def activity_report_view(self, request, user_id):
        user = get_object_or_404(
            CustomUser.objects.select_related("profile"),
            pk=user_id,
        )
        context = {
            **self.admin_site.each_context(request),
            **build_user_activity(user),
            "opts": self.model._meta,
            "has_view_permission": self.has_view_permission(request, user),
        }
        return render(
            request,
            "admin/user_management/customuser/activity_report.html",
            context,
        )

    @admin.display(description=_("Folders"), ordering="folder_count")
    def folder_count(self, obj):
        return obj.folder_count

    @admin.display(description=_("Processes"), ordering="process_count")
    def process_count(self, obj):
        return obj.process_count

    @admin.display(description=_("Activity"))
    def activity_link(self, obj):
        url = reverse("admin:user_activity_report", args=[obj.pk])
        return format_html('<a class="button" href="{}">{}</a>', url, _("Open report"))


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


@admin.register(BuilderContactClick)
class BuilderContactClickAdmin(admin.ModelAdmin):
    list_display = ("id", "user_label", "channel", "page", "created_at")
    list_filter = ("channel", "created_at")
    search_fields = (
        "user__phone_number",
        "user__first_name",
        "user__last_name",
        "page",
    )
    date_hierarchy = "created_at"
    readonly_fields = ("user", "channel", "page", "created_at")
    ordering = ("-created_at",)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("user")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description=_("User"), ordering="user")
    def user_label(self, obj):
        if not obj.user_id:
            return _("Guest (not logged in)")
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        phone = obj.user.phone_number
        return f"{name} ({phone})" if name else phone


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
