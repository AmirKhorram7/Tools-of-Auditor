"""HTTP tests for /api/v1/knowledge/.

Covers the tree, stale page versions, owner isolation, search text, wikilinks,
daily notes, study-plan reviews, templates, ink limits, and file limits.
"""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from knowledge_management.models import Link, Node, Review

User = get_user_model()
API = "/api/v1/knowledge"


def _doc(*texts, link_id=None, link_title=None):
    content = []
    for text in texts:
        content.append({"type": "paragraph", "content": [{"type": "text", "text": text}]})
    if link_id is not None or link_title:
        attrs = {}
        if link_id is not None:
            attrs["id"] = link_id
        if link_title:
            attrs["title"] = link_title
        content.append({"type": "wikilink", "attrs": attrs})
    return {"type": "doc", "content": content}


class KnowledgeTestBase(APITestCase):
    def setUp(self):
        self.alice = self._user("09128880001", "آلیس")
        self.bob = self._user("09128880002", "باب")
        self.alice_c = self._client_for(self.alice)
        self.bob_c = self._client_for(self.bob)
        self.today = timezone.localdate()

    def _user(self, phone, first):
        return User.objects.create_user(
            phone_number=phone,
            password="Knowledge#2026",
            first_name=first,
            last_name="دمو",
            is_phone_verified=True,
        )

    def _client_for(self, user):
        client = self.client_class()
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def _folder(self, client, title="Course", parent_id=None):
        body = {"type": "folder", "title": title}
        if parent_id is not None:
            body["parent_id"] = parent_id
        res = client.post(f"{API}/nodes/", body, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data

    def _page(self, client, title="Notes", parent_id=None, **extra):
        body = {"type": "page", "title": title, **extra}
        if parent_id is not None:
            body["parent_id"] = parent_id
        res = client.post(f"{API}/nodes/", body, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        return res.data


class TreeTests(KnowledgeTestBase):
    def test_tree_is_one_flat_list_with_path_and_move(self):
        root = self._folder(self.alice_c, "Algebra")
        child = self._folder(self.alice_c, "Week 1", parent_id=root["id"])
        page = self._page(self.alice_c, "Sets", parent_id=child["id"])

        tree = self.alice_c.get(f"{API}/tree/")
        self.assertEqual(tree.status_code, status.HTTP_200_OK)
        by_id = {row["id"]: row for row in tree.data}
        self.assertEqual(by_id[root["id"]]["depth"], 0)
        self.assertEqual(by_id[child["id"]]["parent_id"], root["id"])
        self.assertEqual(by_id[page["id"]]["depth"], 2)
        self.assertTrue(by_id[page["id"]]["path"].endswith(f"{page['id']}/"))
        self.assertNotIn("content", tree.data[0])

        moved = self.alice_c.post(
            f"{API}/nodes/{page['id']}/move/",
            {"parent_id": root["id"], "position": 0},
            format="json",
        )
        self.assertEqual(moved.status_code, status.HTTP_200_OK, moved.data)
        self.assertEqual(moved.data["parent_id"], root["id"])
        self.assertEqual(moved.data["depth"], 1)

        inside = self.alice_c.post(
            f"{API}/nodes/{root['id']}/move/",
            {"parent_id": child["id"], "position": 0},
            format="json",
        )
        self.assertEqual(inside.status_code, status.HTTP_400_BAD_REQUEST)

    def test_other_user_cannot_read_or_change_a_page(self):
        page = self._page(self.alice_c, "Private")
        self.assertEqual(self.bob_c.get(f"{API}/nodes/{page['id']}/").status_code, status.HTTP_404_NOT_FOUND)
        stolen = self.bob_c.patch(
            f"{API}/nodes/{page['id']}/",
            {"title": "Stolen", "version": 1},
            format="json",
        )
        self.assertEqual(stolen.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get(f"{API}/tree/").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_stale_version_returns_409_and_search_uses_saved_text(self):
        page = self._page(self.alice_c, "Pythagoras")
        saved = self.alice_c.patch(
            f"{API}/nodes/{page['id']}/",
            {"version": 1, "content": _doc("a squared plus b squared")},
            format="json",
        )
        self.assertEqual(saved.status_code, status.HTTP_200_OK, saved.data)
        self.assertEqual(saved.data["version"], 2)
        self.assertEqual(Node.objects.get(pk=page["id"]).content_text, "a squared plus b squared")

        stale = self.alice_c.patch(
            f"{API}/nodes/{page['id']}/",
            {"version": 1, "title": "Old"},
            format="json",
        )
        self.assertEqual(stale.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(stale.data["version"], 2)

        hits = self.alice_c.get(f"{API}/search/", {"q": "squared"})
        self.assertEqual(hits.status_code, status.HTTP_200_OK, hits.data)
        self.assertEqual(hits.data[0]["id"], page["id"])
        self.assertIn("squared", hits.data[0]["snippet"])

    def test_duplicate_copies_children_and_restore_brings_them_back(self):
        folder = self._folder(self.alice_c, "Physics")
        self._page(self.alice_c, "Motion", parent_id=folder["id"])
        copy = self.alice_c.post(f"{API}/nodes/{folder['id']}/duplicate/")
        self.assertEqual(copy.status_code, status.HTTP_201_CREATED, copy.data)
        titles = {row["title"] for row in self.alice_c.get(f"{API}/tree/").data}
        self.assertIn("Physics copy", titles)
        self.assertIn("Motion", titles)

        self.assertEqual(self.alice_c.delete(f"{API}/nodes/{folder['id']}/").status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Node.objects.filter(pk=folder["id"]).exists())
        restored = self.alice_c.post(f"{API}/nodes/{folder['id']}/restore/")
        self.assertEqual(restored.status_code, status.HTTP_200_OK, restored.data)
        child = Node.objects.get(parent_id=folder["id"])
        self.assertFalse(child.is_deleted)

        child.deleted_at = timezone.now() - timedelta(days=31)
        child.is_deleted = True
        child.save(update_fields=["is_deleted", "deleted_at"])
        too_old = self.alice_c.post(f"{API}/nodes/{child.id}/restore/")
        self.assertEqual(too_old.status_code, status.HTTP_400_BAD_REQUEST)


class LinkAndDailyTests(KnowledgeTestBase):
    def test_wikilinks_rebuild_and_a_deleted_target_stays_broken(self):
        target = self._page(self.alice_c, "Inertia")
        source = self._page(self.alice_c, "Lecture")
        saved = self.alice_c.patch(
            f"{API}/nodes/{source['id']}/",
            {"version": 1, "content": _doc("see", link_id=target["id"])},
            format="json",
        )
        self.assertEqual(saved.status_code, status.HTTP_200_OK, saved.data)
        self.assertEqual(saved.data["links"][0]["id"], target["id"])
        self.assertFalse(saved.data["links"][0]["broken"])

        back = self.alice_c.get(f"{API}/nodes/{target['id']}/backlinks/")
        self.assertEqual(back.data[0]["title"], "Lecture")

        self.alice_c.delete(f"{API}/nodes/{target['id']}/")
        again = self.alice_c.get(f"{API}/nodes/{source['id']}/")
        self.assertTrue(again.data["links"][0]["broken"])
        self.assertTrue(Link.objects.filter(source_id=source["id"], target_id=target["id"]).exists())

        titled = self._page(self.alice_c, "Second")
        by_title = self.alice_c.patch(
            f"{API}/nodes/{titled['id']}/",
            {"version": 1, "content": _doc("[[Inertia]]")},
            format="json",
        )
        # The target is deleted, so the title does not resolve.
        self.assertEqual(by_title.data["links"], [])

        live = self._page(self.alice_c, "Friction")
        linked = self.alice_c.patch(
            f"{API}/nodes/{titled['id']}/",
            {"version": 2, "content": _doc("[[Friction]]")},
            format="json",
        )
        self.assertEqual(linked.data["links"][0]["title"], "Friction")
        self.assertEqual(linked.data["links"][0]["id"], live["id"])

    def test_daily_note_is_created_once(self):
        first = self.alice_c.get(f"{API}/daily/", {"date": "2026-10-16"})
        second = self.alice_c.get(f"{API}/daily/", {"date": "2026-10-16"})
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertTrue(first.data["is_daily"])
        self.assertEqual(first.data["title"], "2026-10-16")
        parent = Node.objects.get(pk=first.data["parent_id"])
        self.assertEqual(parent.title, "Daily")


class PlanTests(KnowledgeTestBase):
    def test_done_day_schedules_reviews_once(self):
        folder = self._folder(self.alice_c, "Calculus")
        created = self.alice_c.post(
            f"{API}/plans/",
            {"title": "October", "start_date": self.today.isoformat(), "days": 10},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.assertEqual(len(created.data["days_rows"]), 10)
        day = created.data["days_rows"][0]
        self.assertEqual(day["date"], self.today.isoformat())

        assigned = self.alice_c.patch(
            f"{API}/plan-days/{day['id']}/",
            {"node_id": folder["id"], "status": "done"},
            format="json",
        )
        self.assertEqual(assigned.status_code, status.HTTP_200_OK, assigned.data)
        steps = set(Review.objects.filter(plan_day_id=day["id"]).values_list("step", "due_date"))
        self.assertEqual(
            steps,
            {
                (1, self.today + timedelta(days=1)),
                (3, self.today + timedelta(days=3)),
                (7, self.today + timedelta(days=7)),
            },
        )

        again = self.alice_c.patch(f"{API}/plan-days/{day['id']}/", {"status": "done"}, format="json")
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(Review.objects.filter(plan_day_id=day["id"]).count(), 3)

        page = self._page(self.alice_c, "Not a course")
        bad = self.alice_c.patch(f"{API}/plan-days/{day['id']}/", {"node_id": page["id"]}, format="json")
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

        today = self.alice_c.get(f"{API}/today/")
        self.assertEqual(today.status_code, status.HTTP_200_OK, today.data)
        self.assertEqual(today.data["plan_days"][0]["id"], day["id"])
        self.assertTrue(today.data["daily_note"]["is_daily"])

    def test_shift_moves_remaining_days_and_progress_counts(self):
        created = self.alice_c.post(
            f"{API}/plans/",
            {"title": "Short", "start_date": self.today.isoformat(), "days": 3},
            format="json",
        )
        rows = created.data["days_rows"]
        folder = self._folder(self.alice_c, "Short course")
        self.alice_c.patch(
            f"{API}/plan-days/{rows[0]['id']}/",
            {"node_id": folder["id"], "status": "done"},
            format="json",
        )
        shifted = self.alice_c.post(f"{API}/plans/{created.data['id']}/shift/", {"days": 2}, format="json")
        self.assertEqual(shifted.status_code, status.HTTP_200_OK, shifted.data)
        by_number = {row["day_number"]: row for row in shifted.data["days_rows"]}
        self.assertEqual(by_number[1]["date"], self.today.isoformat())
        self.assertEqual(by_number[2]["date"], (self.today + timedelta(days=3)).isoformat())
        self.assertEqual(shifted.data["progress"]["done"], 1)
        self.assertEqual(shifted.data["progress"]["streak"], 1)

        review = Review.objects.get(plan_day_id=rows[0]["id"], step=1)
        self.assertEqual(review.due_date, self.today + timedelta(days=1))
        finished = self.alice_c.patch(f"{API}/reviews/{review.id}/", {"done": True}, format="json")
        self.assertEqual(finished.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(finished.data["done_at"])


class TemplateInkFileTests(KnowledgeTestBase):
    def test_course_template_is_seeded_and_can_start_a_page(self):
        listing = self.alice_c.get(f"{API}/templates/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK, listing.data)
        course = next(row for row in listing.data if row["title"] == "Course")
        headings = [
            block["content"][0]["text"]
            for block in course["content"]["content"]
            if block["type"] == "heading"
        ]
        self.assertEqual(headings, ["Goal", "Key facts", "Questions", "Summary"])

        page = self._page(self.alice_c, "Lesson 1", template_id=course["id"])
        self.assertEqual(page["content"]["content"][0]["content"][0]["text"], "Goal")

        exported = self.alice_c.get(f"{API}/nodes/{page['id']}/export/")
        self.assertEqual(exported.status_code, status.HTTP_200_OK)
        self.assertIn("# Lesson 1", exported.content.decode())
        self.assertIn("## Goal", exported.content.decode())

    def test_ink_and_upload_limits(self):
        page = self._page(self.alice_c, "Sketch")
        ok = self.alice_c.post(
            f"{API}/ink/",
            {"node_id": page["id"], "width": 400, "height": 300, "strokes": [{"points": [[1, 2], [3, 4]]}]},
            format="json",
        )
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED, ok.data)

        huge = [{"points": [[i, i] for i in range(9000)]}]
        bad = self.alice_c.post(
            f"{API}/ink/",
            {"node_id": page["id"], "width": 400, "height": 300, "strokes": huge},
            format="json",
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

        upload = self.alice_c.post(
            f"{API}/attachments/",
            {"node_id": page["id"], "file": SimpleUploadedFile("note.txt", b"hello", content_type="text/plain")},
            format="multipart",
        )
        self.assertEqual(upload.status_code, status.HTTP_400_BAD_REQUEST)

        pdf = self.alice_c.post(
            f"{API}/attachments/",
            {
                "node_id": page["id"],
                "file": SimpleUploadedFile("note.pdf", b"%PDF-1.4", content_type="application/pdf"),
            },
            format="multipart",
        )
        self.assertEqual(pdf.status_code, status.HTTP_201_CREATED, pdf.data)
        self.assertEqual(pdf.data["kind"], "pdf")
        self.assertTrue(pdf.data["url"])
