from django.contrib import admin, messages
from rest_framework.exceptions import ValidationError as ApiValidationError

from subscription_services.models import Subscription
from subscription_services.services.subscriptions import CATALOG, SubscriptionService


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("reference", "user", "cycle", "status", "price_rial", "starts_at", "ends_at", "created_at")
    list_filter = ("status", "cycle")
    search_fields = ("reference", "user__phone_number", "payment_ref")
    autocomplete_fields = ("user",)
    readonly_fields = (
        "reference",
        "status",
        "price_rial",
        "days",
        "starts_at",
        "ends_at",
        "activated_at",
        "activated_by",
        "created_at",
        "updated_at",
    )
    actions = ["activate_selected"]
    date_hierarchy = "created_at"

    def get_fields(self, request, obj=None):
        if obj is None:
            return ("user", "cycle", "payment_ref")
        return (
            "user",
            "cycle",
            "status",
            "reference",
            "price_rial",
            "days",
            "starts_at",
            "ends_at",
            "payment_ref",
            "activated_at",
            "activated_by",
            "created_at",
            "updated_at",
        )

    def get_readonly_fields(self, request, obj=None):
        if obj is None:
            return self.readonly_fields
        return self.readonly_fields + ("user", "cycle")

    def save_model(self, request, obj, form, change):
        if change:
            super().save_model(request, obj, form, change)
            return
        granted = SubscriptionService().grant(
            user=obj.user,
            cycle=obj.cycle,
            actor=request.user,
            payment_ref=obj.payment_ref,
        )
        obj.pk = granted.pk
        for field in granted._meta.fields:
            setattr(obj, field.attname, getattr(granted, field.attname))
        offer = CATALOG[granted.cycle]
        self.message_user(
            request,
            (
                f"Pro granted for {offer['days']} days "
                f"({offer['price_rial']:,} Rial). Reference {granted.reference}."
            ),
            messages.SUCCESS,
        )

    @admin.action(description="Activate selected paid orders")
    def activate_selected(self, request, queryset):
        service = SubscriptionService()
        done = 0
        skipped = 0
        for row in queryset:
            try:
                service.activate(subscription_id=row.pk, actor=request.user)
            except ApiValidationError:
                skipped += 1
                continue
            done += 1
        if done:
            self.message_user(request, f"{done} order(s) activated.", messages.SUCCESS)
        if skipped:
            self.message_user(
                request,
                f"{skipped} row(s) skipped (already cancelled, or not pending).",
                messages.WARNING,
            )
