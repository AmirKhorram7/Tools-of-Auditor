import logging
import random

import requests
from django.conf import settings
from django.core.cache import cache
from django.utils.translation import gettext_lazy as _
from rest_framework import status

from user_management.constants import (
    API_TOKEN_SEND_SMS,
    API_URL_SEND_SMS,
    SMS_TEMPLATE_ID,
)

logger = logging.getLogger(__name__)


class OTPService:
    PREFIX = "otp:"
    LOCK_PREFIX = "otp_lock:"
    ATTEMPT_PREFIX = "otp_attempts:"

    OTP_TTL = 120
    LOCK_TTL = 60
    ATTEMPT_TTL = 300
    MAX_ATTEMPTS = 5

    @staticmethod
    def generate_code():
        return f"{random.randint(100000, 999999)}"

    @classmethod
    def _key(cls, phone):
        return f"{cls.PREFIX}{phone}"

    @classmethod
    def _lock_key(cls, phone):
        return f"{cls.LOCK_PREFIX}{phone}"

    @classmethod
    def _attempt_key(cls, phone):
        return f"{cls.ATTEMPT_PREFIX}{phone}"

    @classmethod
    def send_sms(cls, phone, code):
        """
        sms.ir Verify API.
        Docs: POST /v1/send/verify with x-api-key header.
        Success body: {"status": 1, ...}
        """
        if not API_TOKEN_SEND_SMS or not SMS_TEMPLATE_ID:
            raise RuntimeError("SMS_IR_API_KEY / SMS_IR_TEMPLATE_ID is not configured.")

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-api-key": API_TOKEN_SEND_SMS,
        }
        payload = {
            "mobile": phone,
            "templateId": int(SMS_TEMPLATE_ID),
            # Parameter name must match the SMS.ir template variable (usually Code).
            "parameters": [{"name": "Code", "value": str(code)}],
        }
        return requests.post(API_URL_SEND_SMS, json=payload, headers=headers, timeout=15)

    @classmethod
    def _sms_succeeded(cls, response):
        if response.status_code != status.HTTP_200_OK:
            return False
        try:
            body = response.json()
        except ValueError:
            return False
        # sms.ir uses status=1 for success.
        return body.get("status") == 1

    @classmethod
    def send_otp(cls, phone):
        lock_key = cls._lock_key(phone)
        if cache.get(lock_key):
            return status.HTTP_429_TOO_MANY_REQUESTS, _("Too many requests. Wait a moment.")

        if not settings.OTP_DEBUG_MODE and (not API_TOKEN_SEND_SMS or not SMS_TEMPLATE_ID):
            logger.error("OTP SMS requested but SMS_IR credentials are missing.")
            return (
                status.HTTP_503_SERVICE_UNAVAILABLE,
                _("SMS service is not configured. Contact support."),
            )

        code = cls.generate_code()
        cache.set(cls._key(phone), code, timeout=cls.OTP_TTL)
        cache.set(lock_key, 1, timeout=cls.LOCK_TTL)

        if settings.OTP_DEBUG_MODE:
            # Local-only fallback. Never used when OTP_DEBUG_MODE=False.
            print(f"[OTP_DEBUG] phone={phone} code={code}", flush=True)
            logger.info("OTP_DEBUG_MODE: code generated for %s", phone)
            return status.HTTP_200_OK, _("OTP sent successfully.")

        try:
            response = cls.send_sms(phone, code)
        except requests.RequestException as exc:
            cache.delete(cls._key(phone))
            cache.delete(lock_key)
            logger.exception("SMS.ir request failed for %s: %s", phone, exc)
            return status.HTTP_503_SERVICE_UNAVAILABLE, _("Failed to send OTP. Try again later.")
        except RuntimeError as exc:
            cache.delete(cls._key(phone))
            cache.delete(lock_key)
            logger.error("%s", exc)
            return status.HTTP_503_SERVICE_UNAVAILABLE, _("Failed to send OTP. Try again later.")

        if not cls._sms_succeeded(response):
            cache.delete(cls._key(phone))
            cache.delete(lock_key)
            logger.error(
                "SMS.ir rejected OTP for %s: http=%s body=%s",
                phone,
                response.status_code,
                response.text[:500],
            )
            return status.HTTP_502_BAD_GATEWAY, _("Failed to send OTP. Try again later.")

        logger.info("OTP SMS sent successfully to %s", phone)
        return status.HTTP_200_OK, _("OTP sent successfully.")

    @classmethod
    def verify_otp(cls, phone, code):
        stored = cache.get(cls._key(phone))
        if not stored:
            return False, _("OTP expired")

        stored_code = stored.decode() if isinstance(stored, bytes) else str(stored)
        if stored_code != code:
            attempts_key = cls._attempt_key(phone)
            try:
                attempts = cache.incr(attempts_key)
            except ValueError:
                cache.set(attempts_key, 1, timeout=cls.ATTEMPT_TTL)
                attempts = 1

            if attempts > cls.MAX_ATTEMPTS:
                cache.delete(cls._key(phone))
                return False, _("Too many attempts")

            return False, _("Invalid OTP")

        cache.delete(cls._key(phone))
        cache.delete(cls._attempt_key(phone))
        return True, _("Verified")
