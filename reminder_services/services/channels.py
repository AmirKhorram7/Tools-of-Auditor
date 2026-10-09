"""Delivery backends. Each returns (ok, detail) and never raises.

SMS uses the same sms.ir Verify API as OTP — a separate reminder template,
not the OTP `Code` template and not the bulk/line-number API.
"""

import logging

import requests
from django.conf import settings
from django.core.mail import send_mail

from reminder_services.models import Channel

log = logging.getLogger("reminder_services")
TIMEOUT = 10
# sms.ir Verify slots. Email / Telegram / WhatsApp keep the full text.
SMS_NAME_MAX = 32
SMS_TITLE_MAX = 70
SMS_PERIOD_MAX = 40
SMS_LINK_MAX = 90
# Provider hard cap only — not a product limit.
TELEGRAM_WHATSAPP_MAX = 4096


def _dry_run() -> bool:
    return getattr(settings, "REMINDER_DRY_RUN", settings.DEBUG)


def _reminder_template_id() -> int:
    try:
        return int(getattr(settings, "SMS_IR_REMINDER_TEMPLATE_ID", 0) or 0)
    except (TypeError, ValueError):
        return 0


def configured() -> dict[str, bool]:
    return {
        Channel.EMAIL: bool(getattr(settings, "EMAIL_HOST", "")) or _dry_run(),
        Channel.SMS: bool(settings.SMS_IR_API_KEY and _reminder_template_id()) or _dry_run(),
        Channel.TELEGRAM: bool(getattr(settings, "TELEGRAM_BOT_TOKEN", "")) or _dry_run(),
        Channel.WHATSAPP: bool(
            getattr(settings, "WHATSAPP_TOKEN", "") and getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
        )
        or _dry_run(),
    }


def _logged(channel: str, to: str, text: str) -> tuple[bool, str]:
    log.info("[reminder dry-run] %s → %s: %s", channel, to, text.replace("\n", " | "))
    return True, "logged"


def _clip(value: str, limit: int) -> str:
    text = " ".join((value or "").split())
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def _trim(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    if limit <= 1:
        return "…"[: max(limit, 0)]
    return text[: limit - 1] + "…"


def clip_message(text: str, limit: int) -> str:
    """Keep a trailing http(s) link when the provider cap would otherwise cut it."""
    text = text or ""
    if len(text) <= limit:
        return text
    stripped = text.rstrip()
    last_nl = stripped.rfind("\n")
    tail = stripped[last_nl + 1 :] if last_nl >= 0 else ""
    if tail.startswith("http://") or tail.startswith("https://"):
        room = limit - len(tail) - 2
        if room < 8:
            return tail[:limit]
        body = stripped[:last_nl].rstrip()
        if len(body) > room:
            body = _trim(body, room)
        return f"{body}\n\n{tail}"
    return _trim(text, limit)


def _sms_link(url: str) -> str:
    text = (url or "").strip()
    if len(text) <= SMS_LINK_MAX:
        return text
    base = (getattr(settings, "SITE_URL", "") or "").rstrip("/")
    return f"{base}/daybook" if base else text[:SMS_LINK_MAX]


def sms_values(*, name: str = "", title: str = "", period: str = "", link: str = "") -> dict[str, str]:
    """Fields for the Verify template. Do not use these on other channels."""
    return {
        "NAME": _clip(name, SMS_NAME_MAX),
        "TITLE": _clip(title, SMS_TITLE_MAX),
        "PERIOD": _clip(period, SMS_PERIOD_MAX),
        "LINK": _sms_link(link),
    }


def send_email(to: str, subject: str, text: str) -> tuple[bool, str]:
    if not getattr(settings, "EMAIL_HOST", ""):
        return _logged("email", to, f"{subject} | {text}") if _dry_run() else (False, "email not configured")
    try:
        send_mail(subject, text, getattr(settings, "DEFAULT_FROM_EMAIL", None), [to], fail_silently=False)
        return True, "sent"
    except Exception as exc:  # noqa: BLE001 - provider errors are recorded, not raised
        return False, str(exc)[:200]


def send_sms(to: str, *, name: str = "", title: str = "", period: str = "", link: str = "") -> tuple[bool, str]:
    """sms.ir Verify. Template variables: NAME, TITLE, PERIOD, LINK."""
    fields = sms_values(name=name, title=title, period=period, link=link)
    summary = f"{fields['NAME']} | {fields['TITLE']} | {fields['PERIOD']} | {fields['LINK']}"
    if _dry_run():
        return _logged("sms", to, summary)
    key = settings.SMS_IR_API_KEY
    template = _reminder_template_id()
    if not (key and template):
        return False, "sms reminder template not configured"
    payload = {
        "mobile": to,
        "templateId": template,
        "parameters": [
            {"name": "NAME", "value": fields["NAME"]},
            {"name": "TITLE", "value": fields["TITLE"]},
            {"name": "PERIOD", "value": fields["PERIOD"]},
            {"name": "LINK", "value": fields["LINK"]},
        ],
    }
    try:
        res = requests.post(
            getattr(settings, "SMS_IR_API_URL", "https://api.sms.ir/v1/send/verify"),
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "x-api-key": key,
            },
            timeout=TIMEOUT,
        )
        body = {}
        try:
            body = res.json() or {}
        except ValueError:
            body = {}
        ok = res.status_code == 200 and body.get("status") == 1
        if not ok:
            log.error("sms.ir reminder rejected http=%s message=%s", res.status_code, body.get("message"))
        return ok, "sent" if ok else f"sms.ir {res.status_code}"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)[:200]


def send_telegram(chat_id: str, text: str) -> tuple[bool, str]:
    body = clip_message(text, TELEGRAM_WHATSAPP_MAX)
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", "")
    if not token:
        return _logged("telegram", chat_id, body) if _dry_run() else (False, "telegram not configured")
    try:
        res = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": body, "disable_web_page_preview": True},
            timeout=TIMEOUT,
        )
        ok = res.status_code == 200 and (res.json() or {}).get("ok") is True
        return ok, "sent" if ok else f"telegram {res.status_code}"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)[:200]


def send_whatsapp(number: str, text: str) -> tuple[bool, str]:
    body = clip_message(text, TELEGRAM_WHATSAPP_MAX)
    token = getattr(settings, "WHATSAPP_TOKEN", "")
    phone_id = getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
    if not (token and phone_id):
        return _logged("whatsapp", number, body) if _dry_run() else (False, "whatsapp not configured")
    try:
        res = requests.post(
            f"https://graph.facebook.com/v20.0/{phone_id}/messages",
            json={"messaging_product": "whatsapp", "to": number, "type": "text", "text": {"body": body}},
            headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT,
        )
        ok = res.status_code == 200
        return ok, "sent" if ok else f"whatsapp {res.status_code}"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)[:200]
