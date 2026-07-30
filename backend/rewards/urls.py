from django.urls import path
from .views import RewardListCreateView, RewardDetailView

urlpatterns = [
    path('rewards/', RewardListCreateView.as_view(), name='reward_list'),
    path('rewards/<int:pk>/', RewardDetailView.as_view(), name='reward_detail'),
]
