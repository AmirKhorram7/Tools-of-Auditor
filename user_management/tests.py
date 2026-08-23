from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from system_explanation_services.models import Process, ProcessStep, Project
from team_manage_services.models import Company, Project as WorkProject, Task, Team
from user_management.ranking import build_explanation_ranking, build_work_ranking

User = get_user_model()


class RankingReportTests(TestCase):
    def setUp(self):
        self.busy = User.objects.create_user(
            phone_number="09120000001",
            password="pass1234",
            first_name="Busy",
            last_name="User",
        )
        User.objects.create_user(
            phone_number="09120000002",
            password="pass1234",
            first_name="Quiet",
            last_name="User",
        )

    def test_explanation_ranking_orders_by_created_work(self):
        folder = Project.objects.create(name="Root", owner=self.busy)
        process = Process.objects.create(name="Flow", project=folder, owner=self.busy)
        ProcessStep.objects.create(process=process, title="Step A")
        ProcessStep.objects.create(process=process, title="Step B")

        data = build_explanation_ranking()
        self.assertEqual(data["active_count"], 1)
        self.assertEqual(data["top5"][0]["name"], "Busy User")
        self.assertEqual(data["rows"][0]["cells"], [1, 1, 2])
        averages = {row["key"]: row["avg"] for row in data["metrics"]}
        self.assertEqual(averages["folders"], 1)
        self.assertEqual(averages["steps"], 2)

    def test_work_ranking_orders_by_created_work(self):
        company = Company.objects.create(name="Co", owner=self.busy)
        Team.objects.create(name="Team", company=company, owner=self.busy)
        project = WorkProject.objects.create(name="Job", company=company, owner=self.busy)
        Task.objects.create(
            title="Card",
            project=project,
            created_by=self.busy,
            difficulty_set_by=self.busy,
        )

        data = build_work_ranking()
        self.assertGreaterEqual(data["active_count"], 1)
        top = data["rows"][0]
        self.assertEqual(top["name"], "Busy User")
        self.assertGreaterEqual(top["score"], 4)

    def test_ranking_urls_resolve(self):
        self.assertIn("ranking/explanation", reverse("admin:user_explanation_ranking"))
        self.assertIn("ranking/work", reverse("admin:user_work_ranking"))
