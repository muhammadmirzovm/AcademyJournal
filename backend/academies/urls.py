from django.urls import path
from .views import (
    AcademyCreateView, AcademyDetailView,
    InviteCreateView, InviteListView,
    InviteVerifyView, InviteAcceptView,
)

urlpatterns = [
    path('academy/', AcademyDetailView.as_view(), name='academy_detail'),
    path('academy/create/', AcademyCreateView.as_view(), name='academy_create'),
    path('invites/', InviteListView.as_view(), name='invite_list'),
    path('invites/create/', InviteCreateView.as_view(), name='invite_create'),
    path('invites/<uuid:token>/verify/', InviteVerifyView.as_view(), name='invite_verify'),
    path('invites/<uuid:token>/accept/', InviteAcceptView.as_view(), name='invite_accept'),
]
