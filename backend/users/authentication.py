from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.utils import get_md5_hash_password


class SessionTokenRefreshSerializer(TokenRefreshSerializer):
    """Reject refreshes after account deletion, deactivation or password reset."""
    def validate(self, attrs):
        token = self.token_class(attrs['refresh'])
        user = get_user_model().objects.filter(
            **{api_settings.USER_ID_FIELD: token.get(api_settings.USER_ID_CLAIM)}
        ).first()
        if not user or not user.is_active:
            raise AuthenticationFailed('Session is no longer valid.')
        if api_settings.CHECK_REVOKE_TOKEN and token.get(api_settings.REVOKE_TOKEN_CLAIM) != get_md5_hash_password(user.password):
            raise AuthenticationFailed('Password changed. Please sign in again.')
        return super().validate(attrs)
