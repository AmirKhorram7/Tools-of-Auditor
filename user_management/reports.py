"""Assemble a 360° activity snapshot for one user (Django admin report)."""

from django.db.models import Count, Q
from django.urls import reverse

from system_explanation_services.models import ProcessStep
from team_manage_services.models import ActivityLog, Task


def admin_url(obj) -> str:
    opts = obj._meta
    return reverse(f"admin:{opts.app_label}_{opts.model_name}_change", args=[obj.pk])


def attach_admin_urls(items, attr="admin_href"):
    for obj in items:
        setattr(obj, attr, admin_url(obj))
    return items


def _name(user) -> str:
    full = f"{user.first_name} {user.last_name}".strip()
    return full or user.phone_number


def _profile(user):
    return getattr(user, "profile", None) if hasattr(user, "profile") else None


def build_user_activity(user) -> dict:
    profile = _profile(user)

    folders = attach_admin_urls(
        list(
            user.owned_projects.filter(parent__isnull=True)
            .annotate(
                process_total=Count(
                    "processes",
                    filter=Q(processes__is_deleted=False),
                    distinct=True,
                ),
                subfolder_total=Count(
                    "sub_projects",
                    filter=Q(sub_projects__is_deleted=False),
                    distinct=True,
                ),
            )
            .order_by("-created_at")[:50]
        )
    )
    subfolders = attach_admin_urls(
        list(
            user.owned_projects.filter(parent__isnull=False)
            .select_related("parent")
            .order_by("-created_at")[:50]
        )
    )
    processes = attach_admin_urls(
        list(
            user.owned_processes.select_related("project", "project__parent")
            .annotate(step_total=Count("steps", filter=Q(steps__is_deleted=False)))
            .order_by("-created_at")[:80]
        )
    )
    shared = list(
        user.project_memberships.select_related("project").order_by("-created_at")[:40]
    )
    for row in shared:
        row.admin_href = admin_url(row.project)

    step_count = ProcessStep.objects.filter(process__owner=user).count()
    documented_steps = (
        ProcessStep.objects.filter(process__owner=user)
        .exclude(explanation="")
        .count()
    )

    companies = attach_admin_urls(list(user.owned_companies.order_by("name")[:40]))
    company_seats = list(
        user.company_memberships.select_related("company").order_by("-created_at")[:40]
    )
    for row in company_seats:
        row.admin_href = admin_url(row.company)
    teams = attach_admin_urls(
        list(user.owned_teams.select_related("company").order_by("name")[:40])
    )
    team_seats = list(
        user.team_memberships.select_related("team", "team__company").order_by(
            "-created_at"
        )[:40]
    )
    for row in team_seats:
        row.admin_href = admin_url(row.team)
    work_projects = attach_admin_urls(
        list(
            user.owned_work_projects.select_related("company").order_by("-created_at")[
                :40
            ]
        )
    )
    tasks_created = attach_admin_urls(
        list(
            user.created_work_tasks.select_related("project").order_by("-created_at")[:40]
        )
    )
    tasks_assigned = attach_admin_urls(
        list(
            Task.objects.filter(assigned_to__user=user)
            .select_related("project", "assigned_to")
            .order_by("-created_at")[:40]
        )
    )
    tickets = attach_admin_urls(list(user.tickets.order_by("-created_at")[:20]))
    activity = list(
        ActivityLog.objects.filter(actor=user)
        .select_related("company", "project")
        .order_by("-created_at")[:25]
    )
    builder_clicks = list(user.builder_contact_clicks.order_by("-created_at")[:40])

    stats = [
        {
            "key": "folders",
            "label": "Folders owned",
            "value": user.owned_projects.filter(parent__isnull=True).count(),
            "hint": "System explanation roots",
        },
        {
            "key": "processes",
            "label": "Processes designed",
            "value": user.owned_processes.count(),
            "hint": "Canvas workflows",
        },
        {
            "key": "steps",
            "label": "Steps documented",
            "value": documented_steps,
            "hint": f"{step_count} steps in total",
        },
        {
            "key": "shared",
            "label": "Folders shared with them",
            "value": user.project_memberships.count(),
            "hint": "Member, not owner",
        },
        {
            "key": "work",
            "label": "Work projects",
            "value": user.owned_work_projects.count(),
            "hint": "Team manager",
        },
        {
            "key": "tasks",
            "label": "Open tasks assigned",
            "value": Task.objects.filter(assigned_to__user=user)
            .exclude(status__in=["done", "cancelled"])
            .count(),
            "hint": "Not done / cancelled",
        },
        {
            "key": "tickets",
            "label": "Support tickets",
            "value": user.tickets.exclude(status="CLOSED").count(),
            "hint": "Open or waiting",
        },
        {
            "key": "teams",
            "label": "Teams they own",
            "value": user.owned_teams.count(),
            "hint": "Company teams",
        },
        {
            "key": "linkedin",
            "label": "LinkedIn footer clicks",
            "value": user.builder_contact_clicks.filter(channel="linkedin").count(),
            "hint": "Contact the builder",
        },
        {
            "key": "telegram",
            "label": "Telegram footer clicks",
            "value": user.builder_contact_clicks.filter(channel="telegram").count(),
            "hint": "Contact the builder",
        },
    ]
    peak = max((row["value"] for row in stats), default=1) or 1
    for row in stats:
        row["pct"] = round(100 * row["value"] / peak)

    return {
        "user": user,
        "display_name": _name(user),
        "profile": profile,
        "has_password": user.has_login_password(),
        "stats": stats,
        "folders": folders,
        "subfolders": subfolders,
        "processes": processes,
        "shared": shared,
        "companies": companies,
        "company_seats": company_seats,
        "teams": teams,
        "team_seats": team_seats,
        "work_projects": work_projects,
        "tasks_created": tasks_created,
        "tasks_assigned": tasks_assigned,
        "tickets": tickets,
        "activity": activity,
        "builder_clicks": builder_clicks,
    }
