from django.urls import path
from .views import CoinReportView, MyBalanceView, CoinAdjustView

urlpatterns = [
    path('coins/balance/', MyBalanceView.as_view(), name='my_balance'),
    path('coins/report/', CoinReportView.as_view(), name='coin_report'),
    path('coins/adjust/', CoinAdjustView.as_view(), name='coin_adjust'),
]
