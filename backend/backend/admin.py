from django.contrib.admin import AdminSite
from django.contrib.admin.apps import AdminConfig


class PlatformAdminSite(AdminSite):
    """Raw model administration is reserved for platform operators.

    Academy staff use the academy-scoped application API. Django's built-in
    model permissions do not provide tenant isolation, particularly for user,
    permission, audit-log and related-object administration.
    """
    def has_permission(self, request):
        return super().has_permission(request) and request.user.is_superuser


class PlatformAdminConfig(AdminConfig):
    default_site = 'backend.admin.PlatformAdminSite'
