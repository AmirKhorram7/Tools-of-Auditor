"""News Team roster — add/remove members and keep the legacy Django Group in sync.

The model stays a plain table. Call these helpers (or go through admin) instead of
putting side effects on NewsTeamMember.save / .delete.
"""

from __future__ import annotations

from django.contrib.auth.models import Group
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from news.constants import NEWS_GROUP_NAME
from news.models import NewsTeamMember


def news_group() -> Group:
    group, _ = Group.objects.get_or_create(name=NEWS_GROUP_NAME)
    return group


def sync_user_into_legacy_group(user) -> None:
    if not user or not getattr(user, "pk", None):
        return
    news_group().user_set.add(user)


def remove_user_from_legacy_group(user) -> None:
    if not user or not getattr(user, "pk", None):
        return
    group = Group.objects.filter(name=NEWS_GROUP_NAME).first()
    if group is not None:
        group.user_set.remove(user)


def add_member(user, *, added_by=None, notes: str = "") -> NewsTeamMember:
    """Grant feed/detail access. Idempotent."""
    member, created = NewsTeamMember.objects.get_or_create(
        user=user,
        defaults={"added_by": added_by, "notes": notes or ""},
    )
    if not created:
        fields: list[str] = []
        if notes and member.notes != notes:
            member.notes = notes
            fields.append("notes")
        if added_by and not member.added_by_id:
            member.added_by = added_by
            fields.append("added_by")
        if fields:
            member.save(update_fields=fields)
    sync_user_into_legacy_group(user)
    return member


def remove_membership(member: NewsTeamMember) -> None:
    """Revoke feed/detail access for this roster row."""
    user = member.user
    member.delete()
    remove_user_from_legacy_group(user)


def remove_member(user) -> bool:
    """Revoke by user. Returns True if a row was removed."""
    member = NewsTeamMember.objects.filter(user=user).first()
    if member is None:
        remove_user_from_legacy_group(user)
        return False
    remove_membership(member)
    return True


@receiver(post_save, sender=NewsTeamMember)
def _on_news_team_member_saved(sender, instance: NewsTeamMember, **kwargs):
    sync_user_into_legacy_group(instance.user)


@receiver(post_delete, sender=NewsTeamMember)
def _on_news_team_member_deleted(sender, instance: NewsTeamMember, **kwargs):
    remove_user_from_legacy_group(instance.user)
