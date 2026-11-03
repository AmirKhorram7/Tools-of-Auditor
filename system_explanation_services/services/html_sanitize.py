"""Sanitize explanation HTML (DESIGN.md §6) — nh3 allowlist including section tags."""

from __future__ import annotations

import nh3

ALLOWED_TAGS = {
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "a",
    "section",
    "div",
    "span",
    "blockquote",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "font",
}

# Note: do not put "rel"/"target" on <a> here — nh3 manages link_rel separately.
ALLOWED_ATTRS = {
    "*": {
        "data-section",
        "data-section-id",
        "data-open",
        "data-section-title",
        "data-section-body",
        "data-author",
        "dir",
        "style",
        "class",
    },
    "a": {"href", "title"},
    "font": {"color", "face", "size"},
    "td": {"style", "colspan", "rowspan", "width"},
    "th": {"style", "colspan", "rowspan", "width"},
    "table": {"style", "width"},
}


def clean_explanation(html: str | None) -> str:
    if not html:
        return ""
    return nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer",
    )
