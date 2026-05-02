from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from datetime import timedelta
from .models import Academy, InviteToken
from .serializers import AcademySerializer, AcademyBrandSerializer, InviteTokenSerializer


class AcademyCreateView(generics.CreateAPIView):
    serializer_class   = AcademySerializer
    permission_classes = (permissions.IsAuthenticated,)

    def perform_create(self, serializer):
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
        max_uses   = int(request.data.get('max_uses', 1))
        days_valid = int(request.data.get('days_valid', 7))
        note       = request.data.get('note', '').strip()

        if role not in ('teacher', 'student', 'admin', 'parent'):
            return Response({'detail': 'Invalid role.'}, status=400)

        group = None
        if group_id:
            from groups.models import Group
            group = get_object_or_404(Group, pk=group_id)

        invite = InviteToken.objects.create(
            academy    = academy,
            group      = group,
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
        return InviteToken.objects.filter(academy=user.academy).order_by('-created_at')


class InviteVerifyView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, token):
        invite = get_object_or_404(InviteToken, token=token)
        if not invite.is_valid:
            return Response({'detail': 'This invite link has expired or reached its use limit.'}, status=400)
        academy_data = AcademyBrandSerializer(invite.academy, context={'request': request}).data
        return Response({
            'token':      str(invite.token),
            'role':       invite.role,
            'academy':    academy_data,
            'group_name': invite.group.name if invite.group else None,
            'note':       invite.note,
        })


class InviteAcceptView(APIView):
    """Called after a user registers/logs in via an invite link."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, token):
        invite = get_object_or_404(InviteToken, token=token)
        if not invite.is_valid:
            return Response({'detail': 'This invite link has expired or reached its use limit.'}, status=400)

        user = request.user
        if invite.used_by.filter(pk=user.pk).exists():
            return Response({'detail': 'You have already used this invite.'}, status=400)

        user.academy = invite.academy
        user.role    = invite.role
        user.save(update_fields=['academy', 'role'])

        if invite.group and invite.role == 'student':
            from groups.models import GroupMembership, Attendance
            membership, created = GroupMembership.objects.get_or_create(
                group=invite.group, student=user,
            )
            if created:
                for lesson in invite.group.lessons.all():
                    Attendance.objects.get_or_create(
                        lesson=lesson, student=user, defaults={'present': False}
                    )

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
