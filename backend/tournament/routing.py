from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/tournament/lobby/(?P<join_code>[A-Z0-9\-]+)/$', consumers.LobbyConsumer.as_asgi()),
    re_path(r'^ws/tournament/match/(?P<match_id>\d+)/$',          consumers.MatchConsumer.as_asgi()),
]
