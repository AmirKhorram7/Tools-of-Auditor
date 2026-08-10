from django.conf import settings

# Backwards-compatible names used by OTPService / future Shahkar helpers
API_URL_SEND_SMS = getattr(settings, "SMS_IR_API_URL", "https://api.sms.ir/v1/send/verify")
API_TOKEN_SEND_SMS = getattr(settings, "SMS_IR_API_KEY", "")
SMS_TEMPLATE_ID = getattr(settings, "SMS_IR_TEMPLATE_ID", 0)

API_URL_MATCH_INFO = getattr(settings, "SHAHKAR_API_URL", "https://s.api.ir/api/sw1/ShahkarLite")
API_TOKEN_MATCH_INFO = getattr(settings, "SHAHKAR_API_TOKEN", "")
