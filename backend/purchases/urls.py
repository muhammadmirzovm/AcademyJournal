from django.urls import path
from .views import RewardPurchaseView, MyPurchasesView

urlpatterns = [
    path('rewards/<int:reward_id>/purchase/', RewardPurchaseView.as_view(), name='reward_purchase'),
    path('purchases/mine/',                   MyPurchasesView.as_view(),    name='my_purchases'),
]
