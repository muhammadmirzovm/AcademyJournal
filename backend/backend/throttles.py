from rest_framework.throttling import SimpleRateThrottle


class IPRateThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        # These are credential-sensitive endpoints even when the caller sends
        # an unrelated valid JWT. Authentication must not bypass their limit.
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class LoginRateThrottle(IPRateThrottle):
    """Limits login attempts per IP, independent of other anonymous traffic —
    protects against password brute-forcing."""
    scope = 'login'


class RegisterRateThrottle(IPRateThrottle):
    """Limits account creation per IP, independent of login attempts."""
    scope = 'register'


class PasswordResetRateThrottle(IPRateThrottle):
    """Limits password-reset OTP requests per IP — an OTP is sent over
    Telegram on each request, so this also guards against notification spam."""
    scope = 'password_reset'
