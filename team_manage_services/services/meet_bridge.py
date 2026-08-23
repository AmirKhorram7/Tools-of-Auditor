"""Google Meet URL helper. Isolated — no Calendar OAuth, no extra keys."""

from urllib.parse import urlparse

from django.core.exceptions import ValidationError

MEET_NEW_URL = "https://meet.google.com/new"
MEET_HOSTS = {"meet.google.com"}


def normalize_meet_url(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        raise ValidationError({"meet_url": "Paste the Google Meet link."})

    if "://" not in value:
        code = value.strip().strip("/")
        if _looks_like_code(code):
            return f"https://meet.google.com/{code}"
        raise ValidationError({"meet_url": "Use a Google Meet link."})

    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if host not in MEET_HOSTS:
        raise ValidationError({"meet_url": "Only Google Meet links are allowed."})
    path = (parsed.path or "").strip("/")
    if not path or path == "new":
        raise ValidationError(
            {"meet_url": "Open Google Meet, start the room, then paste that link."}
        )
    if not _looks_like_code(path.split("/")[0]):
        raise ValidationError({"meet_url": "That does not look like a Meet room link."})
    return f"https://meet.google.com/{path.split('/')[0]}"


def _looks_like_code(value: str) -> bool:
    cleaned = value.replace("-", "")
    return 8 <= len(cleaned) <= 16 and cleaned.isalnum()
