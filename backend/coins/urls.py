from django.urls import path
from .views import CoinReportView, MyBalanceView, CoinAdjustView, CoinSettingView

urlpatterns = [
    path('coins/balance/', MyBalanceView.as_view(), name='my_balance'),
    path('coins/report/', CoinReportView.as_view(), name='coin_report'),
    path('coins/adjust/', CoinAdjustView.as_view(), name='coin_adjust'),
    path('coins/settings/', CoinSettingView.as_view(), name='coin_settings'),
]
