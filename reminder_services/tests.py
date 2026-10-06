"""Smoke + security tests for /api/v1/reminders/ with daybook targets."""

from datetime import date, datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from reminder_services.jalali import format_fa, to_jalali
from reminder_services.models import Reminder
from reminder_services.services.reminders import ReminderService
from subscription_services.services.subscriptions import SubscriptionService

User = get_user_model()
RM = "/api/v1/reminders"
DB = "/api/v1/daybook"


@override_settings(REMINDER_DRY_RUN=True, SITE_URL="https://tauditor.test")
class ReminderTests(APITestCase):
    def setUp(self):
        self.pro = User.objects.create_user(
            phone_number="09125550001", password="Rem#2026", first_name="علی", last_name="رضایی"
        )
        self.free = User.objects.create_user(phone_number="09125550002", password="Rem#2026")
        staff = User.objects.create_user(phone_number="09125550003", password="Rem#2026", is_staff=True)
        subs = SubscriptionService()
        order = subs.checkout(user=self.pro, cycle="monthly")
        subs.activate(subscription_id=order.pk, actor=staff)
        self.pro_c = self._client(self.pro)
        self.free_c = self._client(self.free)
        self.soon = date.today() + timedelta(days=5)

    def _client(self, user):
        client = self.client_class()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
        return client

    def _plan(self, client, end=None):
        res = client.post(
            f"{DB}/plans/",
            {
                "title": "بستن حساب‌ها",
                "start_date": date.today().isoformat(),
                "end_date": (end or self.soon).isoformat(),
                "item_titles": ["تطبیق بانک"],
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data

    def test_jalali_conversion(self):
        self.assertEqual(to_jalali(date(2026, 10, 6)), (1405, 7, 14))
        self.assertEqual(to_jalali(date(2025, 3, 21)), (1404, 1, 1))
        self.assertEqual(format_fa(date(2026, 10, 6)), "۱۴ مهر ۱۴۰۵")

    def test_group_before_mode_end_to_end(self):
        group = self.pro_c.post(
            f"{RM}/groups/",
            {"name": "پیام‌های فوری", "channels": ["sms", "telegram"], "mode": "before", "offset_days": 1, "at_time": "08:00"},
            format="json",
        )
        self.assertEqual(group.status_code, status.HTTP_201_CREATED, group.data)
        self.assertEqual(group.data["channels"], ["telegram", "sms"])

        self.pro_c.patch(f"{RM}/contact/", {"telegram_chat_id": "123456789"}, format="json")
        plan = self._plan(self.pro_c)
        rem = self.pro_c.post(
            f"{RM}/items/",
            {"target_type": "daybook.plan", "target_id": plan["id"], "group": group.data["id"]},
            format="json",
        )
        self.assertEqual(rem.status_code, status.HTTP_201_CREATED, rem.data)
        expected = timezone.make_aware(datetime.combine(self.soon - timedelta(days=1), time(8, 0)))
        self.assertEqual(Reminder.objects.get(pk=rem.data["id"]).send_at, expected)

        later = self.soon + timedelta(days=3)
        self.pro_c.patch(f"{DB}/plans/{plan['id']}/", {"end_date": later.isoformat()}, format="json")
        moved = Reminder.objects.get(pk=rem.data["id"])
        self.assertEqual(moved.send_at.date(), later - timedelta(days=1))

        sent = ReminderService().send_due(now=moved.send_at + timedelta(minutes=1))
        self.assertEqual(sent, 1)
        moved.refresh_from_db()
        self.assertEqual(moved.status, "sent")
        self.assertEqual(moved.results, {"telegram": "logged", "sms": "logged"})
        self.assertIn("علی رضایی", moved.message)
        self.assertIn("بستن حساب‌ها", moved.message)
        self.assertIn("بازه", moved.message)
        self.assertTrue(moved.message.endswith(f"https://tauditor.test/daybook?plan={plan['id']}"))

    def test_long_title_is_clipped_only_on_sms(self):
        title = "ب" * 80
        created = self.pro_c.post(
            f"{DB}/plans/",
            {
                "title": title,
                "start_date": date.today().isoformat(),
                "end_date": self.soon.isoformat(),
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        rem = self.pro_c.post(
            f"{RM}/items/",
            {
                "target_type": "daybook.plan",
                "target_id": created.data["id"],
                "channels": ["sms"],
                "mode": "before",
                "offset_days": 1,
            },
            format="json",
        )
        self.assertEqual(rem.status_code, status.HTTP_201_CREATED, rem.data)
        row = Reminder.objects.get(pk=rem.data["id"])
        ReminderService().send_due(now=row.send_at + timedelta(minutes=1))
        row.refresh_from_db()
        self.assertIn(title, row.message)
        self.assertTrue(row.message.endswith(f"https://tauditor.test/daybook?plan={created.data['id']}"))
        from reminder_services.services.channels import SMS_TITLE_MAX, sms_values

        short = sms_values(name="علی رضایی", title=title, period="۱۴ مهر")["TITLE"]
        self.assertEqual(len(short), SMS_TITLE_MAX)
        self.assertTrue(short.endswith("…"))
        self.assertNotEqual(short, title)

    def test_manual_at_reminder_on_a_note(self):
        note = self.pro_c.post(
            f"{DB}/notes/",
            {"date": date.today().isoformat(), "title": "ایده", "body": "<p>" + "متن بلند " * 40 + "</p>"},
            format="json",
        ).data
        at = (timezone.now() + timedelta(hours=3)).replace(microsecond=0)
        rem = self.pro_c.post(
            f"{RM}/items/",
            {"target_type": "daybook.note", "target_id": note["id"], "channels": ["email"], "mode": "at", "fixed_at": at.isoformat()},
            format="json",
        )
        self.assertEqual(rem.status_code, status.HTTP_201_CREATED, rem.data)
        listed = self.pro_c.get(f"{RM}/items/", {"target_type": "daybook.note", "target_id": note["id"]})
        self.assertEqual(len(listed.data), 1)

        self.pro_c.patch(f"{RM}/contact/", {"email": "ali@example.com"}, format="json")
        row = Reminder.objects.get(pk=rem.data["id"])
        ReminderService().send_due(now=row.send_at + timedelta(minutes=1))
        row.refresh_from_db()
        self.assertEqual(row.status, "sent")
        self.assertIn("ایده", row.message)
        self.assertIn("متن بلند", row.message)
        self.assertTrue(row.message.endswith(f"https://tauditor.test/daybook?note={note['id']}"))

        self.pro_c.delete(f"{DB}/notes/{note['id']}/")
        self.assertFalse(Reminder.objects.filter(pk=rem.data["id"]).exists())

    def test_clip_message_keeps_trailing_url(self):
        from reminder_services.services.channels import clip_message

        url = "https://tauditor.test/daybook?note=9"
        clipped = clip_message(("x" * 200) + "\n\n" + url, 80)
        self.assertTrue(clipped.endswith(url))
        self.assertLessEqual(len(clipped), 80)
        self.assertIn("…", clipped)

    def test_free_user_gets_402(self):
        res = self.free_c.post(
            f"{RM}/groups/",
            {"name": "x", "channels": ["sms"], "mode": "before", "offset_days": 1},
            format="json",
        )
        self.assertEqual(res.status_code, 402)
        self.assertEqual(res.data["detail"].code, "pro_required")
        plan = self._plan(self.free_c)
        res = self.free_c.post(
            f"{RM}/items/",
            {"target_type": "daybook.plan", "target_id": plan["id"], "channels": ["sms"], "mode": "before"},
            format="json",
        )
        self.assertEqual(res.status_code, 402)
        self.assertEqual(self.free_c.get(f"{RM}/channels/").status_code, status.HTTP_200_OK)

    def test_expired_subscription_skips_send(self):
        plan = self._plan(self.pro_c)
        rem = ReminderService().create_reminder(
            user=self.pro, target_type="daybook.plan", target_id=plan["id"], channels=["sms"], mode="before", offset_days=1
        )
        self.pro.subscriptions.update(ends_at=timezone.now() - timedelta(minutes=1))
        ReminderService().send_due(now=rem.send_at + timedelta(minutes=1))
        rem.refresh_from_db()
        self.assertEqual(rem.status, "skipped")

    def test_security(self):
        self.assertEqual(self.client.get(f"{RM}/items/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(f"{RM}/groups/").status_code, status.HTTP_401_UNAUTHORIZED)

        other_plan = self._plan(self.free_c)
        res = self.pro_c.post(
            f"{RM}/items/",
            {"target_type": "daybook.plan", "target_id": other_plan["id"], "channels": ["sms"], "mode": "before"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        res = self.pro_c.post(
            f"{RM}/items/",
            {"target_type": "user_management.user", "target_id": self.free.id, "channels": ["sms"]},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        plan = self._plan(self.pro_c)
        past = self.pro_c.post(
            f"{RM}/items/",
            {"target_type": "daybook.plan", "target_id": plan["id"], "channels": ["sms"], "mode": "at",
             "fixed_at": (timezone.now() - timedelta(hours=1)).isoformat()},
            format="json",
        )
        self.assertEqual(past.status_code, status.HTTP_400_BAD_REQUEST)
        bad = self.pro_c.post(
            f"{RM}/items/",
            {"target_type": "daybook.plan", "target_id": plan["id"], "channels": ["pigeon"]},
            format="json",
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        bad_contact = self.pro_c.patch(f"{RM}/contact/", {"telegram_chat_id": "abc;drop"}, format="json")
        self.assertEqual(bad_contact.status_code, status.HTTP_400_BAD_REQUEST)

        mine = self.pro_c.post(
            f"{RM}/items/",
            {"target_type": "daybook.plan", "target_id": plan["id"], "channels": ["sms"], "mode": "before", "offset_days": 1},
            format="json",
        )
        self.assertEqual(self.free_c.delete(f"{RM}/items/{mine.data['id']}/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.free_c.get(f"{RM}/items/").data, [])
        group = self.pro_c.post(
            f"{RM}/groups/", {"name": "g", "channels": ["email"], "mode": "before"}, format="json"
        ).data
        self.assertEqual(
            self.free_c.patch(f"{RM}/groups/{group['id']}/", {"name": "h"}, format="json").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(self.free_c.delete(f"{RM}/groups/{group['id']}/").status_code, status.HTTP_404_NOT_FOUND)
