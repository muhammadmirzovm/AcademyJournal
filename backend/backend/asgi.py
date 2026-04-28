import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

from django.core.asgi import get_asgi_application

django_asgi = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
import tournament.routing
from tournament.middleware import JWTAuthMiddleware

application = ProtocolTypeRouter({
    'http': django_asgi,
    'websocket': JWTAuthMiddleware(
        URLRouter(tournament.routing.websocket_urlpatterns)
    ),
})
