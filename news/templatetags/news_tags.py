from django import template

from news.permissions import user_in_news_team

register = template.Library()


@register.simple_tag(takes_context=True)
def can_access_news(context) -> bool:
    """Hide the news nav link unless the user is in News Team (or superuser)."""
    return user_in_news_team(context.get("request") and context["request"].user)
