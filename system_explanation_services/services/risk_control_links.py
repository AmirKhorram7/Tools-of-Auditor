"""Sync many-to-many links between StepRisk and StepControl on the same step."""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

from system_explanation_services.models import StepControl, StepRisk, StepRiskControlLink


def sync_control_risks(control: StepControl, risk_ids: list[int]) -> None:
    """Replace active risk links for a control. Risks must share control.step_id."""
    wanted = list(dict.fromkeys(int(x) for x in risk_ids))
    if wanted:
        found = set(
            StepRisk.objects.filter(id__in=wanted, step_id=control.step_id).values_list("id", flat=True)
        )
        missing = [rid for rid in wanted if rid not in found]
        if missing:
            raise ValidationError(
                {
                    "linked_risk_ids": _(
                        "Risks must belong to the same step as this control "
                        "(invalid ids: %(ids)s)."
                    )
                    % {"ids": ", ".join(str(x) for x in missing)}
                }
            )

    existing = {
        link.risk_id: link
        for link in StepRiskControlLink.all_objects.filter(control=control)
    }
    wanted_set = set(wanted)

    for risk_id, link in existing.items():
        if risk_id not in wanted_set and not link.is_deleted:
            link.soft_delete()

    for risk_id in wanted:
        link = existing.get(risk_id)
        if link is None:
            StepRiskControlLink.objects.create(risk_id=risk_id, control=control)
        elif link.is_deleted:
            link.is_deleted = False
            link.deleted_at = None
            link.save(update_fields=["is_deleted", "deleted_at", "updated_at"])


def sync_risk_controls(risk: StepRisk, control_ids: list[int]) -> None:
    """Replace active control links for a risk. Controls must share risk.step_id."""
    wanted = list(dict.fromkeys(int(x) for x in control_ids))
    if wanted:
        found = set(
            StepControl.objects.filter(id__in=wanted, step_id=risk.step_id).values_list("id", flat=True)
        )
        missing = [cid for cid in wanted if cid not in found]
        if missing:
            raise ValidationError(
                {
                    "linked_control_ids": _(
                        "Controls must belong to the same step as this risk "
                        "(invalid ids: %(ids)s)."
                    )
                    % {"ids": ", ".join(str(x) for x in missing)}
                }
            )

    existing = {
        link.control_id: link
        for link in StepRiskControlLink.all_objects.filter(risk=risk)
    }
    wanted_set = set(wanted)

    for control_id, link in existing.items():
        if control_id not in wanted_set and not link.is_deleted:
            link.soft_delete()

    for control_id in wanted:
        link = existing.get(control_id)
        if link is None:
            StepRiskControlLink.objects.create(risk=risk, control_id=control_id)
        elif link.is_deleted:
            link.is_deleted = False
            link.deleted_at = None
            link.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
