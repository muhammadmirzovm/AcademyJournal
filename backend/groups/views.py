from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Count
from asgiref.sync import async_to_sync
from .models import Group, GroupMembership, Lesson, Attendance, Score, Journal, CoinTransaction, HomeworkSubmission, Announcement
from .serializers import (
    GroupSerializer, MemberSerializer, LessonSerializer,
    AttendanceSerializer, BulkAttendanceSerializer,
    ScoreSerializer, BulkScoreSerializer, JournalSerializer,
    HomeworkSubmissionSerializer, AnnouncementSerializer,
)


class IsTeacherOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('teacher', 'admin')


# ── Groups ────────────────────────────────────────────────────────────────────

class GroupListCreateView(generics.ListCreateAPIView):
    serializer_class = GroupSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsTeacherOrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Group.objects.filter(teacher__academy=user.academy)
        if user.role == 'teacher':
            return Group.objects.filter(teacher=user)
        return Group.objects.filter(memberships__student=user)

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)


class GroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = GroupSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Group.objects.all()

    def update(self, request, *args, **kwargs):
        group = self.get_object()
        if group.teacher != request.user and request.user.role != 'admin':
            return Response({'detail': 'Only the teacher or admin can edit this group.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        group = self.get_object()
        if group.teacher != request.user and request.user.role != 'admin':
            return Response({'detail': 'Only the teacher or admin can delete this group.'}, status=403)
        return super().destroy(request, *args, **kwargs)


class JoinGroupView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        join_key = request.data.get('join_key', '').strip().upper()
        group = get_object_or_404(Group, join_key=join_key)

        if request.user.role == 'teacher':
            return Response({'detail': 'Teachers cannot join groups as students.'}, status=400)

        if GroupMembership.objects.filter(group=group, student=request.user).exists():
            return Response({'detail': 'Already a member.'}, status=400)

        GroupMembership.objects.create(group=group, student=request.user)

        for lesson in group.lessons.all():
            Attendance.objects.get_or_create(lesson=lesson, student=request.user, defaults={'present': False})

        return Response(GroupSerializer(group, context={'request': request}).data, status=201)


class GroupMembersView(generics.ListAPIView):
    serializer_class = MemberSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        group = get_object_or_404(Group, pk=self.kwargs['pk'])
        return group.memberships.select_related('student')

    def get_serializer_context(self):
        ctx   = super().get_serializer_context()
        group = get_object_or_404(Group, pk=self.kwargs['pk'])

        memberships  = list(group.memberships.select_related('student').all())
        student_ids  = [m.student.id for m in memberships]

        # ── Comprehension (per-student join-date scoped) ──────────────────────
        comprehension_map = {}
        for membership in memberships:
            join_date     = membership.joined_at.date()
            lessons_since = group.lessons.filter(date__gte=join_date)
            lesson_count  = lessons_since.count()
            if lesson_count == 0:
                comprehension_map[membership.student.id] = None
            else:
                score_sum = (
                    Score.objects
                    .filter(lesson__in=lessons_since, student=membership.student)
                    .aggregate(total=Sum('value'))['total'] or 0
                )
                comprehension_map[membership.student.id] = round(score_sum / (lesson_count * 5) * 100)

        # ── Coins (bulk) ──────────────────────────────────────────────────────
        coin_rows = (
            CoinTransaction.objects
            .filter(group=group, student_id__in=student_ids)
            .values('student')
            .annotate(total=Sum('amount'))
        )
        coin_map = {row['student']: max(0, row['total'] or 0) for row in coin_rows}

        # ── Attendance rate (bulk) ────────────────────────────────────────────
        present_rows = (
            Attendance.objects
            .filter(lesson__group=group, student_id__in=student_ids, present=True)
            .values('student').annotate(n=Count('id'))
        )
        total_rows = (
            Attendance.objects
            .filter(lesson__group=group, student_id__in=student_ids)
            .values('student').annotate(n=Count('id'))
        )
        present_map = {r['student']: r['n'] for r in present_rows}
        total_map   = {r['student']: r['n'] for r in total_rows}

        attendance_map = {}
        for sid in student_ids:
            total   = total_map.get(sid, 0)
            present = present_map.get(sid, 0)
            attendance_map[sid] = round(present / total * 100) if total > 0 else None

        ctx['comprehension_map'] = comprehension_map
        ctx['coin_map']          = {sid: coin_map.get(sid, 0) for sid in student_ids}
        ctx['attendance_map']    = attendance_map
        return ctx


# ── Lessons ───────────────────────────────────────────────────────────────────

class LessonListCreateView(generics.ListCreateAPIView):
    serializer_class = LessonSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Lesson.objects.filter(group_id=self.kwargs['group_pk'])

    def perform_create(self, serializer):
        group = get_object_or_404(Group, pk=self.kwargs['group_pk'])
        if group.teacher != self.request.user and self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only the teacher or admin can add lessons.')
        lesson = serializer.save(group=group)
        for membership in group.memberships.all():
            Attendance.objects.get_or_create(lesson=lesson, student=membership.student, defaults={'present': False})


class LessonDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = LessonSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Lesson.objects.filter(group_id=self.kwargs['group_pk'])

    def update(self, request, *args, **kwargs):
        lesson = self.get_object()
        if lesson.group.teacher != request.user and request.user.role != 'admin':
            return Response({'detail': 'Only the teacher or admin can edit lessons.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        lesson = self.get_object()
        if lesson.group.teacher != request.user and request.user.role != 'admin':
            return Response({'detail': 'Only the teacher or admin can delete lessons.'}, status=403)
        return super().destroy(request, *args, **kwargs)


# ── Attendance ────────────────────────────────────────────────────────────────

class AttendanceView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, group_pk, lesson_pk):
        lesson  = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)
        records = Attendance.objects.filter(lesson=lesson).select_related('student')
        return Response(AttendanceSerializer(records, many=True).data)

    def post(self, request, group_pk, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)
        if lesson.group.teacher != request.user and request.user.role != 'admin':
            return Response({'detail': 'Only the teacher or admin can mark attendance.'}, status=403)

        serializer = BulkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for record in serializer.validated_data['records']:
            Attendance.objects.update_or_create(
                lesson=lesson, student_id=record['student'],
                defaults={'present': record['present']}
            )

        records = Attendance.objects.filter(lesson=lesson).select_related('student')
        return Response(AttendanceSerializer(records, many=True).data)


# ── Scores ────────────────────────────────────────────────────────────────────

class ScoreView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, group_pk, lesson_pk):
        lesson  = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)
        records = Score.objects.filter(lesson=lesson).select_related('student')
        return Response(ScoreSerializer(records, many=True).data)

    def post(self, request, group_pk, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)
        if lesson.group.teacher != request.user and request.user.role != 'admin':
            return Response({'detail': 'Only the teacher or admin can enter scores.'}, status=403)

        serializer = BulkScoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for record in serializer.validated_data['records']:
            Score.objects.update_or_create(
                lesson=lesson, student_id=record['student'],
                defaults={'value': int(record['value'])}
            )

        records = Score.objects.filter(lesson=lesson).select_related('student')
        return Response(ScoreSerializer(records, many=True).data)


# ── Journals ──────────────────────────────────────────────────────────────────

class JournalView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, group_pk, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)
        if lesson.group.teacher == request.user:
            records = Journal.objects.filter(lesson=lesson).select_related('student')
        else:
            records = Journal.objects.filter(lesson=lesson, student=request.user)
        return Response(JournalSerializer(records, many=True).data)

    def post(self, request, group_pk, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)
        if request.user.role == 'teacher':
            return Response({'detail': 'Teachers do not submit journals.'}, status=400)

        body = request.data.get('body', '').strip()
        if not body:
            return Response({'detail': 'Journal body cannot be empty.'}, status=400)

        journal, _ = Journal.objects.update_or_create(
            lesson=lesson, student=request.user,
            defaults={'body': body}
        )
        return Response(JournalSerializer(journal).data, status=201)


# ── Homework ──────────────────────────────────────────────────────────────────

class HomeworkView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, group_pk, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)
        if lesson.group.teacher == request.user:
            submissions = HomeworkSubmission.objects.filter(lesson=lesson).select_related('student')
        else:
            submissions = HomeworkSubmission.objects.filter(lesson=lesson, student=request.user)
        return Response({
            'assignment': lesson.homework,
            'submissions': HomeworkSubmissionSerializer(submissions, many=True).data,
        })

    def post(self, request, group_pk, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)

        if request.user.role == 'teacher':
            if lesson.group.teacher != request.user:
                return Response({'detail': 'Only the lesson teacher can set homework.'}, status=403)
            assignment = request.data.get('assignment', '').strip()
            lesson.homework = assignment
            lesson.save(update_fields=['homework'])
            return Response({'assignment': lesson.homework})

        body = request.data.get('body', '').strip()
        if not body:
            return Response({'detail': 'Submission cannot be empty.'}, status=400)

        submission, _ = HomeworkSubmission.objects.update_or_create(
            lesson=lesson, student=request.user,
            defaults={'body': body}
        )
        return Response(HomeworkSubmissionSerializer(submission).data, status=201)


# ── Membership ────────────────────────────────────────────────────────────────

class MembershipDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, pk, member_pk):
        group = get_object_or_404(Group, pk=pk)
        if group.teacher != request.user and request.user.role != 'admin':
            return Response({'detail': 'Only the teacher or admin can update membership.'}, status=403)
        membership = get_object_or_404(GroupMembership, pk=member_pk, group=group)

        joined_at = request.data.get('joined_at')
        if joined_at:
            from datetime import datetime, time as time_
            try:
                d = datetime.strptime(str(joined_at)[:10], '%Y-%m-%d')
                GroupMembership.objects.filter(pk=member_pk).update(
                    joined_at=datetime.combine(d.date(), time_.min)
                )
                membership.refresh_from_db()
            except ValueError:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

        join_date     = membership.joined_at.date()
        lessons_since = group.lessons.filter(date__gte=join_date)
        lesson_count  = lessons_since.count()
        if lesson_count == 0:
            comprehension = None
        else:
            score_sum = (
                Score.objects.filter(lesson__in=lessons_since, student=membership.student)
                .aggregate(total=Sum('value'))['total'] or 0
            )
            comprehension = round(score_sum / (lesson_count * 5) * 100)

        data = MemberSerializer(membership).data
        data['comprehension'] = comprehension
        return Response(data)

    def delete(self, request, pk, member_pk):
        group = get_object_or_404(Group, pk=pk)
        if group.teacher != request.user and request.user.role != 'admin':
            return Response({'detail': 'Only the teacher or admin can remove students.'}, status=403)
        membership = get_object_or_404(GroupMembership, pk=member_pk, group=group)
        membership.delete()
        return Response(status=204)


# ── End Lesson ────────────────────────────────────────────────────────────────

class EndLessonView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, group_pk, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)
        if lesson.group.teacher != request.user and request.user.role != 'admin':
            return Response({'detail': 'Only the teacher or admin can end a lesson.'}, status=403)

        from users.models import Notification
        from users.telegram_bot import send_notification

        group      = lesson.group
        attendances = {a.student_id: a.present for a in Attendance.objects.filter(lesson=lesson)}
        scores      = {s.student_id: s.value   for s in Score.objects.filter(lesson=lesson)}

        memberships = (
            GroupMembership.objects
            .filter(group=group)
            .select_related('student')
            .prefetch_related('student__parents__parent')
        )

        for membership in memberships:
            student = membership.student
            present = attendances.get(student.id, False)
            score   = scores.get(student.id)
            name    = f'{student.first_name} {student.last_name}'.strip() or student.username
            scored  = score is not None
            ntype   = 'score' if scored else 'absent'

            # Pick message key variant
            attendance_key = 'present' if present else 'absent'
            score_key      = 'scored'  if scored  else 'unscored'
            student_key    = f'student_{attendance_key}_{score_key}'
            parent_key     = f'parent_{attendance_key}_{score_key}'

            # Student in-app notification body
            if present:
                s_body = f'{"Qatnashdingiz" if not scored else f"Qatnashdingiz · Ball: {score}/5"} — {group.name}'
            else:
                s_body = f'{"Kelmadingiz" if not scored else f"Kelmadingiz · Ball: {score}/5"} — {group.name}'

            Notification.objects.create(
                user=student, type=ntype,
                title=lesson.title, body=s_body,
            )

            if student.telegram_id:
                try:
                    kwargs = dict(lesson=lesson.title, group=group.name)
                    if scored:
                        kwargs['score'] = score
                    async_to_sync(send_notification)(
                        student.telegram_id, student_key, student.telegram_lang or 'uz', **kwargs,
                    )
                except Exception:
                    pass

            # Parent notifications
            for ps in student.parents.select_related('parent').all():
                parent = ps.parent
                if present:
                    p_body = f'{name} · {"Qatnashdi" if not scored else f"Qatnashdi · Ball: {score}/5"} — {group.name}'
                else:
                    p_body = f'{name} · {"Kelmadi" if not scored else f"Kelmadi · Ball: {score}/5"} — {group.name}'

                Notification.objects.create(
                    user=parent, type=ntype,
                    title=lesson.title, body=p_body,
                )
                if parent.telegram_id:
                    try:
                        kwargs = dict(name=name, lesson=lesson.title, group=group.name)
                        if scored:
                            kwargs['score'] = score
                        async_to_sync(send_notification)(
                            parent.telegram_id, parent_key, parent.telegram_lang or 'uz', **kwargs,
                        )
                    except Exception:
                        pass

        # Send homework notification to students only (if homework exists)
        if lesson.homework.strip():
            for membership in memberships:
                student = membership.student
                if student.telegram_id:
                    try:
                        async_to_sync(send_notification)(
                            student.telegram_id, 'hw_notification',
                            student.telegram_lang or 'uz',
                            lesson=lesson.title,
                            group=group.name,
                            homework=lesson.homework,
                        )
                    except Exception:
                        pass

        return Response({'ok': True, 'notified': len(memberships)})


# ── Coins ─────────────────────────────────────────────────────────────────────

class CoinView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        if group.teacher != request.user and request.user.role != 'admin':
            return Response({'detail': 'Only the teacher or admin can manage coins.'}, status=403)

        student_id = request.data.get('student')
        amount     = request.data.get('amount')
        note       = request.data.get('note', '').strip()

        if not student_id or amount is None:
            return Response({'detail': 'student and amount are required.'}, status=400)

        try:
            amount = int(amount)
        except (ValueError, TypeError):
            return Response({'detail': 'amount must be an integer.'}, status=400)

        if amount == 0:
            return Response({'detail': 'amount cannot be zero.'}, status=400)

        membership = get_object_or_404(GroupMembership, group=group, student_id=student_id)

        current = (
            CoinTransaction.objects
            .filter(group=group, student_id=student_id)
            .aggregate(total=Sum('amount'))['total'] or 0
        )

        # Floor at 0
        if amount < 0:
            amount = max(amount, -current)
        if amount == 0:
            return Response({'balance': current, 'sticker_count': membership.sticker_count, 'sticker_earned': False})

        CoinTransaction.objects.create(group=group, student_id=student_id, amount=amount, note=note)
        new_balance    = current + amount
        threshold      = group.coin_threshold
        stickers_earned = new_balance // threshold

        if stickers_earned > 0:
            membership.sticker_count += stickers_earned
            membership.save()
            CoinTransaction.objects.create(
                group=group, student_id=student_id,
                amount=-(stickers_earned * threshold),
                note=f'{stickers_earned} sticker(s) earned',
            )
            new_balance = new_balance % threshold

        return Response({
            'balance':       new_balance,
            'sticker_count': membership.sticker_count,
            'sticker_earned': stickers_earned > 0,
        })


class AcademyAnnouncementView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        anns = Announcement.objects.filter(group=None)
        return Response(AnnouncementSerializer(anns, many=True).data)

    def post(self, request):
        if request.user.role != 'admin':
            return Response({'detail': 'Admin only.'}, status=403)
        ser = AnnouncementSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(author=request.user, group=None)
        return Response(ser.data, status=201)


class GroupAnnouncementView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        is_member  = group.memberships.filter(student=request.user).exists()
        is_teacher = group.teacher == request.user
        is_admin   = request.user.role == 'admin'
        if not (is_member or is_teacher or is_admin):
            return Response({'detail': 'No access.'}, status=403)
        return Response(AnnouncementSerializer(group.announcements.all(), many=True).data)

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        if group.teacher != request.user and request.user.role != 'admin':
            return Response({'detail': 'Teacher or admin only.'}, status=403)
        ser = AnnouncementSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(author=request.user, group=group)
        return Response(ser.data, status=201)


class AnnouncementDeleteView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def delete(self, request, pk):
        ann = get_object_or_404(Announcement, pk=pk)
        if ann.author != request.user and request.user.role != 'admin':
            return Response({'detail': 'No permission.'}, status=403)
        ann.delete()
        return Response(status=204)
