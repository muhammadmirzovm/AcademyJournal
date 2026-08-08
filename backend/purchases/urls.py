from django.urls import path
from .views import RewardPurchaseView, MyPurchasesView, PurchaseLookupView, PurchaseIssueView

urlpatterns = [
    path('rewards/<int:reward_id>/purchase/', RewardPurchaseView.as_view(), name='reward_purchase'),
    path('purchases/mine/',                   MyPurchasesView.as_view(),    name='my_purchases'),
    path('purchases/lookup/<str:code>/',      PurchaseLookupView.as_view(), name='purchase_lookup'),
    path('purchases/<int:pk>/issue/',         PurchaseIssueView.as_view(),  name='purchase_issue'),
]
