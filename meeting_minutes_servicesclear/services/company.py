from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from meeting_minutes_servicesclear.models import Company


class CompanyService:
    def is_owner(self, user, company: Company) -> bool:
        return company.owner_id == user.id

    def is_company_owner(self, user, company: Company) -> bool:
        return self.is_owner(user, company)

    def companies_for_user(self, user):
        return (
            Company.objects.filter(owner=user, deleted_at__isnull=True)
            .select_related("owner", "parent")
            .order_by("name")
        )

    def get_company(self, user, company_id: int) -> Company:
        company = (
            Company.objects.filter(pk=company_id, deleted_at__isnull=True)
            .select_related("owner", "parent")
            .first()
        )
        if company is None:
            raise ValidationError({"company": "Company not found."})
        if not self.is_owner(user, company):
            raise PermissionDenied("You are not the owner of this company.")
        return company

    @transaction.atomic
    def create_company(self, *, user, name: str, parent: Company | None = None) -> Company:
        clean_name = (name or "").strip()
        if not clean_name:
            raise ValidationError({"name": "Name is required."})
        if parent:
            if parent.deleted_at:
                raise ValidationError({"parent": "Parent company is deleted."})
            if not self.is_owner(user, parent):
                raise PermissionDenied("You are not the owner of this parent company.")

        company = Company(
            name=clean_name,
            parent=parent,
            owner=user,
            created_by=user,
            status=Company.Status.ACTIVE,
        )
        company.full_clean()
        company.save()
        return company

    def update_company(self, *, user, company: Company, **fields) -> Company:
        if not self.is_owner(user, company):
            raise PermissionDenied("You are not the owner of this company.")
        if "name" in fields:
            clean_name = (fields["name"] or "").strip()
            if not clean_name:
                raise ValidationError({"name": "Company Name is required."})
            company.name = clean_name
        if "parent" in fields:
            parent = fields["parent"]
            if parent and not self.is_owner(user, parent):
                raise PermissionDenied("Only the holding owner can set this parent.")
            company.parent = parent
        if "status" in fields and fields["status"] in Company.Status.values:
            company.status = fields["status"]

        company.updated_by = user
        company.full_clean()
        company.save()
        return company

    def delete_company(self, *, user, company: Company) -> Company:
        if not self.is_owner(user, company):
            raise PermissionDenied("You are not the owner of this company.")
        company.deleted_at = timezone.now()
        company.deleted_by = user
        company.status = Company.Status.INACTIVE
        company.save(update_fields=["deleted_at", "deleted_by", "status", "updated_at"])
        return company


# Keep the old name so existing imports do not break.
CompnayService = CompanyService
