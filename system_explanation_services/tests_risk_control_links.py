"""Risk ↔ control link integrity (same-step, soft-delete unlink)."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from system_explanation_services.models import (
    Process,
    ProcessStep,
    Project,
    StepControl,
    StepRisk,
    StepRiskControlLink,
)
from system_explanation_services.services.risk_control_links import sync_control_risks

User = get_user_model()
API = "/api/v1"


def _user(phone, **extra):
    return User.objects.create_user(
        phone_number=phone,
        password="pass12345",
        is_phone_verified=True,
        **extra,
    )


def _client(user):
    from rest_framework.test import APIClient

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


class RiskControlLinkModelTests(TestCase):
    def setUp(self):
        self.owner = _user("09120001111")
        self.project = Project.objects.create(name="P", owner=self.owner)
        self.process = Process.objects.create(
            project=self.project, name="Proc", owner=self.owner, order=1
        )
        self.step = ProcessStep.objects.create(process=self.process, title="S1", order=1)
        self.other = ProcessStep.objects.create(process=self.process, title="S2", order=2)
        self.risk = StepRisk.objects.create(step=self.step, title="R1", order=1)
        self.control = StepControl.objects.create(step=self.step, title="C1", order=1)
        self.foreign_risk = StepRisk.objects.create(step=self.other, title="Rx", order=1)

    def test_sync_same_step_ok(self):
        sync_control_risks(self.control, [self.risk.id])
        self.assertEqual(StepRiskControlLink.objects.filter(control=self.control).count(), 1)
        self.assertEqual(list(self.control.risk_links.values_list("risk_id", flat=True)), [self.risk.id])

    def test_sync_rejects_cross_step(self):
        from django.core.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            sync_control_risks(self.control, [self.foreign_risk.id])

    def test_delete_risk_unlinks_keeps_control(self):
        sync_control_risks(self.control, [self.risk.id])
        self.risk.soft_delete()
        self.assertFalse(StepRiskControlLink.objects.filter(control=self.control).exists())
        self.assertTrue(StepControl.objects.filter(pk=self.control.pk).exists())

    def test_delete_control_removes_links_only(self):
        sync_control_risks(self.control, [self.risk.id])
        self.control.soft_delete()
        self.assertFalse(StepRiskControlLink.objects.filter(risk=self.risk).exists())
        self.assertTrue(StepRisk.objects.filter(pk=self.risk.pk).exists())

    def test_reorder_does_not_break_link(self):
        sync_control_risks(self.control, [self.risk.id])
        self.risk.order = 99
        self.risk.save(update_fields=["order", "updated_at"])
        link = StepRiskControlLink.objects.get(control=self.control)
        self.assertEqual(link.risk_id, self.risk.id)


class RiskControlLinkApiTests(APITestCase):
    def setUp(self):
        self.owner = _user("09120002222")
        self.outsider = _user("09120003333")
        self.project = Project.objects.create(name="P2", owner=self.owner)
        self.process = Process.objects.create(
            project=self.project, name="Proc2", owner=self.owner, order=1
        )
        self.step = ProcessStep.objects.create(process=self.process, title="Step", order=1)
        self.risk_a = StepRisk.objects.create(step=self.step, title="Risk A", order=1)
        self.risk_b = StepRisk.objects.create(step=self.step, title="Risk B", order=2)
        self.control = StepControl.objects.create(step=self.step, title="Control", order=1)
        self.client_a = _client(self.owner)
        self.outsider_c = _client(self.outsider)

    def test_patch_control_links_risks(self):
        res = self.client_a.patch(
            f"{API}/controls/{self.control.pk}/",
            {"linked_risk_ids": [self.risk_a.pk, self.risk_b.pk]},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertCountEqual(res.data["linked_risk_ids"], [self.risk_a.pk, self.risk_b.pk])
        self.assertEqual(len(res.data["linked_risks"]), 2)

        detail = self.client_a.get(f"{API}/steps/{self.step.pk}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        risk_payload = next(r for r in detail.data["risks"] if r["id"] == self.risk_a.pk)
        self.assertIn(self.control.pk, risk_payload["linked_control_ids"])

    def test_cross_step_link_rejected(self):
        other = ProcessStep.objects.create(process=self.process, title="Other", order=2)
        foreign = StepRisk.objects.create(step=other, title="Foreign", order=1)
        res = self.client_a.patch(
            f"{API}/controls/{self.control.pk}/",
            {"linked_risk_ids": [foreign.pk]},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_outsider_cannot_link(self):
        res = self.outsider_c.patch(
            f"{API}/controls/{self.control.pk}/",
            {"linked_risk_ids": [self.risk_a.pk]},
            format="json",
        )
        self.assertIn(res.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))
