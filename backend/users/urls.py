from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    RegisterView, MeView, ProfileView, UserStatsView,
    OnlineCountView, PlatformStatsView,
    ParentChildrenView, AdminStatsView, UserChildrenView, UserGroupsView,
    ChangePasswordView, ConnectTelegramView,
    PasswordResetRequestView, PasswordResetConfirmView,
    TelegramWebhookView, TeacherLeaderboardView,
    NotificationListView, NotificationReadView, UserNotifyView,
    CronDailyReportView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('users/online/', OnlineCountView.as_view(), name='online_count'),
    path('users/platform-stats/', PlatformStatsView.as_view(), name='platform_stats'),
    path('users/<int:pk>/', ProfileView.as_view(), name='profile'),
    path('users/<int:pk>/stats/', UserStatsView.as_view(), name='user_stats'),
    path('users/<int:pk>/children/', UserChildrenView.as_view(), name='user_children'),
    path('users/<int:pk>/groups/',   UserGroupsView.as_view(),   name='user_groups'),
    path('my-children/', ParentChildrenView.as_view(), name='my_children'),
    path('link-child/', ParentChildrenView.as_view(), name='link_child'),
    path('admin-stats/',     AdminStatsView.as_view(),    name='admin_stats'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('connect-telegram/', ConnectTelegramView.as_view(), name='connect_telegram'),
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('telegram/webhook/', TelegramWebhookView.as_view(), name='telegram_webhook'),
    path('teacher/leaderboard/', TeacherLeaderboardView.as_view(), name='teacher_leaderboard'),
    path('notifications/', NotificationListView.as_view(), name='notifications'),
    path('notifications/<int:pk>/read/', NotificationReadView.as_view(), name='notification_read'),
    path('users/<int:pk>/notify/',       UserNotifyView.as_view(),       name='user_notify'),
    path('cron/daily-report/',           CronDailyReportView.as_view(),  name='cron_daily_report'),
]
