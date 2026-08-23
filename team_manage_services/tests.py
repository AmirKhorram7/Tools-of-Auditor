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
        linked_teams = self.manager_client.get(f"{WORK}/projects/{project_id}/teams/")
        self.assertEqual(linked_teams.status_code, status.HTTP_200_OK, linked_teams.data)
        self.assertTrue(any(row["id"] == team_id for row in linked_teams.data))
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
        self.assertTrue(patch_status.data.get("can_move"))
        self.assertIsNotNone(patch_status.data.get("column"))

        board = self.manager_client.get(f"{WORK}/projects/{project_id}/board/")
        self.assertEqual(board.status_code, status.HTTP_200_OK, board.data)
        self.assertGreaterEqual(len(board.data["columns"]), 3)

        outsider = User.objects.create_user(
            phone_number="09120000003",
            password="pass-other",
            first_name="دیگر",
            last_name="کاربر",
            is_phone_verified=True,
        )
        outsider_client = self._client_for(outsider)
        self.manager_client.post(
            f"{WORK}/projects/{project_id}/members/",
            {"user_id": outsider.id, "role": "guest"},
            format="json",
        )
        blocked_move = outsider_client.patch(
            f"{WORK}/tasks/{task_id}/",
            {"status": "done"},
            format="json",
        )
        self.assertEqual(blocked_move.status_code, status.HTTP_403_FORBIDDEN)

        label_res = self.manager_client.post(
            f"{WORK}/companies/{company_id}/labels/",
            {"name": "فورس‌ماژور", "color": "#1AAA55"},
            format="json",
        )
        self.assertEqual(label_res.status_code, status.HTTP_201_CREATED, label_res.data)
        patch_label = self.manager_client.patch(
            f"{WORK}/tasks/{task_id}/",
            {"label_ids": [label_res.data["id"]]},
            format="json",
        )
        self.assertEqual(patch_label.status_code, status.HTTP_200_OK, patch_label.data)
        self.assertEqual(len(patch_label.data["labels"]), 1)

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

    def test_default_board_template_and_team_roles(self):
        guest = User.objects.create_user(
            phone_number="09120000004",
            password="pass-guest",
            first_name="مهمان",
            last_name="تست",
            is_phone_verified=True,
        )
        maintainer = User.objects.create_user(
            phone_number="09120000005",
            password="pass-maint",
            first_name="نگهدارنده",
            last_name="تست",
            is_phone_verified=True,
        )
        guest_client = self._client_for(guest)
        maintainer_client = self._client_for(maintainer)

        company_res = self.manager_client.post(
            f"{WORK}/companies/",
            {"name": "شرکت نقش‌ها"},
            format="json",
        )
        self.assertEqual(company_res.status_code, status.HTTP_201_CREATED, company_res.data)
        company_id = company_res.data["id"]

        template_res = self.manager_client.post(
            f"{WORK}/board-templates/",
            {
                "company": company_id,
                "name": "x_boards_list",
                "is_default": True,
                "columns": [
                    {"name": "بک‌لاگ", "color": "#14233A"},
                    {"name": "برای انجام", "color": "#1A2B49"},
                    {"name": "در حال انجام", "color": "#243656"},
                    {"name": "بازبینی", "color": "#1B3A4A"},
                    {"name": "آماده تحویل", "color": "#2A2438"},
                    {"name": "بسته", "color": "#1E3328"},
                ],
            },
            format="json",
        )
        self.assertEqual(template_res.status_code, status.HTTP_201_CREATED, template_res.data)
        self.assertTrue(template_res.data["is_default"])
        self.assertEqual(len(template_res.data["columns"]), 6)

        project_res = self.manager_client.post(
            f"{WORK}/projects/",
            {"company": company_id, "name": "پروژه قالب"},
            format="json",
        )
        self.assertEqual(project_res.status_code, status.HTTP_201_CREATED, project_res.data)
        project_id = project_res.data["id"]
        board = self.manager_client.get(f"{WORK}/projects/{project_id}/board/")
        self.assertEqual(board.status_code, status.HTTP_200_OK, board.data)
        self.assertEqual(
            [col["name"] for col in board.data["columns"]],
            ["بک‌لاگ", "برای انجام", "در حال انجام", "بازبینی", "آماده تحویل", "بسته"],
        )

        team_res = self.manager_client.post(
            f"{WORK}/teams/",
            {"company": company_id, "name": "تیم حسابرسی"},
            format="json",
        )
        self.assertEqual(team_res.status_code, status.HTTP_201_CREATED, team_res.data)
        team_id = team_res.data["id"]

        guest_invite = self.manager_client.post(
            f"{WORK}/teams/{team_id}/invite/",
            {"phone_number": guest.phone_number, "role": "guest"},
            format="json",
        )
        self.assertEqual(guest_invite.status_code, status.HTTP_201_CREATED, guest_invite.data)
        self.assertEqual(guest_invite.data["role"], "guest")
        accept_guest = guest_client.post(
            f"{WORK}/invitations/{guest_invite.data['id']}/accept/"
        )
        self.assertEqual(accept_guest.status_code, status.HTTP_200_OK, accept_guest.data)

        maint_invite = self.manager_client.post(
            f"{WORK}/teams/{team_id}/invite/",
            {"phone_number": maintainer.phone_number, "role": "maintainer"},
            format="json",
        )
        self.assertEqual(maint_invite.status_code, status.HTTP_201_CREATED, maint_invite.data)
        accept_maint = maintainer_client.post(
            f"{WORK}/invitations/{maint_invite.data['id']}/accept/"
        )
        self.assertEqual(accept_maint.status_code, status.HTTP_200_OK, accept_maint.data)

        add_team = self.manager_client.post(
            f"{WORK}/projects/{project_id}/add-team/",
            {"team_id": team_id},
            format="json",
        )
        self.assertEqual(add_team.status_code, status.HTTP_200_OK, add_team.data)
        guest_pm = next(row for row in add_team.data if row["user"] == guest.id)
        maint_pm = next(row for row in add_team.data if row["user"] == maintainer.id)
        self.assertEqual(guest_pm["role"], "guest")
        self.assertEqual(maint_pm["role"], "maintainer")

        guest_project = guest_client.get(f"{WORK}/projects/{project_id}/")
        self.assertEqual(guest_project.status_code, status.HTTP_200_OK)
        self.assertFalse(guest_project.data["can_add_task"])
        self.assertFalse(guest_project.data["can_manage"])

        maint_project = maintainer_client.get(f"{WORK}/projects/{project_id}/")
        self.assertEqual(maint_project.status_code, status.HTTP_200_OK)
        self.assertTrue(maint_project.data["can_add_task"])
        self.assertTrue(maint_project.data["can_manage"])

        guest_task = guest_client.post(
            f"{WORK}/tasks/",
            {"project": project_id, "title": "کار مهمان"},
            format="json",
        )
        self.assertEqual(guest_task.status_code, status.HTTP_403_FORBIDDEN)

        maint_task = maintainer_client.post(
            f"{WORK}/tasks/",
            {"project": project_id, "title": "کار نگهدارنده"},
            format="json",
        )
        self.assertEqual(maint_task.status_code, status.HTTP_201_CREATED, maint_task.data)

        column_res = maintainer_client.post(
            f"{WORK}/projects/{project_id}/columns/",
            {"name": "بازگشت", "color": "#3A2E1C"},
            format="json",
        )
        self.assertEqual(column_res.status_code, status.HTTP_201_CREATED, column_res.data)

        members = self.manager_client.get(f"{WORK}/teams/{team_id}/members/")
        self.assertEqual(members.status_code, status.HTTP_200_OK)
        guest_member = next(row for row in members.data if row["user"] == guest.id)
        patch_role = self.manager_client.patch(
            f"{WORK}/teams/{team_id}/members/{guest_member['id']}/",
            {"role": "developer"},
            format="json",
        )
        self.assertEqual(patch_role.status_code, status.HTTP_200_OK, patch_role.data)
        self.assertEqual(patch_role.data["role"], "developer")

        guest_after = guest_client.get(f"{WORK}/projects/{project_id}/")
        self.assertTrue(guest_after.data["can_add_task"])
        self.assertFalse(guest_after.data["can_manage"])

    def test_platform_board_and_approval_gate(self):
        company_res = self.manager_client.post(
            f"{WORK}/companies/",
            {"name": "شرکت تأیید"},
            format="json",
        )
        self.assertEqual(company_res.status_code, status.HTTP_201_CREATED, company_res.data)
        company_id = company_res.data["id"]

        templates = self.manager_client.get(f"{WORK}/board-templates/?company={company_id}")
        self.assertEqual(templates.status_code, status.HTTP_200_OK)
        rows = _results(templates.data)
        platform = next(row for row in rows if row.get("is_platform"))
        self.assertEqual(len(platform["columns"]), 5)
        self.assertTrue(platform["requires_approval"])

        project_res = self.manager_client.post(
            f"{WORK}/projects/",
            {
                "company": company_id,
                "name": "پروژه استاندارد",
                "board_template_id": platform["id"],
            },
            format="json",
        )
        self.assertEqual(project_res.status_code, status.HTTP_201_CREATED, project_res.data)
        self.assertTrue(project_res.data["require_approval"])
        project_id = project_res.data["id"]

        board = self.manager_client.get(f"{WORK}/projects/{project_id}/board/")
        self.assertEqual(board.status_code, status.HTTP_200_OK, board.data)
        names = [col["name"] for col in board.data["columns"]]
        self.assertEqual(
            names,
            ["برای انجام", "در حال انجام", "تست", "در انتظار تأیید", "بسته"],
        )
        closed = next(col for col in board.data["columns"] if col["is_closed"])
        waiting = next(col for col in board.data["columns"] if col["status_key"] == "in_review")

        team_res = self.manager_client.post(
            f"{WORK}/teams/",
            {"company": company_id, "name": "تیم فنی"},
            format="json",
        )
        team_id = team_res.data["id"]
        invite = self.manager_client.post(
            f"{WORK}/teams/{team_id}/invite/",
            {"phone_number": self.employee.phone_number, "role": "developer"},
            format="json",
        )
        self.employee_client.post(f"{WORK}/invitations/{invite.data['id']}/accept/")
        self.manager_client.post(
            f"{WORK}/projects/{project_id}/add-team/",
            {"team_id": team_id},
            format="json",
        )

        task_res = self.employee_client.post(
            f"{WORK}/tasks/",
            {"project": project_id, "title": "کار برای تأیید"},
            format="json",
        )
        self.assertEqual(task_res.status_code, status.HTTP_201_CREATED, task_res.data)
        task_id = task_res.data["id"]

        blocked = self.employee_client.patch(
            f"{WORK}/tasks/{task_id}/",
            {"column": closed["id"]},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

        waiting_move = self.employee_client.patch(
            f"{WORK}/tasks/{task_id}/",
            {"column": waiting["id"]},
            format="json",
        )
        self.assertEqual(waiting_move.status_code, status.HTTP_200_OK, waiting_move.data)

        closed_move = self.manager_client.patch(
            f"{WORK}/tasks/{task_id}/",
            {"column": closed["id"]},
            format="json",
        )
        self.assertEqual(closed_move.status_code, status.HTTP_200_OK, closed_move.data)
        self.assertEqual(closed_move.data["status"], "done")


class WorkMeetingTests(APITestCase):
    """Isolated Google Meet room sharing on a project."""

    def setUp(self):
        self.manager = User.objects.create_user(
            phone_number="09120000011",
            password="pass-manager",
            first_name="Host",
            is_phone_verified=True,
        )
        self.employee = User.objects.create_user(
            phone_number="09120000012",
            password="pass-employee",
            first_name="Guest",
            is_phone_verified=True,
        )
        self.outsider = User.objects.create_user(
            phone_number="09120000013",
            password="pass-out",
            first_name="Out",
            is_phone_verified=True,
        )
        self.manager_client = self._client_for(self.manager)
        self.employee_client = self._client_for(self.employee)
        self.outsider_client = self._client_for(self.outsider)
        company = self.manager_client.post(
            f"{WORK}/companies/", {"name": "Meet Co"}, format="json"
        ).data
        team = self.manager_client.post(
            f"{WORK}/teams/",
            {"company": company["id"], "name": "Meet Team"},
            format="json",
        ).data
        invite = self.manager_client.post(
            f"{WORK}/teams/{team['id']}/invite/",
            {"phone_number": self.employee.phone_number},
            format="json",
        ).data
        self.employee_client.post(f"{WORK}/invitations/{invite['id']}/accept/")
        project = self.manager_client.post(
            f"{WORK}/projects/",
            {"company": company["id"], "name": "Meet Project"},
            format="json",
        ).data
        self.manager_client.post(
            f"{WORK}/projects/{project['id']}/add-team/",
            {"team_id": team["id"]},
            format="json",
        )
        self.project_id = project["id"]

    def _client_for(self, user):
        client = self.client_class()
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def test_manager_shares_meet_and_member_can_join(self):
        created = self.manager_client.post(
            f"{WORK}/projects/{self.project_id}/meetings/",
            {
                "title": "Standup",
                "meet_url": "https://meet.google.com/abc-defg-hij",
                "audience": "all",
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.assertEqual(created.data["meet_url"], "https://meet.google.com/abc-defg-hij")
        self.assertTrue(created.data["is_live"])

        listed = self.employee_client.get(f"{WORK}/projects/{self.project_id}/meetings/")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["results"][0]["meet_url"], created.data["meet_url"])

        bad = self.manager_client.post(
            f"{WORK}/projects/{self.project_id}/meetings/",
            {"title": "Bad", "meet_url": "https://example.com/room"},
            format="json",
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_selected_guest_hides_link_from_other_member(self):
        outsider_on_project = self.outsider
        self.manager_client.post(
            f"{WORK}/projects/{self.project_id}/members/",
            {"user_id": outsider_on_project.id, "role": "guest"},
            format="json",
        )
        created = self.manager_client.post(
            f"{WORK}/projects/{self.project_id}/meetings/",
            {
                "title": "Private",
                "meet_url": "abc-defg-hij",
                "audience": "selected",
                "user_ids": [self.employee.id],
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)

        invited = self.employee_client.get(f"{WORK}/projects/{self.project_id}/meetings/")
        self.assertTrue(invited.data["results"])
        self.assertTrue(invited.data["results"][0]["meet_url"])

        hidden = self.outsider_client.get(f"{WORK}/projects/{self.project_id}/meetings/")
        self.assertEqual(hidden.data["results"], [])

        ended = self.manager_client.post(
            f"{WORK}/projects/{self.project_id}/meetings/{created.data['id']}/end/",
        )
        self.assertEqual(ended.status_code, status.HTTP_200_OK)
        self.assertEqual(ended.data["status"], "ended")


class WorkPrerequisiteTests(APITestCase):
    """Prerequisites record order only — they do not lock the board."""

    def setUp(self):
        self.manager = User.objects.create_user(
            phone_number="09120000021",
            password="pass-manager",
            first_name="Amir",
            is_phone_verified=True,
        )
        self.client_auth = self.client_class()
        token = str(RefreshToken.for_user(self.manager).access_token)
        self.client_auth.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        company = self.client_auth.post(
            f"{WORK}/companies/", {"name": "Flow Co"}, format="json"
        ).data
        project = self.client_auth.post(
            f"{WORK}/projects/",
            {"company": company["id"], "name": "Login flow"},
            format="json",
        ).data
        self.project_id = project["id"]

    def _task(self, title, **extra):
        payload = {"project": self.project_id, "title": title}
        payload.update(extra)
        response = self.client_auth.post(f"{WORK}/tasks/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data

    def test_chain_and_max_two_without_blocking_done(self):
        task_z = self._task("Approve style")
        task_y = self._task("Figma login", prerequisite_ids=[task_z["id"]])
        task_x = self._task("Frontend login", prerequisite_ids=[task_y["id"]])

        self.assertEqual(task_y["prerequisites"][0]["id"], task_z["id"])
        self.assertEqual(task_x["prerequisites"][0]["id"], task_y["id"])

        extra = self._task("Extra")
        too_many = self.client_auth.patch(
            f"{WORK}/tasks/{task_x['id']}/",
            {"prerequisite_ids": [task_z["id"], task_y["id"], extra["id"]]},
            format="json",
        )
        self.assertEqual(too_many.status_code, status.HTTP_400_BAD_REQUEST)

        loop = self.client_auth.patch(
            f"{WORK}/tasks/{task_z['id']}/",
            {"prerequisite_ids": [task_x["id"]]},
            format="json",
        )
        self.assertEqual(loop.status_code, status.HTTP_400_BAD_REQUEST)

        done = self.client_auth.patch(
            f"{WORK}/tasks/{task_x['id']}/",
            {"status": "done"},
            format="json",
        )
        self.assertEqual(done.status_code, status.HTTP_200_OK, done.data)
        self.assertEqual(done.data["status"], "done")
        self.assertEqual(len(done.data["prerequisites"]), 1)

        board = self.client_auth.get(f"{WORK}/projects/{self.project_id}/board/")
        self.assertEqual(board.status_code, status.HTTP_200_OK)
        titles = [
            card["title"]
            for column in board.data["columns"]
            for card in column["tasks"]
        ]
        self.assertIn("Frontend login", titles)

        removed = self.client_auth.delete(f"{WORK}/tasks/{extra['id']}/")
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)
        gone = self.client_auth.get(f"{WORK}/tasks/{extra['id']}/")
        self.assertEqual(gone.status_code, status.HTTP_404_NOT_FOUND)


class WorkProjectVisibilityTests(APITestCase):
    """A team member only sees projects that team was added to."""

    def setUp(self):
        self.manager = User.objects.create_user(
            phone_number="09120000031",
            password="pass-manager",
            first_name="Mgr",
            is_phone_verified=True,
        )
        self.member = User.objects.create_user(
            phone_number="09120000032",
            password="pass-member",
            first_name="Ali",
            is_phone_verified=True,
        )
        self.manager_client = self._client_for(self.manager)
        self.member_client = self._client_for(self.member)
        company = self.manager_client.post(
            f"{WORK}/companies/", {"name": "Vis Co"}, format="json"
        ).data
        self.company_id = company["id"]
        team_one = self.manager_client.post(
            f"{WORK}/teams/",
            {"company": self.company_id, "name": "Team 1"},
            format="json",
        ).data
        team_two = self.manager_client.post(
            f"{WORK}/teams/",
            {"company": self.company_id, "name": "Team 2"},
            format="json",
        ).data
        invite = self.manager_client.post(
            f"{WORK}/teams/{team_two['id']}/invite/",
            {"phone_number": self.member.phone_number},
            format="json",
        ).data
        self.member_client.post(f"{WORK}/invitations/{invite['id']}/accept/")
        project_one = self.manager_client.post(
            f"{WORK}/projects/",
            {"company": self.company_id, "name": "Project 1"},
            format="json",
        ).data
        project_two = self.manager_client.post(
            f"{WORK}/projects/",
            {"company": self.company_id, "name": "Project 2"},
            format="json",
        ).data
        self.project_one_id = project_one["id"]
        self.project_two_id = project_two["id"]
        self.manager_client.post(
            f"{WORK}/projects/{self.project_one_id}/add-team/",
            {"team_id": team_one["id"]},
            format="json",
        )
        self.team_two_id = team_two["id"]

    def _client_for(self, user):
        client = self.client_class()
        token = str(RefreshToken.for_user(user).access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def test_member_cannot_see_unrelated_project(self):
        hidden = self.member_client.get(f"{WORK}/projects/{self.project_one_id}/")
        self.assertEqual(hidden.status_code, status.HTTP_404_NOT_FOUND)

        listed = self.member_client.get(f"{WORK}/projects/?company={self.company_id}")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in _results(listed.data)]
        self.assertNotIn(self.project_one_id, ids)
        self.assertNotIn(self.project_two_id, ids)

        manager_list = self.manager_client.get(
            f"{WORK}/projects/?company={self.company_id}"
        )
        manager_ids = [row["id"] for row in _results(manager_list.data)]
        self.assertIn(self.project_one_id, manager_ids)

        self.manager_client.post(
            f"{WORK}/projects/{self.project_one_id}/add-team/",
            {"team_id": self.team_two_id},
            format="json",
        )
        visible = self.member_client.get(f"{WORK}/projects/{self.project_one_id}/")
        self.assertEqual(visible.status_code, status.HTTP_200_OK)

        task = self.manager_client.post(
            f"{WORK}/tasks/",
            {"project": self.project_one_id, "title": "Keep"},
            format="json",
        ).data
        blocked = self.member_client.delete(f"{WORK}/tasks/{task['id']}/")
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
        kept = self.manager_client.delete(f"{WORK}/tasks/{task['id']}/")
        self.assertEqual(kept.status_code, status.HTTP_204_NO_CONTENT)

        blocked_project = self.member_client.delete(
            f"{WORK}/projects/{self.project_one_id}/"
        )
        self.assertEqual(blocked_project.status_code, status.HTTP_403_FORBIDDEN)
        removed_project = self.manager_client.delete(
            f"{WORK}/projects/{self.project_two_id}/"
        )
        self.assertEqual(removed_project.status_code, status.HTTP_204_NO_CONTENT)
        gone = self.manager_client.get(f"{WORK}/projects/{self.project_two_id}/")
        self.assertEqual(gone.status_code, status.HTTP_404_NOT_FOUND)
