"""Shared authorization for groups and their nested resources."""
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from .models import Group


def visible_groups(user):
    if not user.is_authenticated:
        return Group.objects.none()
    groups = Group.objects.filter(academy_id=user.academy_id)
    if user.role == 'admin':
        return groups if user.academy_id else groups.none()
    if user.role == 'teacher':
        return groups.filter(teacher=user)
    if user.role == 'student':
        return groups.filter(memberships__student=user).distinct()
    if user.role == 'parent' and user.academy_id:
        return groups.filter(
            memberships__student__parents__parent=user,
            memberships__student__academy_id=user.academy_id,
        ).distinct()
    return groups.none()


def can_manage_group(user, group):
    if not user.is_authenticated or user.academy_id != group.academy_id:
        return False
    return (user.role in ('teacher', 'admin') and group.teacher_id == user.pk) or (
        user.role == 'admin' and user.academy_id is not None
    )


class GroupAccessMixin:
    """Resolve the URL's group before dispatching any nested operation."""
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        group_id = kwargs.get('group_pk', kwargs.get('pk'))
        self.access_group = get_object_or_404(visible_groups(request.user), pk=group_id)
        if request.method not in ('GET', 'HEAD', 'OPTIONS') and not can_manage_group(request.user, self.access_group):
            if not (getattr(self, 'student_submission', False) and request.user.role == 'student'):
                raise PermissionDenied('Only the assigned teacher or academy admin can change this group.')


def managed_students(user):
    from django.contrib.auth import get_user_model
    students = get_user_model().objects.filter(role='student', academy_id=user.academy_id)
    if not user.academy_id:
        return students.none()
    if user.role == 'admin':
        return students
    if user.role == 'teacher':
        return students.filter(
            Q(memberships__group__teacher=user, memberships__group__academy_id=user.academy_id)
            | Q(used_invites__created_by=user, used_invites__academy_id=user.academy_id)
        ).distinct()
    return students.none()


def visible_users(user):
    from django.contrib.auth import get_user_model
    users = get_user_model().objects.all()
    own = Q(pk=user.pk)
    if user.role == 'admin' and user.academy_id:
        return users.filter(own | Q(academy_id=user.academy_id))
    if user.role == 'teacher' and user.academy_id:
        return users.filter(own | Q(pk__in=managed_students(user)) | Q(
            role='parent', academy_id=user.academy_id, children__student__in=managed_students(user)
        )).distinct()
    if user.role == 'parent' and user.academy_id:
        return users.filter(own | Q(role='student', academy_id=user.academy_id, parents__parent=user)).distinct()
    if user.role == 'student':
        return users.filter(own | Q(role='student', academy_id=user.academy_id,
                                   memberships__group__in=visible_groups(user))).distinct()
    return users.filter(own)
