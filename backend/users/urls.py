from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView, MeView, ProfileView, UserStatsView, OnlineCountView, PlatformStatsView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('users/online/', OnlineCountView.as_view(), name='online_count'),
    path('users/platform-stats/', PlatformStatsView.as_view(), name='platform_stats'),
    path('users/<int:pk>/', ProfileView.as_view(), name='profile'),
    path('users/<int:pk>/stats/', UserStatsView.as_view(), name='user_stats'),
]
