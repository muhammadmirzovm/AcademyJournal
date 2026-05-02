from django.urls import path
from .views import (
    TopicListCreateView, TopicDetailView,
    QuestionListCreateView, QuestionDetailView,
    QuestionBankListView,
    GameListCreateView, GameDetailView, GameStartView,
    GamePickView, GameAnswerView, GameFinishView, GameResetView,
)

urlpatterns = [
    path('quiz/topics/',                                       TopicListCreateView.as_view()),
    path('quiz/topics/<int:pk>/',                              TopicDetailView.as_view()),
    path('quiz/questions/',                                    QuestionListCreateView.as_view()),
    path('quiz/questions/<int:pk>/',                           QuestionDetailView.as_view()),
    path('quiz/question-banks/',                               QuestionBankListView.as_view()),
    path('groups/<int:group_pk>/games/',                       GameListCreateView.as_view()),
    path('groups/<int:group_pk>/games/<int:game_pk>/',         GameDetailView.as_view()),
    path('groups/<int:group_pk>/games/<int:game_pk>/start/',   GameStartView.as_view()),
    path('groups/<int:group_pk>/games/<int:game_pk>/pick/',    GamePickView.as_view()),
    path('groups/<int:group_pk>/games/<int:game_pk>/answer/',  GameAnswerView.as_view()),
    path('groups/<int:group_pk>/games/<int:game_pk>/finish/',  GameFinishView.as_view()),
    path('groups/<int:group_pk>/games/<int:game_pk>/reset/',   GameResetView.as_view()),
]
