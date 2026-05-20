from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views import View
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.conf import settings
from datetime import timedelta
import json
import logging
import random
import secrets
from asgiref.sync import async_to_sync
from .serializers import RegisterSerializer, UserSerializer

logger = logging.getLogger(__name__)
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

        from django.db.models import Avg, Count, Sum
        from groups.models import Score, Attendance, Group, GroupMembership, Lesson

        if user.role == 'admin':
            academy = user.academy
            if not academy:
                return Response({'role': 'admin', 'total_students': 0, 'total_teachers': 0, 'total_groups': 0, 'total_lessons': 0})
            total_students = User.objects.filter(academy=academy, role='student').count()
            total_teachers = User.objects.filter(academy=academy, role='teacher').count()
            total_groups   = Group.objects.filter(teacher__academy=academy).count()
            total_lessons  = Lesson.objects.filter(group__teacher__academy=academy).count()
            return Response({
                'role': 'admin',
                'total_students': total_students,
                'total_teachers': total_teachers,
                'total_groups':   total_groups,
                'total_lessons':  total_lessons,
            })

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


class UserGroupsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        viewer = request.user
        if viewer.pk != pk and viewer.role not in ('admin', 'teacher'):
            return Response({'detail': 'No permission.'}, status=403)
        try:
            target = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        from groups.models import Group, GroupMembership
        if target.role == 'student':
            memberships = GroupMembership.objects.filter(student=target).select_related('group', 'group__teacher')
            groups = []
            for m in memberships:
                g = m.group
                teacher_full = f'{g.teacher.first_name} {g.teacher.last_name}'.strip() or g.teacher.username
                groups.append({
                    'id':           g.id,
                    'name':         g.name,
                    'teacher_name': teacher_full,
                    'member_count': g.memberships.count(),
                })
        elif target.role == 'teacher':
            gs = Group.objects.filter(teacher=target)
            groups = [{'id': g.id, 'name': g.name, 'member_count': g.memberships.count()} for g in gs]
        else:
            groups = []
        return Response(groups)


class AdminStatsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        if user.role != 'admin' or not user.academy:
            return Response({'detail': 'Admin only.'}, status=403)

        academy = user.academy
        from groups.models import Group, Lesson, Score, GroupMembership
        from django.db.models import Avg, Sum

        total_students = User.objects.filter(academy=academy, role='student').count()
        total_teachers = User.objects.filter(academy=academy, role='teacher').count()
        total_groups   = Group.objects.filter(teacher__academy=academy).count()
        total_lessons  = Lesson.objects.filter(group__teacher__academy=academy).count()

        # Top groups by avg score (converted to 0-100%)
        groups = Group.objects.filter(teacher__academy=academy)
        group_data = []
        for g in groups:
            avg = Score.objects.filter(lesson__group=g).aggregate(avg=Avg('value'))['avg']
            group_data.append({
                'id':           g.id,
                'name':         g.name,
                'teacher_name': g.teacher.first_name or g.teacher.username,
                'member_count': g.memberships.count(),
                'avg_score':    round(avg * 20, 1) if avg else 0,
            })
        top_groups = sorted(group_data, key=lambda x: x['avg_score'], reverse=True)[:5]

        # Top students by comprehension %
        memberships = GroupMembership.objects.filter(
            group__teacher__academy=academy
        ).select_related('student', 'group')

        student_map = {}
        for m in memberships:
            sid = m.student.id
            if sid not in student_map:
                student_map[sid] = {
                    'id':            sid,
                    'username':      m.student.username,
                    'first_name':    m.student.first_name,
                    'last_name':     m.student.last_name,
                    'total_score':   0,
                    'total_possible': 0,
                    'sticker_count': 0,
                    'group_names':   set(),
                }
            student_map[sid]['sticker_count'] += m.sticker_count
            student_map[sid]['group_names'].add(m.group.name)
            join_date   = m.joined_at.date()
            lessons     = m.group.lessons.filter(date__gte=join_date)
            lesson_count = lessons.count()
            if lesson_count > 0:
                score_sum = Score.objects.filter(
                    lesson__in=lessons, student=m.student
                ).aggregate(total=Sum('value'))['total'] or 0
                student_map[sid]['total_score']    += score_sum
                student_map[sid]['total_possible'] += lesson_count * 5

        top_students = []
        for s in student_map.values():
            comp = round(s['total_score'] / s['total_possible'] * 100) if s['total_possible'] > 0 else 0
            full = f"{s['first_name']} {s['last_name']}".strip()
            top_students.append({
                'id':            s['id'],
                'username':      s['username'],
                'display_name':  full or s['username'],
                'comprehension': comp,
                'sticker_count': s['sticker_count'],
                'groups':        sorted(s['group_names']),
            })
        top_students = sorted(top_students, key=lambda x: (x['comprehension'], x['sticker_count']), reverse=True)[:5]

        return Response({
            'total_students': total_students,
            'total_teachers': total_teachers,
            'total_groups':   total_groups,
            'total_lessons':  total_lessons,
            'top_groups':     top_groups,
            'top_students':   top_students,
        })


class UserChildrenView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        viewer = request.user
        if viewer.pk != pk and viewer.role not in ('admin', 'teacher'):
            return Response({'detail': 'No permission.'}, status=403)
        from .models import ParentStudent
        links = ParentStudent.objects.filter(parent_id=pk).select_related('student')
        children = []
        for link in links:
            s = link.student
            full = f'{s.first_name} {s.last_name}'.strip()
            children.append({
                'id':           s.id,
                'username':     s.username,
                'first_name':   s.first_name,
                'last_name':    s.last_name,
                'display_name': full or s.username,
            })
        return Response(children)


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



class ChangePasswordView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        new_password = request.data.get('new_password', '')
        old_password = request.data.get('old_password', '')

        if len(new_password) < 6:
            return Response({'detail': 'Password must be at least 6 characters.'}, status=400)

        user = request.user
        if user.has_usable_password():
            if not old_password:
                return Response({'detail': 'Current password is required.'}, status=400)
            if not user.check_password(old_password):
                return Response({'detail': 'Current password is incorrect.'}, status=400)

        user.set_password(new_password)
        user.save()
        return Response({'detail': 'Password changed successfully.'})


class ConnectTelegramView(APIView):
    """Generates a one-time deep-link token so a logged-in user can link their Telegram."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        from .models import TelegramConnectToken
        import os

        if request.user.telegram_id:
            return Response({'detail': 'Telegram is already connected.'}, status=400)

        token_str = secrets.token_urlsafe(16)
        TelegramConnectToken.objects.filter(user=request.user).delete()
        TelegramConnectToken.objects.create(user=request.user, token=token_str)

        bot_username = os.environ.get('TELEGRAM_BOT_USERNAME', 'YourAcademyBot')
        deep_link = f'https://t.me/{bot_username}?start={token_str}'
        return Response({'link': deep_link})

    def delete(self, request):
        """Unlink Telegram from account."""
        request.user.telegram_id = None
        request.user.save(update_fields=['telegram_id'])
        return Response({'detail': 'Telegram disconnected.'})


class PasswordResetRequestView(APIView):
    """Step 1 — user enters their username, OTP is sent to their Telegram."""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        from .models import TelegramOTP

        username = request.data.get('username', '').strip()
        if not username:
            return Response({'detail': 'Username is required.'}, status=400)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # Avoid username enumeration — return same response
            return Response({'detail': 'If this account exists and has Telegram connected, an OTP has been sent.'})

        if not user.telegram_id:
            return Response(
                {'detail': 'no_telegram',
                 'message': 'This account has no Telegram connected. Contact your admin to reset your password.'},
                status=400,
            )

        code = f'{random.randint(0, 999999):06d}'
        expires_at = timezone.now() + timedelta(minutes=5)

        # Invalidate any previous unused OTPs
        TelegramOTP.objects.filter(user=user, used=False).delete()
        TelegramOTP.objects.create(user=user, code=code, expires_at=expires_at)

        try:
            from asgiref.sync import async_to_sync
            from .telegram_bot import send_otp
            lang = user.telegram_lang or 'uz'
            async_to_sync(send_otp)(user.telegram_id, code, lang)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f'OTP send failed: {e}')
            return Response({'detail': 'Failed to send OTP. Please try again later.'}, status=500)

        return Response({'detail': 'If this account exists and has Telegram connected, an OTP has been sent.'})


class PasswordResetConfirmView(APIView):
    """Step 2 — user submits username + OTP + new password."""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        from .models import TelegramOTP

        username     = request.data.get('username', '').strip()
        code         = request.data.get('code', '').strip()
        new_password = request.data.get('new_password', '').strip()

        if not username or not code or not new_password:
            return Response({'detail': 'username, code, and new_password are required.'}, status=400)

        if len(new_password) < 6:
            return Response({'detail': 'Password must be at least 6 characters.'}, status=400)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid code or username.'}, status=400)

        otp = TelegramOTP.objects.filter(user=user, code=code, used=False).order_by('-expires_at').first()

        if not otp or not otp.is_valid():
            return Response({'detail': 'Invalid or expired code.'}, status=400)

        otp.used = True
        otp.save(update_fields=['used'])

        user.set_password(new_password)
        user.save()

        return Response({'detail': 'Password reset successfully. You can now log in.'})


class NotificationListView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        from .models import Notification
        notifs = Notification.objects.filter(user=request.user)[:50]
        data = [
            {
                'id':         n.id,
                'type':       n.type,
                'title':      n.title,
                'body':       n.body,
                'is_read':    n.is_read,
                'created_at': n.created_at.isoformat(),
            }
            for n in notifs
        ]
        unread = sum(1 for n in data if not n['is_read'])
        return Response({'results': data, 'unread': unread})

    def post(self, request):
        from .models import Notification
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'detail': 'All marked as read.'})


class NotificationReadView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        from .models import Notification
        Notification.objects.filter(pk=pk, user=request.user).update(is_read=True)
        return Response({'detail': 'Marked as read.'})


class TeacherLeaderboardView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != 'teacher':
            return Response({'detail': 'Forbidden.'}, status=403)

        from groups.models import GroupMembership, Score, Attendance
        from django.db.models import Sum

        memberships = (
            GroupMembership.objects
            .filter(group__teacher=request.user)
            .select_related('student', 'group')
        )

        student_map = {}
        for m in memberships:
            s = m.student
            sid = s.id
            if sid not in student_map:
                student_map[sid] = {
                    'id':            sid,
                    'display_name':  f'{s.first_name} {s.last_name}'.strip() or s.username,
                    'username':      s.username,
                    'groups':        set(),
                    'total_score':   0,
                    'total_possible': 0,
                }
            student_map[sid]['groups'].add(m.group.name)
            join_date    = m.joined_at.date()
            lessons      = m.group.lessons.filter(date__gte=join_date)
            lesson_count = lessons.count()
            if lesson_count > 0:
                score_sum = Score.objects.filter(
                    lesson__in=lessons, student=s
                ).aggregate(total=Sum('value'))['total'] or 0
                student_map[sid]['total_score']    += score_sum
                student_map[sid]['total_possible'] += lesson_count * 5

        results = []
        for sid, data in student_map.items():
            comp = round(data['total_score'] / data['total_possible'] * 100) if data['total_possible'] > 0 else None
            total   = Attendance.objects.filter(student_id=sid, lesson__group__teacher=request.user).count()
            present = Attendance.objects.filter(student_id=sid, lesson__group__teacher=request.user, present=True).count()
            results.append({
                'id':           data['id'],
                'display_name': data['display_name'],
                'username':     data['username'],
                'groups':       sorted(data['groups']),
                'avg_score':    comp,
                'attendance':   round(present / total * 100) if total else None,
            })

        results.sort(key=lambda x: (x['avg_score'] is None, -(x['avg_score'] or 0)))
        return Response(results)


class TelegramWebhookView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
        expected = getattr(settings, 'TELEGRAM_WEBHOOK_SECRET', '')
        if expected and secret != expected:
            return Response(status=403)

        try:
            data = request.data
            from users.telegram_bot import get_application
            from telegram import Update
            app = get_application()
            update = Update.de_json(data, app.bot)
            async_to_sync(app.process_update)(update)
        except Exception as e:
            logger.error('Telegram webhook error: %s', e, exc_info=True)

        return Response({'ok': True})
