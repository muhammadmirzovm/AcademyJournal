from django.urls import path
from . import views

urlpatterns = [
    path('tournaments/',                              views.TournamentListCreateView.as_view()),
    path('tournaments/join/',                         views.JoinTournamentView.as_view()),
    path('tournaments/<str:join_code>/',              views.TournamentDetailView.as_view()),
    path('tournaments/<str:join_code>/bracket/',      views.TournamentBracketView.as_view()),
    path('matches/<int:pk>/',                         views.MatchDetailView.as_view()),
    path('matches/<int:pk>/walkover/',                views.MatchWalkoverView.as_view()),
]
