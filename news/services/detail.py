"""Story detail payload: excerpts for the reader UI, never raw warehouse body."""

from __future__ import annotations

import re
from urllib.parse import urlparse

from django.db.models import Q

from news.models import Article, FetchJob, TranslationStatus

# Copyright-safe excerpt caps for the reader UI.
_MAX_PARAS = 8
_MAX_PARA_CHARS = 900
_MAX_BRIEF = 3
_WORDS_PER_MINUTE = 200

_SOURCE_COLORS = {
    "anthropic-news": "#e8a87c",
    "anthropic-engineering": "#e8a87c",
    "openai-news": "#4ade80",
    "deepmind-blog": "#60a5fa",
    "google-ai-blog": "#60a5fa",
    "meta-ai": "#38bdf8",
    "mit-news-ai": "#f43f5e",
    "stanford-hai": "#fb7185",
    "stanford-ai-lab": "#fb7185",
    "huggingface-blog": "#facc15",
    "techcrunch-ai": "#34d399",
    "theverge-ai": "#c084fc",
    "hacker-news-ai": "#fb923c",
    "nvidia-blog": "#76b900",
    "microsoft-research": "#00a4ef",
    "arxiv-cs-ai": "#b31b1b",
    "arxiv-cs-lg": "#b31b1b",
    "arxiv-cs-cl": "#b31b1b",
}

_FALLBACK_COLORS = (
    "#e8a87c",
    "#4ade80",
    "#60a5fa",
    "#38bdf8",
    "#f43f5e",
    "#fb7185",
    "#facc15",
    "#34d399",
    "#c084fc",
    "#fb923c",
    "#a78bfa",
    "#22d3ee",
)


def source_color(source) -> str:
    raw = (getattr(source, "color", None) or "").strip()
    if re.fullmatch(r"#[0-9A-Fa-f]{6}", raw):
        return raw.lower()
    slug = getattr(source, "slug", "") or ""
    if slug in _SOURCE_COLORS:
        return _SOURCE_COLORS[slug]
    h = 0
    for ch in slug:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return _FALLBACK_COLORS[h % len(_FALLBACK_COLORS)]


def reading_minutes_for(text: str, stored: int = 0) -> int:
    if stored and stored > 0:
        return stored
    words = len(re.findall(r"\w+", text or ""))
    return max(1, (words + _WORDS_PER_MINUTE - 1) // _WORDS_PER_MINUTE) if words else 1


def _split_paragraphs(text: str) -> list[str]:
    raw = (text or "").strip()
    if not raw:
        return []
    parts = [p.strip() for p in re.split(r"\n{2,}", raw) if p.strip()]
    if len(parts) <= 1:
        parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+(?=[A-ZА-ЯΆ-Ω])", raw) if p.strip()]
    if len(parts) <= 1 and len(raw) > 280:
        # Soft wrap long single blocks into readable chunks.
        words = raw.split()
        chunk, parts = [], []
        for w in words:
            chunk.append(w)
            if len(" ".join(chunk)) >= 320:
                parts.append(" ".join(chunk))
                chunk = []
        if chunk:
            parts.append(" ".join(chunk))
    return parts


def paragraphs_from_article(article: Article) -> list[dict]:
    stored = article.paragraphs or []
    if isinstance(stored, list) and stored:
        out = []
        for row in stored[:_MAX_PARAS]:
            if not isinstance(row, dict):
                continue
            en = (row.get("en") or "").strip()[:_MAX_PARA_CHARS]
            fa = (row.get("fa") or "").strip()[:_MAX_PARA_CHARS]
            if en or fa:
                out.append({"en": en, "fa": fa})
        if out:
            return out
    # Fall back to copyright-safe excerpts from body (warehouse text), else summary.
    source_text = (article.body or "").strip() or (article.summary or "").strip()
    fa_text = (article.summary_fa or "").strip()
    ens = _split_paragraphs(source_text)[:_MAX_PARAS]
    fas = _split_paragraphs(fa_text)[:_MAX_PARAS] if fa_text else []
    rows = []
    for i, en in enumerate(ens):
        rows.append(
            {
                "en": en[:_MAX_PARA_CHARS],
                "fa": (fas[i] if i < len(fas) else "")[:_MAX_PARA_CHARS],
            }
        )
    return rows


def brief_from_article(article: Article) -> tuple[list[str], list[str]]:
    brief = [str(x).strip() for x in (article.brief or []) if str(x).strip()][:_MAX_BRIEF]
    brief_fa = [str(x).strip() for x in (article.brief_fa or []) if str(x).strip()][:_MAX_BRIEF]
    if brief:
        return brief, brief_fa
    # Derive short bullets from summary, else opening of body, when enrichment has not run yet.
    summary = (article.summary or "").strip() or (article.body or "").strip()
    if not summary:
        return [], []
    bits = [b.strip() for b in re.split(r"(?<=[.!?])\s+", summary) if b.strip() and len(b.strip()) > 24]
    if len(bits) < 2:
        # Fall back to first paragraph chunks.
        bits = [p[:220].strip() for p in _split_paragraphs(summary) if p.strip()]
    if not bits:
        bits = [summary[:220]]
    brief = [b[:220] for b in bits[:_MAX_BRIEF]]
    fa_bits = [b.strip() for b in re.split(r"(?<=[.!?])\s+", (article.summary_fa or "").strip()) if b.strip()]
    brief_fa = [b[:220] for b in fa_bits[:_MAX_BRIEF]] if fa_bits else []
    return brief, brief_fa


def key_points_from_article(article: Article) -> list[dict]:
    rows = article.key_points or []
    out = []
    if isinstance(rows, list):
        for row in rows[:6]:
            if not isinstance(row, dict):
                continue
            title = (row.get("title") or "").strip()
            text = (row.get("text") or "").strip()
            if not title and not text:
                continue
            out.append(
                {
                    "title": title,
                    "text": text,
                    "title_fa": (row.get("title_fa") or "").strip(),
                    "text_fa": (row.get("text_fa") or "").strip(),
                }
            )
    if out:
        return out
    # Lightweight fallback from brief bullets until enrichment runs.
    brief, brief_fa = brief_from_article(article)
    for i, line in enumerate(brief[:3]):
        words = line.split()
        title = " ".join(words[:4]) if words else f"Point {i + 1}"
        out.append(
            {
                "title": title[:80],
                "text": line,
                "title_fa": (brief_fa[i].split()[0] if i < len(brief_fa) and brief_fa[i] else ""),
                "text_fa": brief_fa[i] if i < len(brief_fa) else "",
            }
        )
    return out


def entities_from_article(article: Article) -> list[dict]:
    rows = article.entities or []
    out = []
    if isinstance(rows, list):
        for row in rows:
            if not isinstance(row, dict):
                continue
            name = (row.get("name") or "").strip()
            typ = (row.get("type") or "topic").strip().lower() or "topic"
            if name:
                out.append({"type": typ, "name": name})
    if out:
        return out
    # Lightweight fallback: source org + tags as topics.
    out.append({"type": "org", "name": article.source.name})
    for tag in (article.tags or [])[:4]:
        label = str(tag).strip()
        if label:
            out.append({"type": "topic", "name": label})
    return out


def ensure_detail_fields(article: Article) -> Article:
    """Fill empty reader fields from body/summary so the detail page has content."""
    changed = []
    paras = paragraphs_from_article(article)
    if not (article.paragraphs or []) and paras:
        article.paragraphs = paras
        changed.append("paragraphs")
    brief, brief_fa = brief_from_article(article)
    if not (article.brief or []) and brief:
        article.brief = brief
        changed.append("brief")
    if not (article.brief_fa or []) and brief_fa:
        article.brief_fa = brief_fa
        changed.append("brief_fa")
    if not article.reading_minutes:
        blob = " ".join(p.get("en", "") for p in paras) or article.body or article.summary
        article.reading_minutes = reading_minutes_for(blob)
        changed.append("reading_minutes")
    if not (article.entities or []):
        article.entities = entities_from_article(article)
        changed.append("entities")
    if not (article.key_points or []):
        derived_points = key_points_from_article(article)
        if derived_points:
            article.key_points = derived_points
            changed.append("key_points")
    if changed:
        article.save(update_fields=[*changed, "updated_at"])
    return article


def related_articles(article: Article, limit: int = 3) -> list[Article]:
    qs = (
        Article.objects.select_related("source")
        .exclude(pk=article.pk)
        .filter(Q(source__category=article.source.category) | Q(source_id=article.source_id))
        .order_by("-published_at", "-id")
    )
    rows = list(qs[:limit])
    if len(rows) < limit:
        extra = (
            Article.objects.select_related("source")
            .exclude(pk=article.pk)
            .exclude(pk__in=[r.pk for r in rows])
            .order_by("-published_at", "-id")[: limit - len(rows)]
        )
        rows.extend(extra)
    return rows


def neighbor_ids(article: Article, id_list: list[int] | None = None) -> tuple[int | None, int | None]:
    if id_list:
        try:
            i = id_list.index(article.pk)
        except ValueError:
            i = -1
        if i >= 0:
            prev_id = id_list[i - 1] if i > 0 else None
            next_id = id_list[i + 1] if i + 1 < len(id_list) else None
            return prev_id, next_id
    # Fallback: chronological neighbors in the global feed (newest-first list).
    qs = Article.objects.exclude(pk=article.pk)
    if article.published_at is None:
        prev_row = qs.filter(published_at__isnull=True, id__gt=article.pk).order_by("id").values_list("id", flat=True).first()
        if prev_row is None:
            prev_row = qs.filter(published_at__isnull=False).order_by("published_at", "id").values_list("id", flat=True).first()
        next_row = qs.filter(published_at__isnull=True, id__lt=article.pk).order_by("-id").values_list("id", flat=True).first()
        if next_row is None:
            next_row = qs.filter(published_at__isnull=False).order_by("-published_at", "-id").values_list("id", flat=True).first()
        return prev_row, next_row
    prev_row = (
        qs.filter(
            Q(published_at__gt=article.published_at)
            | Q(published_at=article.published_at, id__gt=article.pk)
        )
        .order_by("published_at", "id")
        .values_list("id", flat=True)
        .first()
    )
    next_row = (
        qs.filter(
            Q(published_at__lt=article.published_at)
            | Q(published_at=article.published_at, id__lt=article.pk)
            | Q(published_at__isnull=True)
        )
        .order_by("-published_at", "-id")
        .values_list("id", flat=True)
        .first()
    )
    return prev_row, next_row


def fetch_trace(article: Article) -> dict:
    job = (
        FetchJob.objects.filter(Q(source_id=article.source_id) | Q(source__isnull=True), status="done")
        .order_by("-finished_at", "-id")
        .first()
    )
    parsed = urlparse(article.canonical_url or article.url)
    host_path = f"{parsed.netloc}{parsed.path}".rstrip("/") or parsed.netloc
    method = (article.source.source_type or "rss").upper()
    if method == "RSS":
        method = "RSS"
    elif method == "ATOM":
        method = "Atom"
    elif method == "SITEMAP":
        method = "Sitemap"
    elif method == "API":
        method = "API"
    else:
        method = "HTML"
    return {
        "method": method,
        "job_id": job.pk if job else None,
        "content_hash": article.content_hash or "",
        "fetched_at": article.fetched_at,
        "translation_status": article.translation_status,
        "canonical": host_path,
        "source_name": article.source.name,
        "source_type": article.source.source_type,
    }


def build_detail(article: Article, *, staff: bool = False, id_list: list[int] | None = None) -> dict:
    article = ensure_detail_fields(article)
    source = article.source
    color = source_color(source)
    brief, brief_fa = brief_from_article(article)
    paras = paragraphs_from_article(article)
    minutes = reading_minutes_for(
        " ".join(p.get("en", "") for p in paras) or article.body or article.summary,
        article.reading_minutes,
    )
    prev_id, next_id = neighbor_ids(article, id_list)
    related = related_articles(article)
    payload = {
        "id": article.pk,
        "source": {
            "id": source.pk,
            "slug": source.slug,
            "name": source.name,
            "color": color,
            "source_type": source.source_type,
            "category": source.category,
        },
        "category": source.category,
        "url": article.url,
        "canonical_url": article.canonical_url or article.url,
        "title": article.title,
        "title_fa": article.title_fa or "",
        "summary": article.summary or "",
        "summary_fa": article.summary_fa or "",
        "brief": brief,
        "brief_fa": brief_fa,
        "key_points": key_points_from_article(article),
        "paragraphs": paras,
        "why_it_matters": article.why_it_matters or "",
        "why_it_matters_fa": article.why_it_matters_fa or "",
        "entities": entities_from_article(article),
        "reading_minutes": minutes,
        "published_at": article.published_at,
        "fetched_at": article.fetched_at,
        "translation_status": article.translation_status,
        "related": [
            {
                "id": row.pk,
                "source": {
                    "slug": row.source.slug,
                    "name": row.source.name,
                    "color": source_color(row.source),
                },
                "title": row.title,
                "title_fa": row.title_fa or "",
            }
            for row in related
        ],
        "prev_id": prev_id,
        "next_id": next_id,
    }
    if staff:
        payload["fetch_trace"] = fetch_trace(article)
    return payload


def seed_reader_fields(*, body: str, summary: str, source_name: str = "") -> dict:
    """Values to set on create so the first detail open has story text."""
    text = (body or "").strip() or (summary or "").strip()
    ens = _split_paragraphs(text)[:_MAX_PARAS]
    paragraphs = [{"en": p[:_MAX_PARA_CHARS], "fa": ""} for p in ens]
    brief_bits = [b.strip() for b in re.split(r"(?<=[.!?])\s+", (summary or "").strip()) if b.strip()]
    brief = brief_bits[:_MAX_BRIEF] if brief_bits else ([summary[:220]] if summary else [])
    minutes = reading_minutes_for(text)
    entities = [{"type": "org", "name": source_name}] if source_name else []
    return {
        "paragraphs": paragraphs,
        "brief": brief,
        "reading_minutes": minutes,
        "entities": entities,
    }
