"""Allowlist HTML sanitiser for note bodies (stdlib only)."""

import re
from html import escape
from html.parser import HTMLParser

ALLOWED_TAGS = {
    "p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "strike",
    "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "a", "code", "pre", "font",
}
VOID_TAGS = {"br"}
DROP_WITH_CONTENT = {"script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math"}
ALLOWED_STYLES = {
    "color", "background-color", "font-family", "font-size", "font-weight",
    "font-style", "text-align", "text-decoration",
}
SAFE_STYLE_VALUE = re.compile(r"^[#\w\s,.%\-\"'()]+$")
SAFE_HREF = re.compile(r"^(https?://|mailto:)", re.IGNORECASE)
MAX_BODY = 50_000


def _clean_style(raw: str) -> str:
    kept = []
    for part in raw.split(";"):
        if ":" not in part:
            continue
        name, value = part.split(":", 1)
        name, value = name.strip().lower(), value.strip()
        lowered = value.lower()
        if name not in ALLOWED_STYLES or not value:
            continue
        if "url(" in lowered or "expression" in lowered or not SAFE_STYLE_VALUE.match(value):
            continue
        kept.append(f"{name}: {value}")
    return "; ".join(kept)


class _Sanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.open: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in DROP_WITH_CONTENT:
            self.skip += 1
            return
        if self.skip or tag not in ALLOWED_TAGS:
            return
        clean = []
        for name, value in attrs:
            value = value or ""
            if name == "style":
                style = _clean_style(value)
                if style:
                    clean.append(("style", style))
            elif name == "dir" and value in {"rtl", "ltr", "auto"}:
                clean.append(("dir", value))
            elif name == "color" and tag == "font" and re.match(r"^#?[0-9A-Fa-f]{3,6}$", value):
                clean.append(("color", value))
            elif name == "href" and tag == "a" and SAFE_HREF.match(value.strip()):
                clean.append(("href", value.strip()))
        if tag == "a":
            clean += [("target", "_blank"), ("rel", "noopener noreferrer")]
        rendered = "".join(f' {name}="{escape(value, quote=True)}"' for name, value in clean)
        self.out.append(f"<{tag}{rendered}>")
        if tag not in VOID_TAGS:
            self.open.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS and self.open and self.open[-1] == tag:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in DROP_WITH_CONTENT:
            self.skip = max(0, self.skip - 1)
            return
        if self.skip or tag not in self.open:
            return
        while self.open:
            current = self.open.pop()
            self.out.append(f"</{current}>")
            if current == tag:
                break

    def handle_data(self, data):
        if not self.skip:
            self.out.append(escape(data, quote=False))

    def result(self) -> str:
        while self.open:
            self.out.append(f"</{self.open.pop()}>")
        return "".join(self.out)


def sanitize_html(raw: str | None) -> str:
    if not raw:
        return ""
    parser = _Sanitizer()
    parser.feed(raw[:MAX_BODY].replace("\x00", ""))
    parser.close()
    return parser.result().strip()


def plain_text(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()
