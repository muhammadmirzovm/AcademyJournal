from django.urls import path
from .views import MyBalanceView

urlpatterns = [
    path('coins/balance/', MyBalanceView.as_view(), name='my_balance'),
]
