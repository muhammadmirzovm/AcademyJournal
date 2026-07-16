from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Limits login attempts per IP, independent of other anonymous traffic —
    protects against password brute-forcing."""
    scope = 'login'


class RegisterRateThrottle(AnonRateThrottle):
    """Limits account creation per IP, independent of login attempts."""
    scope = 'register'


class PasswordResetRateThrottle(AnonRateThrottle):
    """Limits password-reset OTP requests per IP — an OTP is sent over
    Telegram on each request, so this also guards against notification spam."""
    scope = 'password_reset'
