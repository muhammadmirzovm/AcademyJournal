from django.urls import path
from .views import (
    GroupListCreateView, GroupDetailView, JoinGroupView, GroupMembersView,
    LessonListCreateView, LessonDetailView,
    AttendanceView, ScoreView, JournalView, HomeworkView,
    MembershipDetailView, CoinView, EndLessonView,
    AcademyAnnouncementView, GroupAnnouncementView, AnnouncementDeleteView,
    GroupExamReadyView, ExamListCreateView, ExamDetailView, ExamSubmitView,
)

urlpatterns = [
    path('groups/',                                                             GroupListCreateView.as_view(),  name='group_list'),
    path('groups/<int:pk>/',                                                    GroupDetailView.as_view(),      name='group_detail'),
    path('groups/join/',                                                        JoinGroupView.as_view(),        name='group_join'),
    path('groups/<int:pk>/members/',                                            GroupMembersView.as_view(),     name='group_members'),
    path('groups/<int:pk>/members/<int:member_pk>/',                            MembershipDetailView.as_view(), name='membership_detail'),
    path('groups/<int:pk>/coins/',                                              CoinView.as_view(),             name='group_coins'),
    path('groups/<int:group_pk>/lessons/',                                      LessonListCreateView.as_view(), name='lesson_list'),
    path('groups/<int:group_pk>/lessons/<int:pk>/',                             LessonDetailView.as_view(),     name='lesson_detail'),
    path('groups/<int:group_pk>/lessons/<int:lesson_pk>/attendance/',           AttendanceView.as_view(),       name='attendance'),
    path('groups/<int:group_pk>/lessons/<int:lesson_pk>/scores/',               ScoreView.as_view(),            name='scores'),
    path('groups/<int:group_pk>/lessons/<int:lesson_pk>/journal/',              JournalView.as_view(),          name='journal'),
    path('groups/<int:group_pk>/lessons/<int:lesson_pk>/homework/',             HomeworkView.as_view(),         name='homework'),
    path('groups/<int:group_pk>/lessons/<int:lesson_pk>/end/',                  EndLessonView.as_view(),        name='lesson_end'),
    path('announcements/',                                                       AcademyAnnouncementView.as_view(),  name='academy_announcements'),
    path('announcements/<int:pk>/',                                              AnnouncementDeleteView.as_view(),   name='announcement_delete'),
    path('groups/<int:pk>/announcements/',                                       GroupAnnouncementView.as_view(),    name='group_announcements'),
    path('groups/<int:group_pk>/exam-ready/',                                    GroupExamReadyView.as_view(),       name='group_exam_ready'),
    path('groups/<int:group_pk>/exams/',                                         ExamListCreateView.as_view(),       name='exam_list'),
    path('groups/<int:group_pk>/exams/<int:exam_pk>/',                           ExamDetailView.as_view(),           name='exam_detail'),
    path('groups/<int:group_pk>/exams/<int:exam_pk>/submit/',                    ExamSubmitView.as_view(),           name='exam_submit'),
]
