from django.utils import timezone
from datetime import timedelta


class UpdateLastSeenMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.user.is_authenticated:
            now = timezone.now()
            last = request.user.last_seen
            if last is None or (now - last) > timedelta(seconds=60):
                request.user.__class__.objects.filter(pk=request.user.pk).update(last_seen=now)
        return response
