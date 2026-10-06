from rest_framework import serializers

from subscription_services.models import Subscription


class PlanOfferSerializer(serializers.Serializer):
    cycle = serializers.ChoiceField(choices=Subscription.Cycle.choices)
    price_rial = serializers.IntegerField()
    days = serializers.IntegerField()
    months = serializers.IntegerField()


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = [
            "id",
            "reference",
            "cycle",
            "status",
            "price_rial",
            "days",
            "starts_at",
            "ends_at",
            "activated_at",
            "created_at",
        ]
        read_only_fields = fields


class SubscriptionStatusSerializer(serializers.Serializer):
    is_pro = serializers.BooleanField()
    pro_until = serializers.DateTimeField(allow_null=True)
    current = SubscriptionSerializer(allow_null=True)
    pending = SubscriptionSerializer(allow_null=True)
    history = SubscriptionSerializer(many=True)


class CheckoutSerializer(serializers.Serializer):
    cycle = serializers.ChoiceField(choices=Subscription.Cycle.choices)


class ActivateSerializer(serializers.Serializer):
    payment_ref = serializers.CharField(required=False, allow_blank=True, max_length=120)
