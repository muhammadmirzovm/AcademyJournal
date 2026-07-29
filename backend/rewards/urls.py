from django.urls import path
from .views import RewardListCreateView

urlpatterns = [
    path('rewards/', RewardListCreateView.as_view(), name='reward_list'),
]
