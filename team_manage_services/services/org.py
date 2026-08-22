"""Company, team, and invitation writes."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from team_manage_services.models import (
    ActivityLog,
    Company,
    CompanyMember,
    Invitation,
    Notification,
    Team,
    TeamMember,
)
from team_manage_services.services.access import can_view_company, is_company_manager
from team_manage_services.services.notify import log_activity, notify_user

User = get_user_model()

INVITE_DAYS = 14


def ensure_company_owner_member(company: Company, user) -> CompanyMember:
    member, _ = CompanyMember.objects.get_or_create(
        company=company,
        user=user,
        defaults={
            "role": CompanyMember.Role.OWNER,
            "status": CompanyMember.Status.ACTIVE,
            "joined_at": timezone.now(),
        },
    )
    return member


@transaction.atomic
def create_company(*, user, name: str, parent: Company | None = None) -> Company:
    if parent and not is_company_manager(user, parent):
        raise PermissionDenied("Only the holding manager can add a sub-company.")
    company = Company(name=name.strip(), parent=parent, owner=user)
    company.full_clean()
    company.save()
    ensure_company_owner_member(company, user)
    log_activity(
        actor=user,
        action=ActivityLog.Action.CREATED,
        entity_type="company",
        entity_id=company.id,
        description=f"شرکت «{company.name}» ساخته شد.",
        company=company,
    )
    return company


@transaction.atomic
def create_team(*, user, company: Company, name: str) -> Team:
    if not is_company_manager(user, company):
        raise PermissionDenied("Only the company manager can create a team.")
    team = Team(company=company, name=name.strip(), owner=user)
    team.full_clean()
    team.save()
    TeamMember.objects.update_or_create(
        team=team,
        user=user,
        defaults={
            "role": TeamMember.Role.OWNER,
            "position_title": "مدیر",
            "status": TeamMember.Status.ACTIVE,
            "joined_at": timezone.now(),
        },
    )
    log_activity(
        actor=user,
        action=ActivityLog.Action.CREATED,
        entity_type="team",
        entity_id=team.id,
        description=f"تیم «{team.name}» ساخته شد.",
        company=company,
    )
    return team


@transaction.atomic
def invite_to_team(
    *,
    user,
    team: Team,
    phone_number: str,
    position_title: str = "",
    role: str = TeamMember.Role.DEVELOPER,
) -> Invitation:
    if not is_company_manager(user, team.company):
        raise PermissionDenied("Only the company manager can invite to this team.")
    phone = phone_number.strip()
    if Invitation.objects.filter(
        team=team, phone_number=phone, status=Invitation.Status.PENDING
    ).exists():
        raise ValidationError({"phone_number": "A pending invite already exists."})

    invited_user = User.objects.filter(phone_number=phone).first()
    invitation = Invitation.objects.create(
        team=team,
        invited_by=user,
        invited_user=invited_user,
        phone_number=phone,
        role=role or TeamMember.Role.DEVELOPER,
        position_title=position_title.strip(),
        expires_at=timezone.now() + timedelta(days=INVITE_DAYS),
    )
    manager_name = user.get_full_name().strip() or user.phone_number
    message = (
        f"{manager_name} شما را به تیم «{team.name}» در تی‌ادیتور دعوت کرد. "
        "وارد شوید و دعوت را بپذیرید."
    )
    if invited_user:
        notify_user(
            recipient=invited_user,
            notification_type=Notification.Type.INVITATION,
            title="دعوت به تیم",
            message=message,
            reference_type="invitation",
            reference_id=invitation.id,
            send_sms=False,
        )
    else:
        from team_manage_services.services.notify import _try_send_sms

        _try_send_sms(phone, message)
        invitation.sms_sent_at = timezone.now()
        invitation.save(update_fields=["sms_sent_at", "updated_at"])

    log_activity(
        actor=user,
        action=ActivityLog.Action.MEMBER_ADDED,
        entity_type="invitation",
        entity_id=invitation.id,
        description=f"دعوت {phone} به تیم «{team.name}».",
        company=team.company,
    )
    return invitation


def attach_pending_invites(user) -> int:
    """Call after register/login so new users see invites for their phone."""
    pending = list(
        Invitation.objects.filter(
            phone_number=user.phone_number,
            status=Invitation.Status.PENDING,
            invited_user__isnull=True,
        ).select_related("team")
    )
    for invitation in pending:
        invitation.invited_user = user
        invitation.save(update_fields=["invited_user", "updated_at"])
        notify_user(
            recipient=user,
            notification_type=Notification.Type.INVITATION,
            title="دعوت به تیم",
            message=f"شما به تیم «{invitation.team.name}» دعوت شده‌اید. دعوت را بپذیرید یا رد کنید.",
            reference_type="invitation",
            reference_id=invitation.id,
        )
    return len(pending)


@transaction.atomic
def respond_to_invitation(*, user, invitation: Invitation, accept: bool) -> Invitation:
    if invitation.status != Invitation.Status.PENDING:
        raise ValidationError({"status": "This invitation is no longer pending."})
    if invitation.expires_at < timezone.now():
        invitation.status = Invitation.Status.EXPIRED
        invitation.save(update_fields=["status", "updated_at"])
        raise ValidationError({"status": "Invitation expired."})
    if invitation.phone_number != user.phone_number and invitation.invited_user_id != user.id:
        raise PermissionDenied("This invitation is not for you.")

    invitation.invited_user = user
    if not accept:
        invitation.status = Invitation.Status.REJECTED
        invitation.save(update_fields=["invited_user", "status", "updated_at"])
        return invitation

    invitation.status = Invitation.Status.ACCEPTED
    invitation.save(update_fields=["invited_user", "status", "updated_at"])
    TeamMember.objects.update_or_create(
        team=invitation.team,
        user=user,
        defaults={
            "role": invitation.role or TeamMember.Role.DEVELOPER,
            "position_title": invitation.position_title,
            "status": TeamMember.Status.ACTIVE,
            "joined_at": timezone.now(),
        },
    )
    member, created = CompanyMember.objects.get_or_create(
        company=invitation.team.company,
        user=user,
        defaults={
            "role": CompanyMember.Role.EMPLOYEE,
            "status": CompanyMember.Status.ACTIVE,
            "joined_at": timezone.now(),
        },
    )
    if not created and member.status != CompanyMember.Status.ACTIVE:
        member.status = CompanyMember.Status.ACTIVE
        member.save(update_fields=["status", "updated_at"])
    log_activity(
        actor=user,
        action=ActivityLog.Action.MEMBER_ADDED,
        entity_type="team",
        entity_id=invitation.team_id,
        description=f"{user.phone_number} به تیم پیوست.",
        company=invitation.team.company,
    )
    return invitation


def require_company_view(user, company: Company):
    if not can_view_company(user, company):
        raise PermissionDenied("You do not have access to this company.")
