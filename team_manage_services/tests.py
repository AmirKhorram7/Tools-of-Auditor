"""HTTP smoke tests for /api/v1/work/ (team_manage_services)."""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

WORK = "/api/v1/work"


def _results(payload):
    if isinstance(payload, dict) and "results" in payload:
        return payload["results"]
    return payload


class WorkAPISmokeTests(APITestCase):
    """Walk the manager → invite → project → task → dashboard path."""

    def setUp(self):
        self.manager = User.objects.create_user(
            phone_number="09120000001",
            password="pass-manager",
            first_name="مدیر",
            last_name="تست",
            is_phone_verified=True,
        )
        self.employee = User.objects.create_user(
            phone_number="09120000002",
            password="pass-employee",
            first_name="کارمند",
            last_name="تست",
            is_phone_verified=True,
        )
        self.manager_client = self._client_for(self.manager)
        self.employee_client = self._client_for(self.employee)

    def _client_for(self, user):
        client = self.client_class()
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def test_unauthenticated_dashboard_is_rejected(self):
        response = self.client.get(f"{WORK}/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_work_api_happy_path(self):
        today = date.today()
        yesterday = today - timedelta(days=1)

        company_res = self.manager_client.post(
            f"{WORK}/companies/",
            {"name": "شرکت دودکش"},
            format="json",
        )
        self.assertEqual(company_res.status_code, status.HTTP_201_CREATED, company_res.data)
        company_id = company_res.data["id"]

        listed = self.manager_client.get(f"{WORK}/companies/")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row["id"] == company_id for row in _results(listed.data)))

        members = self.manager_client.get(f"{WORK}/companies/{company_id}/members/")
        self.assertEqual(members.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(members.data), 1)

        team_res = self.manager_client.post(
            f"{WORK}/teams/",
            {"company": company_id, "name": "تیم فروش"},
            format="json",
        )
        self.assertEqual(team_res.status_code, status.HTTP_201_CREATED, team_res.data)
        team_id = team_res.data["id"]

        invite_res = self.manager_client.post(
            f"{WORK}/teams/{team_id}/invite/",
            {"phone_number": self.employee.phone_number, "position_title": "کارشناس"},
            format="json",
        )
        self.assertEqual(invite_res.status_code, status.HTTP_201_CREATED, invite_res.data)
        invite_id = invite_res.data["id"]

        inbox = self.employee_client.get(f"{WORK}/invitations/")
        self.assertEqual(inbox.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row["id"] == invite_id for row in _results(inbox.data)))

        accept = self.employee_client.post(f"{WORK}/invitations/{invite_id}/accept/")
        self.assertEqual(accept.status_code, status.HTTP_200_OK, accept.data)
        self.assertEqual(accept.data["status"], "accepted")

        employee_create_team = self.employee_client.post(
            f"{WORK}/teams/",
            {"company": company_id, "name": "تیم غیرمجاز"},
            format="json",
        )
        self.assertEqual(employee_create_team.status_code, status.HTTP_403_FORBIDDEN)

        project_res = self.manager_client.post(
            f"{WORK}/projects/",
            {
                "company": company_id,
                "name": "پروژه فصل بهار",
                "priority": 3,
                "due_date": today.isoformat(),
            },
            format="json",
        )
        self.assertEqual(project_res.status_code, status.HTTP_201_CREATED, project_res.data)
        project_id = project_res.data["id"]
        self.assertIn("progress_percent", project_res.data)

        add_team = self.manager_client.post(
            f"{WORK}/projects/{project_id}/add-team/",
            {"team_id": team_id},
            format="json",
        )
        self.assertEqual(add_team.status_code, status.HTTP_200_OK, add_team.data)
        member_rows = add_team.data
        employee_pm = next(
            row for row in member_rows if row["user"] == self.employee.id
        )

        task_res = self.manager_client.post(
            f"{WORK}/tasks/",
            {
                "project": project_id,
                "title": "ثبت سفارش",
                "assigned_to": employee_pm["id"],
                "difficulty": 3,
                "priority": 2,
                "due_date": yesterday.isoformat(),
            },
            format="json",
        )
        self.assertEqual(task_res.status_code, status.HTTP_201_CREATED, task_res.data)
        task_id = task_res.data["id"]
        self.assertEqual(task_res.data["progress_percent"], 0)

        step_res = self.manager_client.post(
            f"{WORK}/tasks/{task_id}/steps/",
            {"title": "جمع‌آوری مدارک"},
            format="json",
        )
        self.assertEqual(step_res.status_code, status.HTTP_201_CREATED, step_res.data)
        step_id = step_res.data["id"]

        comment_res = self.employee_client.post(
            f"{WORK}/tasks/{task_id}/comments/",
            {"body": "شروع کردم"},
            format="json",
        )
        self.assertEqual(comment_res.status_code, status.HTTP_201_CREATED, comment_res.data)

        done_step = self.employee_client.patch(
            f"{WORK}/tasks/{task_id}/steps/{step_id}/",
            {"is_completed": True},
            format="json",
        )
        self.assertEqual(done_step.status_code, status.HTTP_200_OK, done_step.data)
        self.assertTrue(done_step.data["is_completed"])

        bump_difficulty = self.employee_client.patch(
            f"{WORK}/tasks/{task_id}/",
            {"difficulty": 5},
            format="json",
        )
        self.assertEqual(bump_difficulty.status_code, status.HTTP_403_FORBIDDEN)

        patch_status = self.employee_client.patch(
            f"{WORK}/tasks/{task_id}/",
            {"status": "in_progress", "difficulty": 3},
            format="json",
        )
        self.assertEqual(patch_status.status_code, status.HTTP_200_OK, patch_status.data)
        self.assertEqual(patch_status.data["status"], "in_progress")
        self.assertEqual(patch_status.data["difficulty"], 3)

        dash = self.manager_client.get(f"{WORK}/dashboard/?company={company_id}")
        self.assertEqual(dash.status_code, status.HTTP_200_OK, dash.data)
        self.assertTrue(dash.data["is_manager"])
        self.assertIn("today", dash.data["employee"])
        self.assertIsNotNone(dash.data["manager"])
        self.assertIn("projects", dash.data["manager"])
        self.assertIn("timeline", dash.data)
        self.assertIn("due", dash.data["timeline"])
        self.assertIn("activity", dash.data["timeline"])
        self.assertIn("items", dash.data["timeline"])
        self.assertTrue(
            any(item["kind"] == "overdue" for item in dash.data["timeline"]["due"]),
            dash.data["timeline"]["due"],
        )

        emp_dash = self.employee_client.get(f"{WORK}/dashboard/")
        self.assertEqual(emp_dash.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(emp_dash.data["employee"]["counts"]["assigned"], 1)
        self.assertGreaterEqual(emp_dash.data["employee"]["counts"]["overdue"], 1)

        timeline = self.employee_client.get(
            f"{WORK}/dashboard/timeline/?project={project_id}"
        )
        self.assertEqual(timeline.status_code, status.HTTP_200_OK)
        self.assertIn("items", timeline.data)

        mine = self.employee_client.get(f"{WORK}/tasks/?mine=true")
        self.assertEqual(mine.status_code, status.HTTP_200_OK)
        mine_rows = _results(mine.data)
        self.assertTrue(any(row["id"] == task_id for row in mine_rows))

        notifs = self.employee_client.get(f"{WORK}/notifications/")
        self.assertEqual(notifs.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(_results(notifs.data)), 1)

        unread = self.employee_client.get(f"{WORK}/notifications/unread_count/")
        self.assertEqual(unread.status_code, status.HTTP_200_OK)
        self.assertIn("unread", unread.data)
        self.assertGreaterEqual(unread.data["unread"], 1)
