from django.http import JsonResponse


def health(request):
    """Liveness probe for Docker/nginx. Deliberately does not touch the DB."""
    return JsonResponse({"status": "ok"})
