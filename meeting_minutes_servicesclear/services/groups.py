from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from meeting_minutes_servicesclear.models import (
    Company,
    Group,
    GroupInvitation,
    GroupMember,
)
from meeting_minutes_servicesclear.services.company import CompanyService

User = get_user_model()
company_service = CompanyService()
INVITE_DAYS = 14
MANAGE_ROLES = {GroupMember.Role.OWNER, GroupMember.Role.MAINTAINER}
INVITE_ROLES = {GroupMember.Role.MAINTAINER, GroupMember.Role.GUEST}


class GroupService:
    def is_company_owner(self, user, company: Company) -> bool:
        return company_service.is_owner(user, company)

    def active_member(self, user, group: Group) -> GroupMember | None:
        return GroupMember.objects.filter(
            group=group,
            user=user,
            status=GroupMember.Status.ACTIVE,
            deleted_at__isnull=True,
        ).first()

    def member_role(self, user, group: Group) -> str | None:
        member = self.active_member(user, group)
        return member.role if member else None

    def can_view(self, user, group: Group) -> bool:
        if group.deleted_at:
            return False
        if self.is_company_owner(user, group.company):
            return True
        return self.active_member(user, group) is not None

    def can_manage_member(self, user, group: Group) -> bool:
        if self.is_company_owner(user, group.company):
            return True
        return self.member_role(user, group) in MANAGE_ROLES

    def can_manage_members(self, user, group: Group) -> bool:
        return self.can_manage_member(user, group)

    def groups_for_user(self, user, company: Company | None = None):
        owned_company_ids = Company.objects.filter(
            owner=user, deleted_at__isnull=True
        ).values("id")
        qs = (
            Group.objects.filter(deleted_at__isnull=True)
            .filter(
                Q(company_id__in=owned_company_ids)
                | Q(
                    members__user=user,
                    members__status=GroupMember.Status.ACTIVE,
                    members__deleted_at__isnull=True,
                )
            )
            .select_related("company", "owner")
            .distinct()
            .order_by("-is_default", "name")
        )
        if company:
            qs = qs.filter(company=company)
        return qs

    def get_group(self, user, group_id: int) -> Group:
        group = (
            Group.objects.filter(pk=group_id, deleted_at__isnull=True)
            .select_related("company", "owner")
            .first()
        )
        if group is None:
            raise ValidationError({"group": "Group not found."})
        if not self.can_view(user, group):
            raise PermissionDenied("You do not have access to this group.")
        return group

    @transaction.atomic
    def create_group(self, *, user, company: Company, name: str) -> Group:
        if company.deleted_at:
            raise ValidationError({"company": "Company is deleted."})
        if not self.is_company_owner(user, company):
            raise PermissionDenied("You are not the owner of this company.")
        clean_name = (name or "").strip()
        if not clean_name:
            raise ValidationError({"name": "Group name is required."})

        has_default = Group.objects.filter(
            company=company,
            is_default=True,
            deleted_at__isnull=True,
        ).exists()
        group = Group(
            company=company,
            name=clean_name,
            owner=user,
            created_by=user,
            status=Group.Status.ACTIVE,
            is_default=not has_default,
        )
        group.full_clean()
        group.save()
        GroupMember.objects.create(
            group=group,
            user=user,
            role=GroupMember.Role.OWNER,
            status=GroupMember.Status.ACTIVE,
            joined_at=timezone.now(),
            created_by=user,
        )
        return group

    @transaction.atomic
    def update_group(self, *, user, group: Group, **fields) -> Group:
        if not self.is_company_owner(user, group.company):
            raise PermissionDenied("Only the company owner can update this group.")
        if "name" in fields:
            clean_name = (fields["name"] or "").strip()
            if not clean_name:
                raise ValidationError({"name": "Group name is required."})
            group.name = clean_name
        if "status" in fields and fields["status"] in Group.Status.values:
            group.status = fields["status"]
        if "is_default" in fields:
            make_default = bool(fields["is_default"])
            if make_default:
                Group.objects.filter(
                    company=group.company,
                    is_default=True,
                    deleted_at__isnull=True,
                ).exclude(pk=group.pk).update(is_default=False)
            group.is_default = make_default
        group.updated_by = user
        group.full_clean()
        group.save()
        return group

    def delete_group(self, *, user, group: Group) -> Group:
        if not self.is_company_owner(user, group.company):
            raise PermissionDenied("Only the company owner can delete this group.")
        group.deleted_at = timezone.now()
        group.deleted_by = user
        group.status = Group.Status.ARCHIVED
        group.is_default = False
        group.save(update_fields=["deleted_at", "deleted_by", "status", "is_default", "updated_at"])
        return group

    @transaction.atomic
    def invite(self, *, user, group: Group, phone_number: str, role: str = "", position_title: str = "") -> GroupInvitation:
        if not self.can_manage_member(user, group):
            raise PermissionDenied("You do not have permission to invite members to this group.")
        phone = (phone_number or "").strip()
        if not phone:
            raise ValidationError({"phone_number": "Phone number is required."})
        if phone == user.phone_number:
            raise ValidationError({"phone_number": "You cannot invite yourself."})

        invite_role = role or GroupMember.Role.GUEST
        if invite_role not in INVITE_ROLES:
            raise ValidationError({"role": "Invite as maintainer or guest only."})
        if GroupMember.objects.filter(
            group=group,
            user__phone_number=phone,
            status=GroupMember.Status.ACTIVE,
            deleted_at__isnull=True,
        ).exists():
            raise ValidationError({"phone_number": "This person is already in the group."})
        if GroupInvitation.objects.filter(
            group=group,
            phone_number=phone,
            status=GroupInvitation.Status.PENDING,
        ).exists():
            raise ValidationError({"phone_number": "A pending invite already exists."})

        invited_user = User.objects.filter(phone_number=phone).first()
        return GroupInvitation.objects.create(
            group=group,
            invited_by=user,
            invited_user=invited_user,
            phone_number=phone,
            role=invite_role,
            position_title=(position_title or "").strip(),
            expires_at=timezone.now() + timedelta(days=INVITE_DAYS),
            created_by=user,
        )

    def attach_pending_invites(self, user) -> int:
        pending = list(
            GroupInvitation.objects.filter(
                phone_number=user.phone_number,
                status=GroupInvitation.Status.PENDING,
                invited_user__isnull=True,
            )
        )
        for invitation in pending:
            invitation.invited_user = user
            invitation.updated_by = user
            invitation.save(update_fields=["invited_user", "updated_by", "updated_at"])
        return len(pending)

    @transaction.atomic
    def respond(self, *, user, invitation: GroupInvitation, accept: bool) -> GroupInvitation:
        if invitation.status != GroupInvitation.Status.PENDING:
            raise ValidationError({"status": "This invitation is no longer pending."})
        if invitation.expires_at < timezone.now():
            invitation.status = GroupInvitation.Status.EXPIRED
            invitation.save(update_fields=["status", "updated_at"])
            raise ValidationError({"status": "Invitation expired."})
        if invitation.phone_number != user.phone_number and invitation.invited_user_id != user.id:
            raise PermissionDenied("This invitation is not for you.")

        invitation.invited_user = user
        if not accept:
            invitation.status = GroupInvitation.Status.REJECTED
            invitation.save(update_fields=["invited_user", "status", "updated_at"])
            return invitation

        invitation.status = GroupInvitation.Status.ACCEPTED
        invitation.save(update_fields=["invited_user", "status", "updated_at"])
        GroupMember.objects.update_or_create(
            group=invitation.group,
            user=user,
            defaults={
                "role": invitation.role,
                "position_title": invitation.position_title,
                "status": GroupMember.Status.ACTIVE,
                "joined_at": timezone.now(),
                "created_by": user,
                "deleted_at": None,
            },
        )
        return invitation

    def update_member(self, *, user, group: Group, member: GroupMember, **fields) -> GroupMember:
        if not self.can_manage_member(user, group):
            raise PermissionDenied("Only an owner or maintainer can update members.")
        if member.user_id == group.owner_id:
            raise ValidationError({"role": "Owner cannot be updated."})
        if "role" in fields:
            if fields["role"] not in INVITE_ROLES:
                raise ValidationError({"role": "Update as maintainer or guest only."})
            member.role = fields["role"]
        if "status" in fields and fields["status"] in GroupMember.Status.values:
            member.status = fields["status"]
        if "position_title" in fields:
            member.position_title = (fields["position_title"] or "").strip()
        member.updated_by = user
        member.save()
        return member

    def remove_member(self, *, user, group: Group, member: GroupMember) -> GroupMember:
        if not self.can_manage_member(user, group):
            raise PermissionDenied("Only an owner or maintainer can remove members.")
        if member.user_id == group.owner_id:
            raise ValidationError({"member": "The group owner cannot be removed."})
        member.status = GroupMember.Status.INACTIVE
        member.deleted_at = timezone.now()
        member.deleted_by = user
        member.save(update_fields=["status", "deleted_at", "deleted_by", "updated_at"])
        return member
