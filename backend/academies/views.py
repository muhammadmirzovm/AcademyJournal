from django.db import transaction
from rest_framework.exceptions import ValidationError
from groups.access import visible_groups, can_manage_group, managed_students, visible_users
from backend.validation import page_params, integer
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from django.db.models import Q
from datetime import timedelta
from .models import Academy, InviteToken, AcademyTelegramGroup
from .serializers import AcademySerializer, AcademyBrandSerializer, InviteTokenSerializer, AcademyTelegramGroupSerializer


class AcademyCreateView(generics.CreateAPIView):
    serializer_class   = AcademySerializer
    permission_classes = (permissions.IsAuthenticated,)

    @transaction.atomic
    def perform_create(self, serializer):
        if self.request.user.academy_id:
            raise ValidationError({'detail': 'Leave your current academy before creating another.'})
        name = serializer.validated_data['name']
        slug = serializer.validated_data.get('slug') or slugify(name)
        academy = serializer.save(created_by=self.request.user, slug=slug)
        user = self.request.user
        user.academy = academy
        user.role    = 'admin'
        user.save(update_fields=['academy', 'role'])


class AcademyDetailView(generics.RetrieveUpdateAPIView):
    serializer_class   = AcademySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        academy = self.request.user.academy
        if not academy:
            from rest_framework.exceptions import NotFound
            raise NotFound('You are not part of any academy.')
        return academy

    def update(self, request, *args, **kwargs):
        if request.user.role != 'admin':
            return Response({'detail': 'Only admins can update academy settings.'}, status=403)
        return super().update(request, *args, **kwargs)


class AcademyMembersView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        if user.role not in ('admin', 'teacher') or not user.academy:
            return Response({'detail': 'No access.'}, status=403)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        qs = visible_users(user).filter(academy=user.academy).exclude(pk=user.pk).select_related('academy')

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search) |
                Q(username__icontains=search) | Q(email__icontains=search)
            )

        role_filter = request.query_params.get('role', '').strip()
        if role_filter:
            qs = qs.filter(role=role_filter)

        qs = qs.order_by('first_name', 'last_name', 'username')

        # Build invited_by map for these members
        invites = InviteToken.objects.filter(academy=user.academy).prefetch_related('used_by')
        invited_by = {}
        for inv in invites:
            for used_user in inv.used_by.all():
                if used_user.id not in invited_by:
                    invited_by[used_user.id] = {
                        'username':   inv.created_by.username,
                        'first_name': inv.created_by.first_name,
                        'role':       inv.created_by.role,
                    }

        # If role filter requested without pagination, return flat list (for dropdowns)
        if role_filter and not request.query_params.get('page'):
            data = [{'id': m.id, 'username': m.username, 'first_name': m.first_name,
                     'last_name': m.last_name, 'role': m.role} for m in qs]
            return Response(data)

        page, page_size = page_params(request, 20, 100)
        total     = qs.count()
        pages     = max(1, (total + page_size - 1) // page_size)
        page      = min(page, pages)
        members   = qs[(page - 1) * page_size : page * page_size]

        data = []
        for m in members:
            data.append({
                'id':          m.id,
                'username':    m.username,
                'first_name':  m.first_name,
                'last_name':   m.last_name,
                'email':       m.email,
                'role':        m.role,
                'date_joined': m.date_joined,
                'invited_by':  invited_by.get(m.id),
                'is_active':   m.is_active,
            })

        return Response({'results': data, 'total': total, 'pages': pages, 'page': page})

    @transaction.atomic
    def delete(self, request, member_id):
        user = request.user
        if user.role not in ('admin', 'teacher') or not user.academy:
            return Response({'detail': 'No access.'}, status=403)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        member = get_object_or_404(User.objects.select_for_update(), pk=member_id, academy=user.academy)

        # Teachers can only remove students and parents
        if user.role == 'teacher' and member.role not in ('student', 'parent'):
            return Response({'detail': 'Teachers can only remove students and parents.'}, status=403)

        # Teachers can only manage students they own — either the student is
        # in one of their groups, or the student joined via an invite this
        # teacher created (covers group-less invites too) — and parents of
        # those students. Never another teacher's students.
        if user.role == 'teacher':
            from groups.models import GroupMembership
            # Account removal revokes academy-wide access, not just one
            # enrollment. Shared students/parents require an academy admin.
            from users.models import ParentStudent
            students = User.objects.filter(pk=member.pk) if member.role == 'student' else User.objects.filter(parents__parent=member)
            owned_ids = managed_students(user).values_list('pk', flat=True)
            if students.exclude(pk__in=owned_ids).exists() or GroupMembership.objects.filter(
                student__in=students, group__academy=user.academy,
            ).exclude(group__teacher=user).exists():
                return Response({'detail': 'An academy admin must remove shared students or parents.'}, status=403)
            if member.role == 'student':
                is_own = (
                    GroupMembership.objects.filter(student=member, group__teacher=user).exists()
                    or InviteToken.objects.filter(created_by=user, used_by=member).exists()
                )
                if not is_own:
                    return Response({'detail': 'You can only manage your own students.'}, status=403)
            elif member.role == 'parent':
                from users.models import ParentStudent
                own_students = ParentStudent.objects.filter(parent=member).values_list('student_id', flat=True)
                is_own = (
                    GroupMembership.objects.filter(student_id__in=own_students, group__teacher=user).exists()
                    or InviteToken.objects.filter(created_by=user, used_by_id__in=own_students).exists()
                )
                if not is_own:
                    return Response({'detail': 'You can only manage parents of your own students.'}, status=403)

        # Nobody can remove an admin except another admin
        if member.role == 'admin' and user.role != 'admin':
            return Response({'detail': 'Only admins can remove other admins.'}, status=403)

        if member.pk == user.pk:
            return Response({'detail': 'You cannot remove yourself.'}, status=400)
        from groups.models import Group, GroupMembership
        from users.models import ParentStudent
        if Group.objects.filter(teacher=member, academy=user.academy).exists():
            return Response({'detail': "Reassign this member's groups before removal."}, status=409)
        GroupMembership.objects.filter(student=member, group__academy=user.academy).delete()
        ParentStudent.objects.filter(Q(parent=member) | Q(student=member)).delete()
        # Revoke unused enrollment links so removal cannot be undone by an old invite.
        InviteToken.objects.filter(student=member).delete()
        member.academy = None
        member.save(update_fields=['academy'])
        return Response(status=204)


class InviteCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        user = request.user
        if user.role not in ('admin', 'teacher'):
            return Response({'detail': 'Only admins and teachers can create invites.'}, status=403)

        academy = user.academy
        if not academy:
            return Response({'detail': 'You are not part of an academy.'}, status=400)

        role       = request.data.get('role', 'student')
        group_id   = request.data.get('group')
        student_id = request.data.get('student')
        max_uses   = integer(request.data.get('max_uses', 1), 'max_uses', maximum=10000)
        days_valid = integer(request.data.get('days_valid', 7), 'days_valid', maximum=365)
        note       = request.data.get('note', '').strip()

        # Role hierarchy enforcement
        if user.role == 'teacher' and role not in ('student', 'parent'):
            return Response({'detail': 'Teachers can only invite students and parents.'}, status=403)
        if user.role == 'admin' and role not in ('teacher', 'student', 'parent', 'admin'):
            return Response({'detail': 'Invalid role.'}, status=400)
        if role not in ('teacher', 'student', 'admin', 'parent'):
            return Response({'detail': 'Invalid role.'}, status=400)

        group = None
        if group_id:
            from groups.models import Group
            group = get_object_or_404(visible_groups(user), pk=integer(group_id, 'group'))
            if not can_manage_group(user, group):
                return Response({'detail': 'You can only invite to groups you manage.'}, status=403)
            if group.status != Group.ACTIVE:
                raise ValidationError({'group': 'Group must be active.'})

        student = None
        if student_id and role == 'parent':
            from django.contrib.auth import get_user_model
            User_model = get_user_model()
            student = get_object_or_404(managed_students(user), pk=integer(student_id, 'student'))

        invite = InviteToken.objects.create(
            academy    = academy,
            group      = group,
            student    = student,
            role       = role,
            created_by = user,
            expires_at = timezone.now() + timedelta(days=days_valid),
            max_uses   = max_uses,
            note       = note,
        )
        return Response(InviteTokenSerializer(invite).data, status=201)


class InviteListView(generics.ListAPIView):
    serializer_class   = InviteTokenSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        if user.role not in ('admin', 'teacher') or not user.academy:
            return InviteToken.objects.none()
        qs = InviteToken.objects.filter(academy=user.academy).order_by('-created_at')
        if user.role == 'teacher':
            qs = qs.filter(created_by=user)

        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(note__icontains=search)
                | Q(student__first_name__icontains=search)
                | Q(student__last_name__icontains=search)
                | Q(student__username__icontains=search)
            )
        return qs

    def list(self, request, *args, **kwargs):
        qs        = self.get_queryset()
        page, page_size = page_params(request, 10, 100)
        total     = qs.count()
        pages     = max(1, (total + page_size - 1) // page_size)
        page      = min(page, pages)
        invites   = qs[(page - 1) * page_size : page * page_size]
        data      = self.get_serializer(invites, many=True).data
        return Response({'results': data, 'total': total, 'pages': pages, 'page': page})


class InviteDeleteView(generics.DestroyAPIView):
    serializer_class   = InviteTokenSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        if user.role not in ('admin', 'teacher') or not user.academy:
            return InviteToken.objects.none()
        qs = InviteToken.objects.filter(academy=user.academy)
        if user.role != 'admin':
            qs = qs.filter(created_by=user)
        return qs


class InviteVerifyView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, token):
        invite = get_object_or_404(InviteToken, token=token)
        if not invite.is_valid:
            return Response({'detail': 'This invite link has expired or reached its use limit.'}, status=400)
        academy_data = AcademyBrandSerializer(invite.academy, context={'request': request}).data
        student_name = None
        if invite.student:
            s = invite.student
            student_name = f'{s.first_name} {s.last_name}'.strip() or s.username
        return Response({
            'token':        str(invite.token),
            'role':         invite.role,
            'academy':      academy_data,
            'group_name':   invite.group.name if invite.group else None,
            'student_name': student_name,
            'note':         invite.note,
        })


class InviteAcceptView(APIView):
    """Called after a user registers/logs in via an invite link."""
    permission_classes = (permissions.IsAuthenticated,)

    @transaction.atomic
    def post(self, request, token):
        invite = get_object_or_404(InviteToken.objects.select_for_update(), token=token)
        if not invite.is_valid:
            return Response({'detail': 'This invite link has expired or reached its use limit.'}, status=400)

        from django.contrib.auth import get_user_model
        user = get_user_model().objects.select_for_update().get(pk=request.user.pk)
        if invite.created_by.academy_id != invite.academy_id:
            raise ValidationError({'detail': 'The inviter no longer belongs to this academy.'})
        if invite.group:
            from groups.models import Group
            group = Group.objects.select_for_update().get(pk=invite.group_id)
            if group.academy_id != invite.academy_id or group.status != Group.ACTIVE:
                raise ValidationError({'detail': 'This group is no longer available for enrollment.'})
            if not can_manage_group(invite.created_by, group):
                raise ValidationError({'detail': 'The inviter no longer manages this group.'})
            if group.is_individual and group.memberships.exclude(student=user).exists():
                raise ValidationError({'detail': 'Individual group already has a student.'})
        if invite.student and (invite.student.academy_id != invite.academy_id or invite.student.role != 'student'):
            raise ValidationError({'detail': 'Student no longer belongs to this academy.'})
        if invite.used_by.filter(pk=user.pk).exists():
            return Response({'detail': 'You have already used this invite.'}, status=400)

        if user.academy_id is not None and user.academy_id != invite.academy_id:
            return Response({'detail': 'This account already belongs to a different academy. Log out and use a different account to accept this invite.'}, status=400)
        if user.role != invite.role:
            return Response({'detail': f'This account is already registered as {user.get_role_display()}. Log out and create a separate account to accept this invite.'}, status=400)

        user.academy = invite.academy
        user.role    = invite.role
        user.save(update_fields=['academy', 'role'])

        if invite.group and invite.role == 'student':
            from groups.models import GroupMembership, Attendance
            membership, created = GroupMembership.objects.get_or_create(
                group=invite.group, student=user,
            )
            if created:
                # Only track attendance from the join date onward, so a student
                # who joins late is not marked absent for earlier lessons.
                join_date = membership.joined_at.date()
                for lesson in invite.group.lessons.filter(date__gte=join_date):
                    Attendance.objects.get_or_create(
                        lesson=lesson, student=user, defaults={'present': False}
                    )

        if invite.role == 'parent' and invite.student:
            from users.models import ParentStudent
            ParentStudent.objects.get_or_create(parent=user, student=invite.student)

        invite.use_count += 1
        invite.used_by.add(user)
        invite.save(update_fields=['use_count'])

        from users.serializers import UserSerializer
        return Response({
            'detail':  'Invite accepted.',
            'role':    user.role,
            'academy': invite.academy.name,
            'user':    UserSerializer(user, context={'request': request}).data,
        })


class TelegramGroupListCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role not in ('admin', 'teacher'):
            return Response({'detail': 'Staff only.'}, status=403)
        academy = request.user.academy
        if not academy:
            return Response([], status=200)
        groups = AcademyTelegramGroup.objects.filter(academy=academy)
        return Response(AcademyTelegramGroupSerializer(groups, many=True).data)

    def post(self, request):
        if request.user.role != 'admin':
            return Response({'detail': 'Only admins can add Telegram groups.'}, status=403)
        academy = request.user.academy
        if not academy:
            return Response({'detail': 'No academy found.'}, status=404)
        serializer = AcademyTelegramGroupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(academy=academy)
        return Response(serializer.data, status=201)


class TelegramGroupDeleteView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def delete(self, request, pk):
        if request.user.role != 'admin':
            return Response({'detail': 'Only admins can remove Telegram groups.'}, status=403)
        group = get_object_or_404(AcademyTelegramGroup, pk=pk, academy=request.user.academy)
        group.delete()
        return Response(status=204)
