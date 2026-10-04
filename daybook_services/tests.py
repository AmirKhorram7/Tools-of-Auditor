"""HTTP smoke + security tests for /api/v1/daybook/.

Smoke: settings → note on a day → plan for a period → check items until the
plan closes itself → agenda window → move / cancel / reopen → delete.
Security: no token, other users' data (IDOR), cross-plan items, stored XSS,
bad colours, inverted / huge windows, mass assignment of owner.
"""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from daybook_services.models import DayNote, Plan
from daybook_services.services.html import sanitize_html

User = get_user_model()
DB = "/api/v1/daybook"


def _results(payload):
    if isinstance(payload, dict) and "results" in payload:
        return payload["results"]
    return payload


class DaybookTestBase(APITestCase):
    def setUp(self):
        self.alice = self._user("09127770001", "آلیس")
        self.bob = self._user("09127770002", "باب")
        self.alice_c = self._client_for(self.alice)
        self.bob_c = self._client_for(self.bob)
        self.today = date.today()

    def _user(self, phone, first):
        return User.objects.create_user(
            phone_number=phone,
            password="Daybook#2026",
            first_name=first,
            last_name="دمو",
            is_phone_verified=True,
        )

    def _client_for(self, user):
        client = self.client_class()
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def _plan(self, client, **extra):
        body = {"title": "برنامه امروز", "start_date": self.today.isoformat(), **extra}
        res = client.post(f"{DB}/plans/", body, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data


class DaybookSmokeTests(DaybookTestBase):
    def test_settings_created_on_first_read_and_switchable(self):
        res = self.alice_c.get(f"{DB}/settings/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, {"calendar_system": "jalali", "default_view": "week"})

        res = self.alice_c.patch(
            f"{DB}/settings/",
            {"calendar_system": "gregorian", "default_view": "month"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["calendar_system"], "gregorian")
        self.assertEqual(self.alice_c.get(f"{DB}/settings/").data["default_view"], "month")
        self.assertEqual(self.bob_c.get(f"{DB}/settings/").data["calendar_system"], "jalali")

        bad = self.alice_c.patch(f"{DB}/settings/", {"default_view": "year"}, format="json")
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_note_lifecycle(self):
        res = self.alice_c.post(
            f"{DB}/notes/",
            {
                "date": self.today.isoformat(),
                "title": "ایده جلسه 💡",
                "body": '<p><span style="color: #0F766E; font-size: 18px">سلام</span> <b>دنیا</b> 🎯</p>',
                "color": "#0f766e",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        note_id = res.data["id"]
        self.assertEqual(res.data["color"], "#0F766E")
        self.assertIn("font-size: 18px", res.data["body"])
        self.assertIn("🎯", res.data["body"])

        listed = self.alice_c.get(
            f"{DB}/notes/",
            {"start": self.today.isoformat(), "end": self.today.isoformat()},
        )
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual([row["id"] for row in _results(listed.data)], [note_id])

        tomorrow = (self.today + timedelta(days=1)).isoformat()
        moved = self.alice_c.patch(
            f"{DB}/notes/{note_id}/",
            {"date": tomorrow, "is_pinned": True},
            format="json",
        )
        self.assertEqual(moved.status_code, status.HTTP_200_OK, moved.data)
        self.assertEqual(moved.data["date"], tomorrow)
        self.assertTrue(moved.data["is_pinned"])

        empty = self.alice_c.post(
            f"{DB}/notes/",
            {"date": self.today.isoformat(), "title": "  ", "body": "<p> </p>"},
            format="json",
        )
        self.assertEqual(empty.status_code, status.HTTP_400_BAD_REQUEST)

        self.assertEqual(
            self.alice_c.delete(f"{DB}/notes/{note_id}/").status_code,
            status.HTTP_204_NO_CONTENT,
        )
        self.assertFalse(DayNote.objects.filter(pk=note_id).exists())

    def test_plan_closes_when_last_item_is_checked(self):
        end = self.today + timedelta(days=4)
        plan = self._plan(
            self.alice_c,
            title="هفته بستن حساب‌ها",
            end_date=end.isoformat(),
            color="#166534",
            item_titles=["تطبیق بانک", "گزارش مدیر", "  "],
        )
        self.assertEqual(plan["status"], "open")
        self.assertEqual(plan["end_date"], end.isoformat())
        self.assertEqual([row["title"] for row in plan["items"]], ["تطبیق بانک", "گزارش مدیر"])
        self.assertEqual(plan["progress"], 0)
        first, second = (row["id"] for row in plan["items"])

        res = self.alice_c.patch(f"{DB}/plans/{plan['id']}/items/{first}/", {"is_done": True}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["progress"], 50)
        self.assertEqual(res.data["status"], "open")

        res = self.alice_c.patch(f"{DB}/plans/{plan['id']}/items/{second}/", {"is_done": True}, format="json")
        self.assertEqual(res.data["status"], "done")
        self.assertEqual(res.data["progress"], 100)
        self.assertIsNotNone(res.data["closed_at"])

        res = self.alice_c.patch(f"{DB}/plans/{plan['id']}/items/{second}/", {"is_done": False}, format="json")
        self.assertEqual(res.data["status"], "open")
        self.assertIsNone(res.data["closed_at"])

        res = self.alice_c.post(f"{DB}/plans/{plan['id']}/items/", {"title": "ارسال ایمیل"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["item_total"], 3)
        new_id = res.data["items"][-1]["id"]

        res = self.alice_c.patch(f"{DB}/plans/{plan['id']}/", {"status": "done"}, format="json")
        self.assertEqual(res.data["status"], "done")
        self.assertTrue(all(row["is_done"] for row in res.data["items"]))

        res = self.alice_c.delete(f"{DB}/plans/{plan['id']}/items/{new_id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["item_total"], 2)

    def test_agenda_shows_plans_that_overlap_the_window(self):
        long_plan = self._plan(
            self.alice_c,
            title="دوره ده‌روزه",
            start_date=(self.today - timedelta(days=3)).isoformat(),
            end_date=(self.today + timedelta(days=6)).isoformat(),
        )
        past_plan = self._plan(
            self.alice_c,
            title="گذشته",
            start_date=(self.today - timedelta(days=30)).isoformat(),
        )
        cancelled = self._plan(self.alice_c, title="لغو شده")
        self.alice_c.patch(f"{DB}/plans/{cancelled['id']}/", {"status": "cancelled"}, format="json")
        self.alice_c.post(
            f"{DB}/notes/",
            {"date": self.today.isoformat(), "title": "یادداشت"},
            format="json",
        )

        res = self.alice_c.get(
            f"{DB}/agenda/",
            {"start": self.today.isoformat(), "end": (self.today + timedelta(days=1)).isoformat()},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        plan_ids = {row["id"] for row in res.data["plans"]}
        self.assertIn(long_plan["id"], plan_ids)
        self.assertNotIn(past_plan["id"], plan_ids)
        self.assertNotIn(cancelled["id"], plan_ids)
        self.assertEqual(len(res.data["notes"]), 1)
        self.assertEqual(res.data["settings"]["calendar_system"], "jalali")

        default = self.alice_c.get(f"{DB}/agenda/")
        self.assertEqual(default.status_code, status.HTTP_200_OK)
        self.assertEqual(
            date.fromisoformat(default.data["end"]) - date.fromisoformat(default.data["start"]),
            timedelta(days=6),
        )

    def test_move_cancel_reopen_and_delete_plan(self):
        plan = self._plan(
            self.alice_c,
            start_date=(self.today - timedelta(days=2)).isoformat(),
            item_titles=["کار عقب‌افتاده"],
        )
        res = self.alice_c.patch(
            f"{DB}/plans/{plan['id']}/",
            {"start_date": self.today.isoformat()},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data["start_date"], self.today.isoformat())
        self.assertEqual(res.data["end_date"], self.today.isoformat())

        res = self.alice_c.patch(f"{DB}/plans/{plan['id']}/", {"status": "cancelled"}, format="json")
        self.assertEqual(res.data["status"], "cancelled")
        item_id = res.data["items"][0]["id"]
        locked = self.alice_c.patch(
            f"{DB}/plans/{plan['id']}/items/{item_id}/", {"is_done": True}, format="json"
        )
        self.assertEqual(locked.status_code, status.HTTP_400_BAD_REQUEST)

        res = self.alice_c.patch(f"{DB}/plans/{plan['id']}/", {"status": "open"}, format="json")
        self.assertEqual(res.data["status"], "open")

        filtered = self.alice_c.get(f"{DB}/plans/", {"status": "open"})
        self.assertEqual([row["id"] for row in _results(filtered.data)], [plan["id"]])

        self.assertEqual(
            self.alice_c.delete(f"{DB}/plans/{plan['id']}/").status_code,
            status.HTTP_204_NO_CONTENT,
        )
        self.assertFalse(Plan.objects.filter(pk=plan["id"]).exists())


class DaybookSecurityTests(DaybookTestBase):
    def test_every_endpoint_requires_a_token(self):
        for method, path in [
            ("get", f"{DB}/settings/"),
            ("patch", f"{DB}/settings/"),
            ("get", f"{DB}/agenda/"),
            ("get", f"{DB}/notes/"),
            ("post", f"{DB}/notes/"),
            ("get", f"{DB}/plans/"),
            ("post", f"{DB}/plans/"),
            ("post", f"{DB}/plans/1/items/"),
            ("patch", f"{DB}/plans/1/items/1/"),
        ]:
            res = getattr(self.client, method)(path, {}, format="json")
            self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED, f"{method} {path}")

    def test_bad_token_is_rejected(self):
        client = self.client_class()
        client.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")
        self.assertEqual(client.get(f"{DB}/agenda/").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_users_cannot_see_or_touch_each_others_notes(self):
        note = self.alice_c.post(
            f"{DB}/notes/",
            {"date": self.today.isoformat(), "title": "خصوصی"},
            format="json",
        ).data
        self.assertEqual(self.bob_c.get(f"{DB}/notes/{note['id']}/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            self.bob_c.patch(f"{DB}/notes/{note['id']}/", {"title": "هک"}, format="json").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(self.bob_c.delete(f"{DB}/notes/{note['id']}/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(_results(self.bob_c.get(f"{DB}/notes/").data), [])
        self.assertEqual(self.bob_c.get(f"{DB}/agenda/").data["notes"], [])
        self.assertEqual(DayNote.objects.get(pk=note["id"]).title, "خصوصی")

    def test_users_cannot_see_or_touch_each_others_plans_or_items(self):
        plan = self._plan(self.alice_c, item_titles=["مورد آلیس"])
        item_id = plan["items"][0]["id"]
        base = f"{DB}/plans/{plan['id']}"
        self.assertEqual(self.bob_c.get(f"{base}/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            self.bob_c.patch(f"{base}/", {"status": "done"}, format="json").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.bob_c.post(f"{base}/items/", {"title": "x"}, format="json").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.bob_c.patch(f"{base}/items/{item_id}/", {"is_done": True}, format="json").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(self.bob_c.delete(f"{base}/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(_results(self.bob_c.get(f"{DB}/plans/").data), [])
        self.assertEqual(Plan.objects.get(pk=plan["id"]).status, "open")

    def test_item_from_another_plan_cannot_be_reached_through_my_plan(self):
        alice_plan = self._plan(self.alice_c, item_titles=["آلیس"])
        bob_plan = self._plan(self.bob_c, item_titles=["باب"])
        alice_item = alice_plan["items"][0]["id"]
        res = self.bob_c.patch(
            f"{DB}/plans/{bob_plan['id']}/items/{alice_item}/",
            {"is_done": True},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        res = self.bob_c.delete(f"{DB}/plans/{bob_plan['id']}/items/{alice_item}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_owner_cannot_be_mass_assigned(self):
        res = self.bob_c.post(
            f"{DB}/notes/",
            {"date": self.today.isoformat(), "title": "من", "owner": self.alice.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(DayNote.objects.get(pk=res.data["id"]).owner_id, self.bob.id)

    def test_note_html_is_sanitised(self):
        payload = (
            '<p onclick="steal()">سلام<script>alert(1)</script></p>'
            '<img src=x onerror="alert(2)">'
            '<a href="javascript:alert(3)">bad</a>'
            '<a href="https://example.com">good</a>'
            '<span style="color: red; background-image: url(javascript:x); position: fixed">رنگ</span>'
            "<iframe src='https://evil.example'></iframe>"
            "<style>body{display:none}</style>"
        )
        res = self.alice_c.post(
            f"{DB}/notes/",
            {"date": self.today.isoformat(), "body": payload},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        body = res.data["body"].lower()
        for bad in ("<script", "alert(1)", "onclick", "onerror", "<img", "javascript:", "<iframe", "<style", "position", "url("):
            self.assertNotIn(bad, body)
        self.assertIn('href="https://example.com"', body)
        self.assertIn('rel="noopener noreferrer"', body)
        self.assertIn("color: red", body)
        self.assertEqual(sanitize_html("<b>x</b><i>"), "<b>x</b><i></i>")

    def test_invalid_input_is_rejected(self):
        bad_color = self.alice_c.post(
            f"{DB}/notes/",
            {"date": self.today.isoformat(), "title": "x", "color": "red;}<script>"},
            format="json",
        )
        self.assertEqual(bad_color.status_code, status.HTTP_400_BAD_REQUEST)

        inverted = self.alice_c.post(
            f"{DB}/plans/",
            {
                "title": "وارونه",
                "start_date": self.today.isoformat(),
                "end_date": (self.today - timedelta(days=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(inverted.status_code, status.HTTP_400_BAD_REQUEST)

        too_long = self.alice_c.post(
            f"{DB}/plans/",
            {
                "title": "خیلی بلند",
                "start_date": self.today.isoformat(),
                "end_date": (self.today + timedelta(days=400)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(too_long.status_code, status.HTTP_400_BAD_REQUEST)

        too_many = self.alice_c.post(
            f"{DB}/plans/",
            {"title": "زیاد", "start_date": self.today.isoformat(), "item_titles": ["x"] * 101},
            format="json",
        )
        self.assertEqual(too_many.status_code, status.HTTP_400_BAD_REQUEST)

        no_title = self.alice_c.post(f"{DB}/plans/", {"start_date": self.today.isoformat()}, format="json")
        self.assertEqual(no_title.status_code, status.HTTP_400_BAD_REQUEST)

        for params in (
            {"start": "2026-13-40"},
            {"start": "2026-05-10", "end": "2026-05-01"},
            {"start": "2026-01-01", "end": "2026-12-31"},
        ):
            res = self.alice_c.get(f"{DB}/agenda/", params)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, params)

        bad_status = self.alice_c.get(f"{DB}/plans/", {"status": "hacked"})
        self.assertEqual(bad_status.status_code, status.HTTP_400_BAD_REQUEST)

        plan = self._plan(self.alice_c)
        res = self.alice_c.patch(f"{DB}/plans/{plan['id']}/", {"status": "archived"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        res = self.alice_c.patch(f"{DB}/plans/{plan['id']}/items/abc/", {"is_done": True}, format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
