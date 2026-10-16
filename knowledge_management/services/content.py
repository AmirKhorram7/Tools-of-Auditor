"""Turn page JSON into plain text, wikilinks, and Markdown.

The editor stores one JSON document (a tree of blocks). This module does not
care which editor produced it. It reads `type`, `text`, `content`, and
`attrs`.
"""

import json
import re

WIKILINK_RE = re.compile(r"\[\[([^\]\n]{1,200})\]\]")
SCHEMA_VERSION = 1

COURSE_TEMPLATE = {
    "type": "doc",
    "content": [
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Goal"}]},
        {"type": "paragraph", "content": []},
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Key facts"}]},
        {"type": "paragraph", "content": []},
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Questions"}]},
        {"type": "paragraph", "content": []},
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Summary"}]},
        {"type": "paragraph", "content": []},
    ],
}


def document_size(content) -> int:
    return len(json.dumps(content, ensure_ascii=False).encode("utf-8"))


def _walk(node, texts: list[str], ids: set[int], titles: list[str]):
    if isinstance(node, list):
        for item in node:
            _walk(item, texts, ids, titles)
        return
    if not isinstance(node, dict):
        return
    kind = node.get("type")
    if kind == "text" and node.get("text"):
        texts.append(str(node["text"]))
        for match in WIKILINK_RE.findall(str(node["text"])):
            token = match.strip()
            if token.isdigit():
                ids.add(int(token))
            elif token:
                titles.append(token)
    if kind == "wikilink":
        attrs = node.get("attrs") or {}
        raw_id = attrs.get("id", attrs.get("nodeId"))
        if raw_id is not None and str(raw_id).isdigit():
            ids.add(int(raw_id))
        label = attrs.get("title") or attrs.get("label")
        if label and raw_id is None:
            titles.append(str(label).strip())
    for child in node.get("content") or []:
        _walk(child, texts, ids, titles)


def extract(content) -> tuple[str, set[int], list[str]]:
    texts: list[str] = []
    ids: set[int] = set()
    titles: list[str] = []
    _walk(content, texts, ids, titles)
    return " ".join(part.strip() for part in texts if part and part.strip()), ids, titles


def _inline(nodes, titles_by_id: dict[int, str]) -> str:
    parts = []
    for node in nodes or []:
        if not isinstance(node, dict):
            continue
        kind = node.get("type")
        if kind == "text":
            parts.append(node.get("text") or "")
        elif kind == "hardBreak":
            parts.append("\n")
        elif kind == "wikilink":
            attrs = node.get("attrs") or {}
            raw_id = attrs.get("id", attrs.get("nodeId"))
            label = attrs.get("title") or attrs.get("label")
            if raw_id is not None and str(raw_id).isdigit():
                label = titles_by_id.get(int(raw_id), label or raw_id)
            parts.append(f"[[{label or ''}]]")
        else:
            parts.append(_inline(node.get("content"), titles_by_id))
    return "".join(parts)


def to_markdown(content, titles_by_id: dict[int, str] | None = None) -> str:
    """Blocks the exporter knows. Unknown blocks contribute their text only."""
    titles_by_id = titles_by_id or {}
    blocks = content.get("content") if isinstance(content, dict) else content
    return _blocks(blocks or [], titles_by_id).strip() + "\n"


def _blocks(blocks, titles_by_id, numbered=False) -> str:
    lines = []
    for index, node in enumerate(blocks, start=1):
        if not isinstance(node, dict):
            continue
        kind = node.get("type")
        inner = node.get("content") or []
        if kind == "heading":
            level = int((node.get("attrs") or {}).get("level") or 1)
            level = min(max(level, 1), 6)
            lines.append(f"{'#' * level} {_inline(inner, titles_by_id).strip()}\n")
        elif kind == "paragraph":
            lines.append(_inline(inner, titles_by_id).strip() + "\n")
        elif kind == "blockquote":
            body = _blocks(inner, titles_by_id).strip()
            lines.append("\n".join(f"> {row}" if row else ">" for row in body.splitlines()) + "\n")
        elif kind == "codeBlock":
            lines.append("```\n" + _inline(inner, titles_by_id) + "\n```\n")
        elif kind in ("bulletList", "orderedList"):
            lines.append(_blocks(inner, titles_by_id, numbered=kind == "orderedList"))
        elif kind == "listItem":
            mark = f"{index}." if numbered else "-"
            text = _blocks(inner, titles_by_id).strip().replace("\n", "\n  ")
            lines.append(f"{mark} {text}\n")
        else:
            text = _inline(inner, titles_by_id).strip()
            if text:
                lines.append(text + "\n")
    return "\n".join(lines)
