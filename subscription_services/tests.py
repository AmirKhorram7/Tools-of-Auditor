"""Smoke + security tests for /api/v1/subscription/."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from subscription_services.models import Subscription
from subscription_services.services.subscriptions import SubscriptionService

User = get_user_model()
SUB = "/api/v1/subscription"


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class SubscriptionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number="09126660001", password="Pro#2026")
        self.other = User.objects.create_user(phone_number="09126660002", password="Pro#2026")
        self.staff = User.objects.create_user(phone_number="09126660003", password="Pro#2026", is_staff=True)
        self.user_c = self._client(self.user)
        self.other_c = self._client(self.other)
        self.staff_c = self._client(self.staff)

    def _client(self, user):
        client = self.client_class()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
        return client

    def test_plans_are_server_priced(self):
        res = self.user_c.get(f"{SUB}/plans/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        prices = {row["cycle"]: row["price_rial"] for row in res.data}
        self.assertEqual(prices, {"monthly": 2_000_000, "quarterly": 6_000_000, "yearly": 24_000_000})

    def test_checkout_then_staff_activation(self):
        me = self.user_c.get(f"{SUB}/me/").data
        self.assertFalse(me["is_pro"])

        order = self.user_c.post(
            f"{SUB}/checkout/",
            {"cycle": "quarterly", "price_rial": 1, "status": "active", "days": 9999},
            format="json",
        )
        self.assertEqual(order.status_code, status.HTTP_201_CREATED, order.data)
        self.assertEqual(order.data["status"], "pending")
        self.assertEqual(order.data["price_rial"], 6_000_000)
        self.assertEqual(order.data["days"], 90)
        self.assertTrue(order.data["reference"].startswith("TA-"))
        self.assertFalse(self.user_c.get(f"{SUB}/me/").data["is_pro"])

        again = self.user_c.post(f"{SUB}/checkout/", {"cycle": "monthly"}, format="json")
        self.assertEqual(Subscription.objects.get(pk=order.data["id"]).status, "cancelled")

        res = self.staff_c.post(
            f"{SUB}/staff/orders/{again.data['id']}/activate/",
            {"payment_ref": "BANK-123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["status"], "active")
        me = self.user_c.get(f"{SUB}/me/").data
        self.assertTrue(me["is_pro"])
        self.assertIsNone(me["pending"])

        twice = self.staff_c.post(f"{SUB}/staff/orders/{again.data['id']}/activate/", {}, format="json")
        self.assertEqual(twice.data["ends_at"], res.data["ends_at"])

    def test_staff_grant_sets_catalog_price_and_activates(self):
        service = SubscriptionService()
        row = service.grant(user=self.user, cycle="yearly", actor=self.staff, payment_ref="BANK-GRANT")
        self.assertEqual(row.status, "active")
        self.assertEqual(row.price_rial, 24_000_000)
        self.assertEqual(row.days, 365)
        self.assertEqual(row.payment_ref, "BANK-GRANT")
        self.assertTrue(service.is_pro(self.user))
        self.assertEqual(
            self.user_c.post(
                f"{SUB}/staff/orders/{row.id}/activate/",
                {},
                format="json",
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_early_renewal_stacks_after_current_period(self):
        service = SubscriptionService()
        first = service.checkout(user=self.user, cycle="monthly")
        first = service.activate(subscription_id=first.pk, actor=self.staff)
        second = service.checkout(user=self.user, cycle="monthly")
        second = service.activate(subscription_id=second.pk, actor=self.staff)
        self.assertEqual(second.starts_at, first.ends_at)
        self.assertEqual(service.pro_until(self.user), second.ends_at)

    def test_expired_period_is_not_pro(self):
        row = Subscription.objects.create(
            user=self.user,
            cycle="monthly",
            status="active",
            price_rial=2_000_000,
            days=30,
            reference="TA-EXPIRED1",
            starts_at=timezone.now() - timedelta(days=40),
            ends_at=timezone.now() - timedelta(days=10),
        )
        self.assertFalse(SubscriptionService().is_pro(self.user))
        self.assertEqual(row.status, "active")

    def test_security(self):
        self.assertEqual(self.client.get(f"{SUB}/me/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            self.client.post(f"{SUB}/checkout/", {"cycle": "monthly"}, format="json").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        bad = self.user_c.post(f"{SUB}/checkout/", {"cycle": "lifetime"}, format="json")
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

        order = self.user_c.post(f"{SUB}/checkout/", {"cycle": "yearly"}, format="json").data
        self.assertEqual(
            self.user_c.post(f"{SUB}/staff/orders/{order['id']}/activate/", {}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.other_c.post(f"{SUB}/orders/{order['id']}/cancel/", {}, format="json").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertFalse(self.other_c.get(f"{SUB}/me/").data["history"])

        cancelled = self.user_c.post(f"{SUB}/orders/{order['id']}/cancel/", {}, format="json")
        self.assertEqual(cancelled.data["status"], "cancelled")
        res = self.staff_c.post(f"{SUB}/staff/orders/{order['id']}/activate/", {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(self.user_c.get(f"{SUB}/me/").data["is_pro"])
