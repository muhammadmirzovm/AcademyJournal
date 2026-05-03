from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from .serializers import RegisterSerializer, UserSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        }, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(UserSerializer(request.user, context={'request': request}).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ProfileView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        target = super().get_object()
        viewer = self.request.user
        # Admin/teacher profiles are private — only admins, teachers, or the owner can view
        if target.role in ('admin', 'teacher') and viewer.role not in ('admin', 'teacher') and viewer.pk != target.pk:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You do not have permission to view this profile.')
        return target


class UserStatsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        from django.db.models import Avg, Count
        from groups.models import Score, Attendance, Group, GroupMembership, Lesson

        if user.role == 'teacher':
            groups = Group.objects.filter(teacher=user).prefetch_related('memberships', 'lessons')

            total_groups   = groups.count()
            total_lessons  = Lesson.objects.filter(group__teacher=user).count()
            total_students = (
                GroupMembership.objects.filter(group__teacher=user)
                .values('student').distinct().count()
            )
            avg_score_val = (
                Score.objects.filter(lesson__group__teacher=user)
                .aggregate(avg=Avg('value'))['avg']
            )

            scores_by_group   = []
            students_by_group = []
            for g in groups:
                avg = (
                    Score.objects.filter(lesson__group=g)
                    .aggregate(avg=Avg('value'))['avg']
                )
                scores_by_group.append({
                    'group': g.name,
                    'avg_score': round(avg, 2) if avg else 0,
                })
                students_by_group.append({
                    'group': g.name,
                    'students': g.memberships.count(),
                })

            return Response({
                'role': 'teacher',
                'total_students': total_students,
                'total_groups':   total_groups,
                'total_lessons':  total_lessons,
                'avg_score':      round(avg_score_val, 2) if avg_score_val else 0,
                'scores_by_group':   scores_by_group,
                'students_by_group': students_by_group,
            })

        # ── Student stats ─────────────────────────────────────────────────────
        scores = (
            Score.objects.filter(student=user)
            .select_related('lesson')
            .order_by('lesson__date')
        )
        score_trend = [
            {'lesson': s.lesson.title, 'date': str(s.lesson.date), 'score': s.value}
            for s in scores
        ]
        total   = Attendance.objects.filter(student=user).count()
        present = Attendance.objects.filter(student=user, present=True).count()

        from groups.models import GroupMembership
        from django.db.models import Sum
        total_stickers = (
            GroupMembership.objects.filter(student=user)
            .aggregate(total=Sum('sticker_count'))['total'] or 0
        )

        return Response({
            'role': 'student',
            'total_stickers': total_stickers,
            'score_trend': score_trend,
            'attendance_summary': {
                'present': present,
                'absent':  total - present,
                'total':   total,
            }
        })


class ParentChildrenView(APIView):
    """GET  — parent sees their linked children.
       POST — admin/teacher links an existing parent to an existing student."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != 'parent':
            return Response({'detail': 'Only parents can access this.'}, status=403)
        from .models import ParentStudent
        links = ParentStudent.objects.filter(parent=request.user).select_related('student')
        children = []
        for link in links:
            s = link.student
            full = f'{s.first_name} {s.last_name}'.strip()
            children.append({
                'id':         s.id,
                'username':   s.username,
                'first_name': s.first_name,
                'last_name':  s.last_name,
                'display_name': full or s.username,
            })
        return Response(children)

    def post(self, request):
        user = request.user
        if user.role not in ('admin', 'teacher'):
            return Response({'detail': 'Only admins and teachers can link children.'}, status=403)
        if not user.academy:
            return Response({'detail': 'No academy.'}, status=400)

        parent_id  = request.data.get('parent')
        student_id = request.data.get('student')
        if not parent_id or not student_id:
            return Response({'detail': 'parent and student are required.'}, status=400)

        from .models import ParentStudent
        from django.contrib.auth import get_user_model
        U = get_user_model()
        parent  = get_object_or_404(U, pk=parent_id,  academy=user.academy, role='parent')
        student = get_object_or_404(U, pk=student_id, academy=user.academy, role='student')
        _, created = ParentStudent.objects.get_or_create(parent=parent, student=student)
        return Response({'detail': 'Linked.' if created else 'Already linked.'}, status=201 if created else 200)

    def delete(self, request):
        user = request.user
        if user.role not in ('admin', 'teacher'):
            return Response({'detail': 'Only admins and teachers can unlink children.'}, status=403)
        if not user.academy:
            return Response({'detail': 'No academy.'}, status=400)

        parent_id  = request.data.get('parent')
        student_id = request.data.get('student')
        if not parent_id or not student_id:
            return Response({'detail': 'parent and student are required.'}, status=400)

        from .models import ParentStudent
        deleted, _ = ParentStudent.objects.filter(
            parent_id=parent_id, student_id=student_id,
            parent__academy=user.academy,
        ).delete()
        if deleted:
            return Response(status=204)
        return Response({'detail': 'Link not found.'}, status=404)


class OnlineCountView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        cutoff = timezone.now() - timedelta(minutes=5)
        count  = User.objects.filter(last_seen__gte=cutoff).count()
        return Response({'online': count})


class PlatformStatsView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        from groups.models import Group, Lesson
        return Response({
            'total_users':    User.objects.count(),
            'total_teachers': User.objects.filter(role='teacher').count(),
            'total_students': User.objects.filter(role='student').count(),
            'total_groups':   Group.objects.count(),
            'total_lessons':  Lesson.objects.count(),
        })
