from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from django.contrib.auth import get_user_model

from meeting_minutes_servicesclear.models import GroupMember, Meeting
from meeting_minutes_servicesclear.services.company import CompanyService
from meeting_minutes_servicesclear.services.groups import GroupService
from meeting_minutes_servicesclear.services.meetings_minutes import MeetingService

User = get_user_model()
company_service = CompanyService()
group_service = GroupService()
meeting_service = MeetingService()

DEMO_PASSWORD = "MmDemo#2026"
DEMO_USERS = [
    ("09128880001", "مدیر", "یک", "owner"),
    ("09128880002", "مدیر", "دو", "maintainer"),
    ("09128880003", "مدیر", "سه", "maintainer"),
    ("09128880004", "مدیر", "چهار", "maintainer"),
    ("09128880005", "مدیر", "پنج", "maintainer"),
    ("09128880006", "مدیر", "شش", "maintainer"),
    ("09128880007", "مدیر", "هفت", "maintainer"),
    ("09128880008", "مدیر", "هشت", "maintainer"),
    ("09128880009", "کارشناس", "نه", "guest"),
    ("09128880010", "کارشناس", "ده", "guest"),
]


class Command(BaseCommand):
    help = (
        "Create 10 demo users with phone+password so you can log in and try minutes. "
        "Idempotent. Demo only — do not use these passwords for real staff."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default=DEMO_PASSWORD,
            help=f"Shared demo password (default: {DEMO_PASSWORD})",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        password = options["password"]
        rows = []
        users = {}
        for phone, first, last, role in DEMO_USERS:
            user, created = User.objects.get_or_create(
                phone_number=phone,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "is_phone_verified": True,
                    "is_active": True,
                },
            )
            user.first_name = first
            user.last_name = last
            user.is_phone_verified = True
            user.is_active = True
            user.set_password(password)
            user.save()
            profile = getattr(user, "profile", None)
            if profile is not None:
                if not profile.job_title:
                    profile.job_title = "مدیر دمو" if role != "guest" else "کارشناس دمو"
                if not profile.company_name:
                    profile.company_name = "شرکت دمو تی آدیتر"
                profile.save()
            users[phone] = user
            rows.append((phone, f"{first} {last}", role, "created" if created else "updated"))

        owner = users["09128880001"]
        company = company_service.companies_for_user(owner).filter(name="شرکت دمو تی آدیتر").first()
        if company is None:
            company = company_service.create_company(user=owner, name="شرکت دمو تی آدیتر")
        group = group_service.groups_for_user(owner, company=company).filter(name="گروه مدیران دمو").first()
        if group is None:
            group = group_service.create_group(user=owner, company=company, name="گروه مدیران دمو")

        for phone, _first, _last, role in DEMO_USERS[1:]:
            user = users[phone]
            member_role = (
                GroupMember.Role.MAINTAINER if role == "maintainer" else GroupMember.Role.GUEST
            )
            GroupMember.objects.update_or_create(
                group=group,
                user=user,
                defaults={
                    "role": member_role,
                    "position_title": "مدیر دمو" if role == "maintainer" else "کارشناس دمو",
                    "status": GroupMember.Status.ACTIVE,
                    "joined_at": timezone.now(),
                    "created_by": owner,
                    "deleted_at": None,
                },
            )

        if not Meeting.objects.filter(group=group, deleted_at__isnull=True).exists():
            meeting_service.create_meeting(
                user=owner,
                group=group,
                name="جلسه دمو هیئت مدیره",
                description="صورت جلسه آزمایشی برای ورود مدیران دمو.",
            )

        self.stdout.write(self.style.SUCCESS("Demo minutes users are ready. Login at /login"))
        self.stdout.write(f"Password for all: {password}")
        self.stdout.write("phone          role         state")
        self.stdout.write("-" * 42)
        for phone, _name, role, state in rows:
            self.stdout.write(f"{phone}  {role:<11}  {state}")
        self.stdout.write(f"company_id={company.id} group_id={group.id}")
