from django.urls import path
from .views import LessonGameView, GameStartView, GameCancelView, GameCloseView, GroupGameHistoryView

urlpatterns = [
    path('groups/<int:group_pk>/lessons/<int:lesson_pk>/game/',        LessonGameView.as_view(),      name='lesson_game'),
    path('groups/<int:group_pk>/lessons/<int:lesson_pk>/game/start/',  GameStartView.as_view(),       name='lesson_game_start'),
    path('groups/<int:group_pk>/lessons/<int:lesson_pk>/game/cancel/', GameCancelView.as_view(),      name='lesson_game_cancel'),
    path('groups/<int:group_pk>/lessons/<int:lesson_pk>/game/close/',  GameCloseView.as_view(),       name='lesson_game_close'),
    path('groups/<int:group_pk>/game-history/',                       GroupGameHistoryView.as_view(), name='group_game_history'),
]
