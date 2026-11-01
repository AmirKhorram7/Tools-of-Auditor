from __future__ import annotations

import logging
import re

import httpx
from django.conf import settings
from django.core.cache import cache

from news.models import Article, TranslationStatus

log = logging.getLogger("news")

CACHE_TTL = 30 * 24 * 3600
_MAX_STORY_PARAS = 8
_MAX_PARA_CHARS = 900

PROMPT = (
    "Translate the following news title and summary into natural Persian (Farsi). "
    "Keep product names, model names, company names and technical terms in Latin script "
    "when that is how they are normally written (Claude, GPT-4, OpenAI, PyTorch, …). "
    "Return exactly two lines: TITLE: ... then SUMMARY: ..."
)

STORY_PROMPT = (
    "Translate each numbered English news paragraph into natural Persian (Farsi). "
    "Keep product names, model names, company names and technical terms in Latin script "
    "when that is how they are normally written. "
    "Return one line per paragraph as P1: ... P2: ... with the same numbering."
)


class TranslationService:
    def translate_article(self, article_id: int, *, force: bool = False) -> Article:
        article = Article.objects.get(pk=article_id)
        if article.language == "fa":
            article.title_fa = article.title
            article.summary_fa = article.summary
            article.translation_status = TranslationStatus.DONE
            article.save(update_fields=["title_fa", "summary_fa", "translation_status"])
            self._ensure_story_paragraphs(article)
            self._copy_en_story_to_fa(article)
            return article

        provider = self._resolve_provider()
        needs_title = force or not (article.title_fa or "").strip()
        needs_story = force or self._story_needs_fa(article)

        if (
            not force
            and article.translation_status == TranslationStatus.DONE
            and not needs_title
            and not needs_story
        ):
            return article

        cache_key = f"news:tr:{article.content_hash}"
        if needs_title and not force:
            cached = cache.get(cache_key)
            if cached:
                article.title_fa = cached.get("title_fa", "")
                article.summary_fa = cached.get("summary_fa", "")
                article.translation_status = TranslationStatus.DONE
                article.save(update_fields=["title_fa", "summary_fa", "translation_status"])
                needs_title = False

        if needs_title:
            article.translation_status = TranslationStatus.PENDING
            article.save(update_fields=["translation_status"])
            try:
                title_fa, summary_fa = self._call_provider(provider, article.title, article.summary)
            except Exception as exc:  # noqa: BLE001
                log.warning("translate failed article=%s provider=%s: %s", article.pk, provider, exc)
                article.translation_status = TranslationStatus.FAILED
                article.save(update_fields=["translation_status"])
                return article
            article.title_fa = title_fa[:400]
            article.summary_fa = summary_fa[:4000]
            article.translation_status = TranslationStatus.DONE
            article.save(update_fields=["title_fa", "summary_fa", "translation_status"])
            cache.set(
                cache_key,
                {"title_fa": article.title_fa, "summary_fa": article.summary_fa},
                CACHE_TTL,
            )

        self._fill_reader_meta_fa(article)
        try:
            self._translate_story_paragraphs(article, provider, force=force)
        except Exception as exc:  # noqa: BLE001
            # Title/summary may already be done; story failure is logged but not fatal.
            log.warning("story translate failed article=%s: %s", article.pk, exc)
        return article

    def _resolve_provider(self) -> str:
        """Prefer Anthropic when keyed; otherwise use free MyMemory so Translate works."""
        configured = (getattr(settings, "NEWS_TRANSLATE_PROVIDER", "auto") or "auto").lower()
        key = getattr(settings, "NEWS_ANTHROPIC_API_KEY", "") or ""
        if configured == "test":
            return "test"
        if configured == "mymemory":
            return "mymemory"
        if configured == "anthropic":
            return "anthropic" if key else "mymemory"
        return "anthropic" if key else "mymemory"

    def _ensure_story_paragraphs(self, article: Article) -> list[dict]:
        """Normalize stored paragraphs, or build EN rows from body/summary."""
        from news.services.detail import paragraphs_from_article

        rows = paragraphs_from_article(article)
        if rows and rows != (article.paragraphs or []):
            article.paragraphs = rows
            article.save(update_fields=["paragraphs"])
        return list(article.paragraphs or [])

    def _story_needs_fa(self, article: Article) -> bool:
        rows = self._ensure_story_paragraphs(article)
        if not rows:
            return False
        return any(
            (row.get("en") or "").strip() and not (row.get("fa") or "").strip()
            for row in rows
            if isinstance(row, dict)
        )

    def _copy_en_story_to_fa(self, article: Article) -> None:
        rows = self._ensure_story_paragraphs(article)
        next_rows = []
        changed = False
        for row in rows:
            item = dict(row or {})
            if not (item.get("fa") or "").strip() and (item.get("en") or "").strip():
                item["fa"] = item["en"]
                changed = True
            next_rows.append(item)
        if changed:
            article.paragraphs = next_rows
            article.save(update_fields=["paragraphs"])

    def _fill_reader_meta_fa(self, article: Article) -> None:
        """Fill brief / why-it-matters FA from summary_fa when still empty."""
        changed: list[str] = []
        if article.summary_fa and not (article.brief_fa or []):
            bits = [p[:220].strip() for p in article.summary_fa.split("\n") if p.strip()]
            if not bits:
                bits = [article.summary_fa[:220]]
            article.brief_fa = bits[:3]
            changed.append("brief_fa")
        if article.summary_fa and not (article.why_it_matters_fa or "").strip():
            article.why_it_matters_fa = (article.summary_fa or "")[:800]
            changed.append("why_it_matters_fa")
        if changed:
            article.save(update_fields=changed)

    def _translate_story_paragraphs(self, article: Article, provider: str, *, force: bool) -> None:
        rows = self._ensure_story_paragraphs(article)[:_MAX_STORY_PARAS]
        if not rows:
            return

        pending: list[tuple[int, str]] = []
        for i, row in enumerate(rows):
            if not isinstance(row, dict):
                continue
            en = (row.get("en") or "").strip()[:_MAX_PARA_CHARS]
            fa = (row.get("fa") or "").strip()
            if en and (force or not fa):
                pending.append((i, en))

        if not pending:
            return

        translated = self._translate_texts(provider, [text for _, text in pending])
        next_rows = [dict(row) if isinstance(row, dict) else {"en": "", "fa": ""} for row in rows]
        for (index, _), fa_text in zip(pending, translated):
            if fa_text:
                next_rows[index]["fa"] = fa_text[:_MAX_PARA_CHARS]
        article.paragraphs = next_rows
        article.save(update_fields=["paragraphs"])

    def _translate_texts(self, provider: str, texts: list[str]) -> list[str]:
        if not texts:
            return []
        if provider == "test":
            return [f"{t} [fa]" for t in texts]
        if provider == "mymemory":
            return [_mymemory_one(t[:450]) or t for t in texts]
        return self._call_anthropic_paragraphs(texts)

    def _call_provider(self, provider: str, title: str, summary: str) -> tuple[str, str]:
        if provider == "test":
            return f"{title} [fa]", (summary or title)
        if provider == "mymemory":
            return self._call_mymemory(title, summary)
        return self._call_anthropic(title, summary)

    def _call_anthropic(self, title: str, summary: str) -> tuple[str, str]:
        key = getattr(settings, "NEWS_ANTHROPIC_API_KEY", "") or ""
        if not key:
            raise RuntimeError("NEWS_ANTHROPIC_API_KEY is not set")
        model = getattr(settings, "NEWS_ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
        user = f"TITLE: {title}\nSUMMARY: {summary or title}"
        response = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 800,
                "messages": [{"role": "user", "content": f"{PROMPT}\n\n{user}"}],
            },
            timeout=40.0,
        )
        response.raise_for_status()
        data = response.json()
        text = ""
        for block in data.get("content") or []:
            if block.get("type") == "text":
                text += block.get("text") or ""
        return _parse_translated(text, title, summary)

    def _call_anthropic_paragraphs(self, texts: list[str]) -> list[str]:
        key = getattr(settings, "NEWS_ANTHROPIC_API_KEY", "") or ""
        if not key:
            raise RuntimeError("NEWS_ANTHROPIC_API_KEY is not set")
        model = getattr(settings, "NEWS_ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
        numbered = "\n\n".join(f"P{i + 1}: {t}" for i, t in enumerate(texts))
        response = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 2500,
                "messages": [{"role": "user", "content": f"{STORY_PROMPT}\n\n{numbered}"}],
            },
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()
        text = ""
        for block in data.get("content") or []:
            if block.get("type") == "text":
                text += block.get("text") or ""
        parsed = _parse_numbered_paragraphs(text, len(texts))
        return [parsed.get(i + 1) or texts[i] for i in range(len(texts))]

    def _call_mymemory(self, title: str, summary: str) -> tuple[str, str]:
        """On-demand FA without Anthropic. Title + summary only (length-capped)."""
        title_fa = _mymemory_one(title or "")
        summary_fa = _mymemory_one((summary or title or "")[:450])
        if not title_fa and not summary_fa:
            raise RuntimeError("MyMemory returned empty translation")
        return title_fa or title, summary_fa or summary or title


def _mymemory_one(text: str) -> str:
    text = (text or "").strip()
    if not text:
        return ""
    response = httpx.get(
        "https://api.mymemory.translated.net/get",
        params={"q": text[:500], "langpair": "en|fa"},
        timeout=25.0,
    )
    response.raise_for_status()
    data = response.json()
    translated = ((data.get("responseData") or {}).get("translatedText") or "").strip()
    if not translated or translated.lower() == text.lower():
        return ""
    return translated


def _parse_translated(text: str, fallback_title: str, fallback_summary: str) -> tuple[str, str]:
    title = ""
    summary = ""
    for line in (text or "").splitlines():
        raw = line.strip()
        if raw.upper().startswith("TITLE:"):
            title = raw.split(":", 1)[1].strip()
        elif raw.upper().startswith("SUMMARY:"):
            summary = raw.split(":", 1)[1].strip()
    if not title:
        title = fallback_title
    if not summary:
        summary = fallback_summary
    return title, summary


def _parse_numbered_paragraphs(text: str, count: int) -> dict[int, str]:
    out: dict[int, str] = {}
    current: int | None = None
    buf: list[str] = []
    for line in (text or "").splitlines():
        match = re.match(r"^P(\d+)\s*:\s*(.*)$", line.strip(), re.IGNORECASE)
        if match:
            if current is not None:
                out[current] = " ".join(buf).strip()
            current = int(match.group(1))
            buf = [match.group(2).strip()] if match.group(2).strip() else []
        elif current is not None and line.strip():
            buf.append(line.strip())
    if current is not None:
        out[current] = " ".join(buf).strip()
    # Keep only expected indices.
    return {i: out[i] for i in range(1, count + 1) if i in out and out[i]}
