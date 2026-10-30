from news.constants import LANGUAGE_EN
from news.models import NewsPreference
from news.permissions import user_in_news_team, user_is_news_admin

__all__ = ["user_in_news_team", "user_is_news_admin", "preference_for"]


def preference_for(user) -> NewsPreference:
    pref, _ = NewsPreference.objects.get_or_create(
        user=user,
        defaults={"language": LANGUAGE_EN},
    )
    return pref
