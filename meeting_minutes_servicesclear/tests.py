"""HTTP smoke tests for /api/v1/minutes/ (meeting_minutes_servicesclear).

Covers the path a company with many managers actually uses:
company → group → invite → accept → create minutes → items →
assignee status → close → carry-over → delete → create again
(including the soft-deleted meeting-number collision).
"""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from meeting_minutes_servicesclear.models import Meeting

User = get_user_model()
MM = "/api/v1/minutes"


def _results(payload):
    if isinstance(payload, dict) and "results" in payload:
        return payload["results"]
    return payload


class MinutesAPISmokeTests(APITestCase):
    """Owner, maintainer, guest, and outsider through one real session."""

    def setUp(self):
        self.owner = self._user("09128880001", "مالک", "دمو")
        self.maintainer = self._user("09128880002", "نگهدار", "دمو")
        self.guest = self._user("09128880003", "مهمان", "دمو")
        self.outsider = self._user("09128880004", "غریبه", "دمو")
        self.owner_c = self._client_for(self.owner)
        self.maintainer_c = self._client_for(self.maintainer)
        self.guest_c = self._client_for(self.guest)
        self.outsider_c = self._client_for(self.outsider)

    def _user(self, phone, first, last):
        return User.objects.create_user(
            phone_number=phone,
            password="MmDemo#2026",
            first_name=first,
            last_name=last,
            is_phone_verified=True,
        )

    def _client_for(self, user):
        client = self.client_class()
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def test_unauthenticated_minutes_are_rejected(self):
        response = self.client.get(f"{MM}/meetings/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        response = self.client.post(f"{MM}/meetings/", {"group": 1}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_login_works(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"phone_number": "09128880001", "password": "MmDemo#2026"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["phone_number"], "09128880001")

    def test_full_minutes_business_path(self):
        today = date.today()
        due = today + timedelta(days=7)

        company_res = self.owner_c.post(
            f"{MM}/companies/",
            {"name": "شرکت دمو صورت جلسه"},
            format="json",
        )
        self.assertEqual(company_res.status_code, status.HTTP_201_CREATED, company_res.data)
        company_id = company_res.data["id"]

        companies = self.owner_c.get(f"{MM}/companies/")
        self.assertEqual(companies.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row["id"] == company_id for row in _results(companies.data)))

        outsider_companies = self.outsider_c.get(f"{MM}/companies/")
        self.assertFalse(any(row["id"] == company_id for row in _results(outsider_companies.data)))

        group_res = self.owner_c.post(
            f"{MM}/groups/",
            {"company": company_id, "name": "گروه مدیران مالی"},
            format="json",
        )
        self.assertEqual(group_res.status_code, status.HTTP_201_CREATED, group_res.data)
        group_id = group_res.data["id"]
        self.assertTrue(group_res.data["is_default"])
        self.assertTrue(group_res.data["can_manage"])
        self.assertTrue(group_res.data["can_edit"])

        members = self.owner_c.get(f"{MM}/groups/{group_id}/members/")
        self.assertEqual(members.status_code, status.HTTP_200_OK)
        self.assertEqual(len(members.data), 1)
        self.assertEqual(members.data[0]["role"], "owner")

        invite_m = self.owner_c.post(
            f"{MM}/groups/{group_id}/invite/",
            {
                "phone_number": self.maintainer.phone_number,
                "role": "maintainer",
                "position_title": "دبیر جلسه",
            },
            format="json",
        )
        self.assertEqual(invite_m.status_code, status.HTTP_201_CREATED, invite_m.data)
        invite_m_id = invite_m.data["id"]

        invite_g = self.owner_c.post(
            f"{MM}/groups/{group_id}/invite/",
            {"phone_number": self.guest.phone_number, "role": "guest"},
            format="json",
        )
        self.assertEqual(invite_g.status_code, status.HTTP_201_CREATED, invite_g.data)
        invite_g_id = invite_g.data["id"]

        dup = self.owner_c.post(
            f"{MM}/groups/{group_id}/invite/",
            {"phone_number": self.maintainer.phone_number, "role": "maintainer"},
            format="json",
        )
        self.assertEqual(dup.status_code, status.HTTP_400_BAD_REQUEST)

        self_invite = self.owner_c.post(
            f"{MM}/groups/{group_id}/invite/",
            {"phone_number": self.owner.phone_number, "role": "guest"},
            format="json",
        )
        self.assertEqual(self_invite.status_code, status.HTTP_400_BAD_REQUEST)

        pending = self.owner_c.get(f"{MM}/groups/{group_id}/invitations/")
        self.assertEqual(pending.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(pending.data), 2)

        inbox = self.maintainer_c.get(f"{MM}/invitations/?scope=inbox")
        self.assertEqual(inbox.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row["id"] == invite_m_id for row in _results(inbox.data)))

        accept_m = self.maintainer_c.post(f"{MM}/invitations/{invite_m_id}/accept/")
        self.assertEqual(accept_m.status_code, status.HTTP_200_OK, accept_m.data)
        self.assertEqual(accept_m.data["status"], "accepted")

        accept_g = self.guest_c.post(f"{MM}/invitations/{invite_g_id}/accept/")
        self.assertEqual(accept_g.status_code, status.HTTP_200_OK, accept_g.data)

        members = self.owner_c.get(f"{MM}/groups/{group_id}/members/")
        self.assertEqual(len(members.data), 3)
        guest_member = next(row for row in members.data if row["user"] == self.guest.id)
        maintainer_member = next(row for row in members.data if row["user"] == self.maintainer.id)
        self.assertEqual(guest_member["role"], "guest")
        self.assertEqual(maintainer_member["role"], "maintainer")

        guest_create = self.guest_c.post(
            f"{MM}/meetings/",
            {"group": group_id, "name": "جلسه غیرمجاز"},
            format="json",
        )
        self.assertEqual(guest_create.status_code, status.HTTP_403_FORBIDDEN)

        outsider_create = self.outsider_c.post(
            f"{MM}/meetings/",
            {"group": group_id},
            format="json",
        )
        self.assertIn(
            outsider_create.status_code,
            (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN),
        )

        meeting_res = self.owner_c.post(
            f"{MM}/meetings/",
            {"group": group_id, "name": "جلسه ماهانه مدیران", "description": "دستور کار مالی"},
            format="json",
        )
        self.assertEqual(meeting_res.status_code, status.HTTP_201_CREATED, meeting_res.data)
        meeting_id = meeting_res.data["id"]
        self.assertEqual(meeting_res.data["meeting_number"], 1)
        self.assertEqual(meeting_res.data["status"], "open")
        self.assertTrue(meeting_res.data["can_clerk"])

        listed = self.owner_c.get(f"{MM}/meetings/?group={group_id}")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row["id"] == meeting_id for row in _results(listed.data)))
        self.assertNotIn("items", _results(listed.data)[0])

        outsider_list = self.outsider_c.get(f"{MM}/meetings/")
        self.assertFalse(any(row["id"] == meeting_id for row in _results(outsider_list.data)))

        detail = self.guest_c.get(f"{MM}/meetings/{meeting_id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertIn("items", detail.data)
        self.assertFalse(detail.data["can_clerk"])

        item_res = self.owner_c.post(
            f"{MM}/meetings/{meeting_id}/items/",
            {
                "title": "بررسی ضایعات",
                "description": "گزارش ماه",
                "priority": 3,
                "due_date": due.isoformat(),
                "assignee_ids": [guest_member["id"]],
            },
            format="json",
        )
        self.assertEqual(item_res.status_code, status.HTTP_201_CREATED, item_res.data)
        item_id = item_res.data["id"]
        self.assertEqual(item_res.data["priority"], 3)

        maintainer_item = self.maintainer_c.post(
            f"{MM}/meetings/{meeting_id}/items/",
            {"title": "پیگیری مصوبه قبلی", "priority": 2},
            format="json",
        )
        self.assertEqual(maintainer_item.status_code, status.HTTP_201_CREATED, maintainer_item.data)
        open_item_id = maintainer_item.data["id"]

        guest_add = self.guest_c.post(
            f"{MM}/meetings/{meeting_id}/items/",
            {"title": "بند مهمان"},
            format="json",
        )
        self.assertEqual(guest_add.status_code, status.HTTP_403_FORBIDDEN)

        guest_edit_title = self.guest_c.patch(
            f"{MM}/meetings/{meeting_id}/items/{item_id}/",
            {"title": "تغییر غیرمجاز"},
            format="json",
        )
        self.assertEqual(guest_edit_title.status_code, status.HTTP_403_FORBIDDEN)

        guest_status = self.guest_c.patch(
            f"{MM}/meetings/{meeting_id}/items/{item_id}/",
            {"status": "in_progress"},
            format="json",
        )
        self.assertEqual(guest_status.status_code, status.HTTP_200_OK, guest_status.data)
        self.assertEqual(guest_status.data["status"], "in_progress")

        guest_comment = self.guest_c.post(
            f"{MM}/meetings/{meeting_id}/items/{item_id}/comments/",
            {"body": "در مرحله آزمایش هستم، نمونه آماده است."},
            format="json",
        )
        self.assertEqual(guest_comment.status_code, status.HTTP_201_CREATED, guest_comment.data)
        self.assertIn("نمونه", guest_comment.data["body"])

        guest_empty = self.guest_c.post(
            f"{MM}/meetings/{meeting_id}/items/{item_id}/comments/",
            {"body": "   "},
            format="json",
        )
        self.assertEqual(guest_empty.status_code, status.HTTP_400_BAD_REQUEST)

        guest_other = self.guest_c.post(
            f"{MM}/meetings/{meeting_id}/items/{open_item_id}/comments/",
            {"body": "این بند مال من نیست"},
            format="json",
        )
        self.assertEqual(guest_other.status_code, status.HTTP_403_FORBIDDEN)

        clerk_comment = self.owner_c.post(
            f"{MM}/meetings/{meeting_id}/items/{open_item_id}/comments/",
            {"body": "دبیر یادداشت گذاشت"},
            format="json",
        )
        self.assertEqual(clerk_comment.status_code, status.HTTP_201_CREATED, clerk_comment.data)

        comments = self.guest_c.get(f"{MM}/meetings/{meeting_id}/items/{item_id}/comments/")
        self.assertEqual(comments.status_code, status.HTTP_200_OK)
        self.assertEqual(len(comments.data), 1)

        detail_after = self.guest_c.get(f"{MM}/meetings/{meeting_id}/")
        commented = next(row for row in detail_after.data["items"] if row["id"] == item_id)
        self.assertEqual(commented["comment_count"], 1)
        self.assertTrue(commented["can_comment"])

        guest_cancel = self.guest_c.patch(
            f"{MM}/meetings/{meeting_id}/items/{item_id}/",
            {"status": "cancelled"},
            format="json",
        )
        self.assertEqual(guest_cancel.status_code, status.HTTP_403_FORBIDDEN)

        done = self.guest_c.patch(
            f"{MM}/meetings/{meeting_id}/items/{item_id}/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(done.status_code, status.HTTP_200_OK, done.data)
        self.assertEqual(done.data["status"], "completed")

        rename = self.owner_c.patch(
            f"{MM}/meetings/{meeting_id}/",
            {"name": "جلسه ماهانه مدیران — نهایی"},
            format="json",
        )
        self.assertEqual(rename.status_code, status.HTTP_200_OK, rename.data)
        self.assertIn("نهایی", rename.data["name"])

        close = self.owner_c.post(f"{MM}/meetings/{meeting_id}/close/")
        self.assertEqual(close.status_code, status.HTTP_200_OK, close.data)
        self.assertEqual(close.data["status"], "closed")

        add_after_close = self.owner_c.post(
            f"{MM}/meetings/{meeting_id}/items/",
            {"title": "بند بعد از بستن"},
            format="json",
        )
        self.assertEqual(add_after_close.status_code, status.HTTP_400_BAD_REQUEST)

        carry = self.owner_c.post(
            f"{MM}/meetings/{meeting_id}/carry-over/",
            {},
            format="json",
        )
        self.assertEqual(carry.status_code, status.HTTP_201_CREATED, carry.data)
        next_id = carry.data["id"]
        self.assertEqual(carry.data["meeting_number"], 2)
        self.assertEqual(carry.data["status"], "open")

        next_items = self.owner_c.get(f"{MM}/meetings/{next_id}/items/")
        self.assertEqual(next_items.status_code, status.HTTP_200_OK)
        titles = [row["title"] for row in next_items.data]
        self.assertIn("پیگیری مصوبه قبلی", titles)
        self.assertNotIn("بررسی ضایعات", titles)

        delete = self.owner_c.delete(f"{MM}/meetings/{meeting_id}/")
        self.assertEqual(delete.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(Meeting.objects.filter(pk=meeting_id).exclude(deleted_at=None).exists())

        after_delete = self.owner_c.get(f"{MM}/meetings/?group={group_id}")
        ids = [row["id"] for row in _results(after_delete.data)]
        self.assertNotIn(meeting_id, ids)
        self.assertIn(next_id, ids)


class MinutesMeetingNumberTests(APITestCase):
    """Live meetings only: next number is last existing + 1, and resets each Jalali year."""

    def setUp(self):
        self.owner = User.objects.create_user(
            phone_number="09128880011",
            password="MmDemo#2026",
            first_name="مالک",
            last_name="شماره",
            is_phone_verified=True,
        )
        token = str(RefreshToken.for_user(self.owner).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def _group(self):
        company = self.client.post(f"{MM}/companies/", {"name": "شرکت شماره"}, format="json")
        group = self.client.post(
            f"{MM}/groups/",
            {"company": company.data["id"], "name": "گروه شماره"},
            format="json",
        )
        return group.data["id"]

    def test_create_after_delete_reuses_next_live_number(self):
        group_id = self._group()

        first = self.client.post(f"{MM}/meetings/", {"group": group_id}, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(first.data["meeting_number"], 1)
        self.assertIn("year", first.data)

        second = self.client.post(f"{MM}/meetings/", {"group": group_id}, format="json")
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)
        self.assertEqual(second.data["meeting_number"], 2)

        deleted = self.client.delete(f"{MM}/meetings/{second.data['id']}/")
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)

        third = self.client.post(f"{MM}/meetings/", {"group": group_id}, format="json")
        self.assertEqual(third.status_code, status.HTTP_201_CREATED, third.data)
        self.assertEqual(third.data["meeting_number"], 2)
        self.assertNotEqual(third.data["id"], second.data["id"])

    def test_delete_all_starts_from_one(self):
        group_id = self._group()
        first = self.client.post(f"{MM}/meetings/", {"group": group_id}, format="json")
        self.client.delete(f"{MM}/meetings/{first.data['id']}/")
        again = self.client.post(f"{MM}/meetings/", {"group": group_id}, format="json")
        self.assertEqual(again.status_code, status.HTTP_201_CREATED, again.data)
        self.assertEqual(again.data["meeting_number"], 1)

    def test_new_jalali_year_starts_from_one(self):
        group_id = self._group()
        old = self.client.post(
            f"{MM}/meetings/",
            {"group": group_id, "date": "2025-06-01"},
            format="json",
        )
        self.assertEqual(old.status_code, status.HTTP_201_CREATED, old.data)
        self.assertEqual(old.data["year"], 1404)
        self.assertEqual(old.data["meeting_number"], 1)

        new = self.client.post(
            f"{MM}/meetings/",
            {"group": group_id, "date": "2026-06-01"},
            format="json",
        )
        self.assertEqual(new.status_code, status.HTTP_201_CREATED, new.data)
        self.assertEqual(new.data["year"], 1405)
        self.assertEqual(new.data["meeting_number"], 1)

        listed_old = self.client.get(f"{MM}/meetings/?group={group_id}&year=1404")
        self.assertEqual(len(_results(listed_old.data)), 1)
        self.assertEqual(_results(listed_old.data)[0]["id"], old.data["id"])

        listed_new = self.client.get(f"{MM}/meetings/?group={group_id}&year=1405")
        self.assertEqual(len(_results(listed_new.data)), 1)
        self.assertEqual(_results(listed_new.data)[0]["id"], new.data["id"])


class MinutesManyManagersTests(APITestCase):
    """A board with many managers must list and open without error."""

    def setUp(self):
        self.owner = User.objects.create_user(
            phone_number="09128880021",
            password="MmDemo#2026",
            first_name="مالک",
            last_name="مقیاس",
            is_phone_verified=True,
        )
        token = str(RefreshToken.for_user(self.owner).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.managers = []
        for index in range(12):
            user = User.objects.create_user(
                phone_number=f"091288801{index:02d}",
                password="MmDemo#2026",
                first_name=f"مدیر{index + 1}",
                last_name="مقیاس",
                is_phone_verified=True,
            )
            self.managers.append(user)

    def test_twelve_managers_can_open_the_same_minutes(self):
        company = self.client.post(f"{MM}/companies/", {"name": "شرکت بزرگ"}, format="json")
        group = self.client.post(
            f"{MM}/groups/",
            {"company": company.data["id"], "name": "هیئت مدیره"},
            format="json",
        )
        group_id = group.data["id"]

        for user in self.managers:
            invite = self.client.post(
                f"{MM}/groups/{group_id}/invite/",
                {"phone_number": user.phone_number, "role": "maintainer"},
                format="json",
            )
            self.assertEqual(invite.status_code, status.HTTP_201_CREATED, invite.data)
            other = self.client_class()
            other.credentials(
                HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}"
            )
            accept = other.post(f"{MM}/invitations/{invite.data['id']}/accept/")
            self.assertEqual(accept.status_code, status.HTTP_200_OK, accept.data)

        meeting = self.client.post(
            f"{MM}/meetings/",
            {"group": group_id, "name": "جلسه هیئت مدیره"},
            format="json",
        )
        self.assertEqual(meeting.status_code, status.HTTP_201_CREATED, meeting.data)
        meeting_id = meeting.data["id"]

        members = self.client.get(f"{MM}/groups/{group_id}/members/")
        self.assertEqual(members.status_code, status.HTTP_200_OK)
        self.assertEqual(len(members.data), 13)

        assignee_ids = [row["id"] for row in members.data[1:6]]
        for index in range(20):
            item = self.client.post(
                f"{MM}/meetings/{meeting_id}/items/",
                {
                    "title": f"بند {index + 1}",
                    "priority": 2,
                    "assignee_ids": [assignee_ids[index % len(assignee_ids)]],
                },
                format="json",
            )
            self.assertEqual(item.status_code, status.HTTP_201_CREATED, item.data)

        detail = self.client.get(f"{MM}/meetings/{meeting_id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(len(detail.data["items"]), 20)
        self.assertEqual(detail.data["item_count"], 20)
        self.assertEqual(detail.data["open_item_count"], 20)

        manager = self.managers[0]
        other = self.client_class()
        other.credentials(
            HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(manager).access_token}"
        )
        seen = other.get(f"{MM}/meetings/{meeting_id}/")
        self.assertEqual(seen.status_code, status.HTTP_200_OK)
        self.assertTrue(seen.data["can_clerk"])
        self.assertEqual(len(seen.data["items"]), 20)


class MinutesPermissionEdgeTests(APITestCase):
    """Guests, outsiders, and reject/remove must not leak or mutate minutes."""

    def setUp(self):
        self.owner = User.objects.create_user(
            phone_number="09128880201",
            password="MmDemo#2026",
            first_name="مالک",
            last_name="مرز",
            is_phone_verified=True,
        )
        self.guest = User.objects.create_user(
            phone_number="09128880202",
            password="MmDemo#2026",
            first_name="مهمان",
            last_name="مرز",
            is_phone_verified=True,
        )
        self.outsider = User.objects.create_user(
            phone_number="09128880203",
            password="MmDemo#2026",
            first_name="غریبه",
            last_name="مرز",
            is_phone_verified=True,
        )
        self.rejecter = User.objects.create_user(
            phone_number="09128880204",
            password="MmDemo#2026",
            first_name="ردکننده",
            last_name="مرز",
            is_phone_verified=True,
        )
        self.owner_c = self._client_for(self.owner)
        self.guest_c = self._client_for(self.guest)
        self.outsider_c = self._client_for(self.outsider)
        self.rejecter_c = self._client_for(self.rejecter)

        company = self.owner_c.post(f"{MM}/companies/", {"name": "شرکت مرز"}, format="json")
        self.assertEqual(company.status_code, status.HTTP_201_CREATED, company.data)
        group = self.owner_c.post(
            f"{MM}/groups/",
            {"company": company.data["id"], "name": "گروه مرز"},
            format="json",
        )
        self.assertEqual(group.status_code, status.HTTP_201_CREATED, group.data)
        self.group_id = group.data["id"]
        invite = self.owner_c.post(
            f"{MM}/groups/{self.group_id}/invite/",
            {"phone_number": self.guest.phone_number, "role": "guest"},
            format="json",
        )
        self.assertEqual(invite.status_code, status.HTTP_201_CREATED, invite.data)
        accept = self.guest_c.post(f"{MM}/invitations/{invite.data['id']}/accept/")
        self.assertEqual(accept.status_code, status.HTTP_200_OK, accept.data)

    def _client_for(self, user):
        client = self.client_class()
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def test_wrong_password_is_rejected(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"phone_number": "09128880201", "password": "WrongPass#1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_guest_cannot_invite_or_close(self):
        invite = self.guest_c.post(
            f"{MM}/groups/{self.group_id}/invite/",
            {"phone_number": self.outsider.phone_number, "role": "guest"},
            format="json",
        )
        self.assertEqual(invite.status_code, status.HTTP_403_FORBIDDEN)

        meeting = self.owner_c.post(
            f"{MM}/meetings/",
            {"group": self.group_id, "name": "جلسه مرز"},
            format="json",
        )
        self.assertEqual(meeting.status_code, status.HTTP_201_CREATED, meeting.data)
        close = self.guest_c.post(f"{MM}/meetings/{meeting.data['id']}/close/")
        self.assertEqual(close.status_code, status.HTTP_403_FORBIDDEN)

        outsider_group = self.outsider_c.get(f"{MM}/groups/{self.group_id}/")
        self.assertEqual(outsider_group.status_code, status.HTTP_404_NOT_FOUND)

    def test_reject_invite_does_not_join(self):
        invite = self.owner_c.post(
            f"{MM}/groups/{self.group_id}/invite/",
            {"phone_number": self.rejecter.phone_number, "role": "maintainer"},
            format="json",
        )
        self.assertEqual(invite.status_code, status.HTTP_201_CREATED, invite.data)
        reject = self.rejecter_c.post(f"{MM}/invitations/{invite.data['id']}/reject/")
        self.assertEqual(reject.status_code, status.HTTP_200_OK, reject.data)
        self.assertEqual(reject.data["status"], "rejected")

        members = self.owner_c.get(f"{MM}/groups/{self.group_id}/members/")
        phones = [row["phone_number"] for row in members.data]
        self.assertNotIn(self.rejecter.phone_number, phones)

        hidden = self.rejecter_c.get(f"{MM}/groups/{self.group_id}/")
        self.assertEqual(hidden.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_item_hides_it_from_the_board(self):
        meeting = self.owner_c.post(
            f"{MM}/meetings/",
            {"group": self.group_id, "name": "جلسه حذف بند"},
            format="json",
        )
        self.assertEqual(meeting.status_code, status.HTTP_201_CREATED, meeting.data)
        meeting_id = meeting.data["id"]
        item = self.owner_c.post(
            f"{MM}/meetings/{meeting_id}/items/",
            {"title": "بند حذف‌شونده"},
            format="json",
        )
        self.assertEqual(item.status_code, status.HTTP_201_CREATED, item.data)
        deleted = self.owner_c.delete(f"{MM}/meetings/{meeting_id}/items/{item.data['id']}/")
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)

        guest_delete = self.guest_c.delete(
            f"{MM}/meetings/{meeting_id}/items/{item.data['id']}/"
        )
        self.assertIn(
            guest_delete.status_code,
            (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

        detail = self.owner_c.get(f"{MM}/meetings/{meeting_id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["items"], [])
        self.assertEqual(detail.data["item_count"], 0)


class MinutesSeedDemoUsersTests(APITestCase):
    """The 10 fake logins used for a live walkthrough must actually authenticate."""

    def test_seed_command_creates_ten_logins(self):
        from django.core.management import call_command

        call_command("seed_demo_users", verbosity=0)
        call_command("seed_demo_users", verbosity=0)

        self.assertEqual(User.objects.filter(phone_number__startswith="091288800").count(), 10)

        for last in range(1, 11):
            phone = f"091288800{last:02d}"
            response = self.client.post(
                "/api/v1/auth/login/",
                {"phone_number": phone, "password": "MmDemo#2026"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
            self.assertIn("access", response.data)

        owner_token = self.client.post(
            "/api/v1/auth/login/",
            {"phone_number": "09128880001", "password": "MmDemo#2026"},
            format="json",
        ).data["access"]
        client = self.client_class()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {owner_token}")
        meetings = client.get(f"{MM}/meetings/")
        self.assertEqual(meetings.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(_results(meetings.data)), 1)
