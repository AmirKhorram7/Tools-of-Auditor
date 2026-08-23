"""Rank users by how much they actually create in each tool."""

from django.db.models import Count, F, Q
from django.urls import reverse

from user_management.models import CustomUser


def _name(user) -> str:
    full = f"{user.first_name} {user.last_name}".strip()
    return full or user.phone_number


def _spread(values: list[int]) -> dict:
    if not values:
        return {"min": 0, "max": 0, "avg": 0.0, "n": 0}
    return {
        "min": min(values),
        "max": max(values),
        "avg": round(sum(values) / len(values), 1),
        "n": len(values),
    }


def _pct(value: int, peak: int) -> int:
    if not peak:
        return 0
    return round(100 * value / peak)


def _rows(users, columns: list[dict], score_attr: str) -> list[dict]:
    peak = max((getattr(user, score_attr) for user in users), default=1) or 1
    rows = []
    for index, user in enumerate(users, start=1):
        score = getattr(user, score_attr)
        rows.append(
            {
                "rank": index,
                "user": user,
                "name": _name(user),
                "phone": user.phone_number,
                "active": user.is_active,
                "score": score,
                "score_pct": _pct(score, peak),
                "cells": [getattr(user, col["key"]) for col in columns],
                "report_href": reverse("admin:user_activity_report", args=[user.pk]),
                "change_href": reverse(
                    "admin:user_management_customuser_change", args=[user.pk]
                ),
            }
        )
    return rows


def _metrics(users, columns: list[dict], score_attr: str) -> list[dict]:
    metrics = []
    for col in columns + [{"key": score_attr, "label": "Total score", "hint": "Sum of the counts above"}]:
        numbers = [getattr(user, col["key"]) for user in users]
        spread = _spread(numbers)
        metrics.append(
            {
                **col,
                **spread,
                "pct": _pct(int(spread["avg"]), spread["max"] or 1),
            }
        )
    return metrics


def build_explanation_ranking() -> dict:
    columns = [
        {"key": "folders", "label": "Folders", "hint": "Root folders they created"},
        {"key": "processes", "label": "Processes", "hint": "Processes they designed"},
        {"key": "steps", "label": "Steps", "hint": "Steps on those processes"},
    ]
    users = list(
        CustomUser.objects.annotate(
            folders=Count(
                "owned_projects",
                filter=Q(
                    owned_projects__parent__isnull=True,
                    owned_projects__is_deleted=False,
                ),
                distinct=True,
            ),
            processes=Count(
                "owned_processes",
                filter=Q(owned_processes__is_deleted=False),
                distinct=True,
            ),
            steps=Count(
                "owned_processes__steps",
                filter=Q(
                    owned_processes__is_deleted=False,
                    owned_processes__steps__is_deleted=False,
                ),
                distinct=True,
            ),
        )
        .annotate(score=F("folders") + F("processes") + F("steps"))
        .filter(score__gt=0)
        .order_by("-score", "-processes", "-folders", "first_name", "id")[:200]
    )
    rows = _rows(users, columns, "score")
    return {
        "kind": "explanation",
        "title": "System explanation — activity ranking",
        "subtitle": "Users ordered by folders, processes, and steps they created.",
        "columns": columns,
        "metrics": _metrics(users, columns, "score"),
        "top5": rows[:5],
        "rows": rows,
        "active_count": len(users),
    }


def build_work_ranking() -> dict:
    columns = [
        {"key": "companies", "label": "Companies", "hint": "Companies they own"},
        {"key": "teams", "label": "Teams", "hint": "Teams they own"},
        {"key": "projects", "label": "Projects", "hint": "Work projects they own"},
        {"key": "tasks", "label": "Tasks", "hint": "Tasks they created"},
        {"key": "steps", "label": "Steps", "hint": "Steps on those tasks"},
        {"key": "activity", "label": "Activity log", "hint": "Work actions they recorded"},
    ]
    users = list(
        CustomUser.objects.annotate(
            companies=Count("owned_companies", distinct=True),
            teams=Count("owned_teams", distinct=True),
            projects=Count("owned_work_projects", distinct=True),
            tasks=Count("created_work_tasks", distinct=True),
            steps=Count("created_work_tasks__steps", distinct=True),
            activity=Count("work_activity_logs", distinct=True),
        )
        .annotate(
            score=(
                F("companies")
                + F("teams")
                + F("projects")
                + F("tasks")
                + F("steps")
                + F("activity")
            )
        )
        .filter(score__gt=0)
        .order_by("-score", "-tasks", "-projects", "first_name", "id")[:200]
    )
    rows = _rows(users, columns, "score")
    return {
        "kind": "work",
        "title": "Work — activity ranking",
        "subtitle": "Users ordered by companies, teams, projects, tasks, steps, and logged actions.",
        "columns": columns,
        "metrics": _metrics(users, columns, "score"),
        "top5": rows[:5],
        "rows": rows,
        "active_count": len(users),
    }
