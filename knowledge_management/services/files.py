import os

from rest_framework.exceptions import ValidationError

from knowledge_management.models import Attachment

MAX_FILE_BYTES = 8 * 1024 * 1024
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
PDF_TYPES = {"application/pdf"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
PDF_EXT = {".pdf"}


def describe_upload(upload):
    size = getattr(upload, "size", None) or 0
    if size < 1 or size > MAX_FILE_BYTES:
        raise ValidationError({"file": "Upload an image or PDF up to 8 MB."})
    name = os.path.basename(getattr(upload, "name", "") or "file")[:255]
    ext = os.path.splitext(name)[1].lower()
    content_type = (getattr(upload, "content_type", "") or "").split(";")[0].strip().lower()
    if content_type in IMAGE_TYPES or ext in IMAGE_EXT:
        kind = Attachment.Kind.IMAGE
    elif content_type in PDF_TYPES or ext in PDF_EXT:
        kind = Attachment.Kind.PDF
    else:
        raise ValidationError({"file": "Only images and PDF files are accepted."})
    return kind, size, name
