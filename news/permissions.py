from functools import wraps

from django.contrib.auth.mixins import UserPassesTestMixin
from django.core.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def user_in_news_team(user) -> bool:
    """Feed + detail access: NewsTeamMember roster, or superuser."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser:
        return True
    from news.models import NewsTeamMember

    return NewsTeamMember.objects.filter(user_id=user.pk).exists()


def user_is_news_admin(user) -> bool:
    """Fetch / settings / update: superuser only."""
    return bool(user and getattr(user, "is_authenticated", False) and user.is_superuser)


class NewsTeamRequiredMixin(UserPassesTestMixin):
    """Django CBV mixin. 403 for anyone outside News Team (and anonymous)."""

    raise_exception = True

    def test_func(self):
        return user_in_news_team(self.request.user)


class IsNewsTeam(BasePermission):
    """DRF: authenticated News Team member or superuser."""

    def has_permission(self, request, view):
        return user_in_news_team(request.user)


class IsNewsFetchAdmin(BasePermission):
    """DRF: superuser — start fetch jobs and write sources."""

    def has_permission(self, request, view):
        return user_is_news_admin(request.user)


def news_team_required(view):
    """Function-view decorator. Raises 403 outside News Team (and for anonymous)."""

    @wraps(view)
    def _wrapped(request, *args, **kwargs):
        if not user_in_news_team(getattr(request, "user", None)):
            raise PermissionDenied
        return view(request, *args, **kwargs)

    return _wrapped
