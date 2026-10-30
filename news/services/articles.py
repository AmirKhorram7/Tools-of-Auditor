from datetime import date

from django.db.models import Q, QuerySet
from rest_framework.exceptions import ValidationError

from news.models import Article


def _as_list(params, name):
    if hasattr(params, "getlist"):
        return params.getlist(name)
    value = params.get(name) or []
    if isinstance(value, (str, int)):
        return [value]
    return list(value)


def _date(value, name: str):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise ValidationError({name: "Use YYYY-MM-DD."}) from exc


class ArticleQueryService:
    """URL-driven list filters. Newest first (model Meta)."""

    def filtered(self, params) -> QuerySet[Article]:
        qs = Article.objects.select_related("source").all()
        q = (params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(title__icontains=q)
                | Q(summary__icontains=q)
                | Q(title_fa__icontains=q)
                | Q(summary_fa__icontains=q)
            )
        slugs = [s for s in _as_list(params, "source") if s]
        if slugs:
            qs = qs.filter(source__slug__in=slugs)
        source_ids = [v for v in _as_list(params, "source_id") if str(v).isdigit()]
        if source_ids:
            qs = qs.filter(source_id__in=source_ids)
        category = (params.get("category") or "").strip()
        if category:
            qs = qs.filter(source__category=category)
        region = (params.get("region") or "").strip()
        if region:
            qs = qs.filter(source__region=region)
        date_from = _date(params.get("date_from"), "date_from")
        date_to = _date(params.get("date_to"), "date_to")
        if date_from:
            qs = qs.filter(published_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(published_at__date__lte=date_to)
        return qs
