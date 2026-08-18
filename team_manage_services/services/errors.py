from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError


def call_service(fn, **kwargs):
    try:
        return fn(**kwargs)
    except DjangoValidationError as exc:
        if hasattr(exc, "message_dict") and exc.message_dict:
            raise DRFValidationError(exc.message_dict) from exc
        raise DRFValidationError(exc.messages) from exc
