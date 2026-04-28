from urllib.parse import parse_qs
from django.contrib.auth.models import AnonymousUser
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class JWTAuthMiddleware(BaseMiddleware):
    """
    Reads ?token=<jwt> from the WebSocket query string and sets scope['user'].
    """
    async def __call__(self, scope, receive, send):
        qs     = scope.get('query_string', b'').decode()
        params = parse_qs(qs)
        tokens = params.get('token', [])

        scope['user'] = AnonymousUser()
        if tokens:
            try:
                validated = AccessToken(tokens[0])
                scope['user'] = await self._get_user(int(validated['user_id']))
            except (InvalidToken, TokenError, Exception):
                pass

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def _get_user(self, user_id):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return AnonymousUser()
