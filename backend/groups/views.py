from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Count
from .models import Group, GroupMembership, Lesson, Attendance, Score, Journal, CoinTransaction
from .serializers import (
    GroupSerializer, MemberSerializer, LessonSerializer,
    AttendanceSerializer, BulkAttendanceSerializer,
    ScoreSerializer, BulkScoreSerializer, JournalSerializer,
)


class IsTeacher(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'teacher'


# ── Groups ────────────────────────────────────────────────────────────────────

class GroupListCreateView(generics.ListCreateAPIView):
    serializer_class = GroupSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsTeacher()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
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
        if group.teacher != request.user:
            return Response({'detail': 'Only the teacher can edit this group.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        group = self.get_object()
        if group.teacher != request.user:
            return Response({'detail': 'Only the teacher can delete this group.'}, status=403)
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
        if group.teacher != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only the teacher can add lessons.')
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
        if lesson.group.teacher != request.user:
            return Response({'detail': 'Only the teacher can edit lessons.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        lesson = self.get_object()
        if lesson.group.teacher != request.user:
            return Response({'detail': 'Only the teacher can delete lessons.'}, status=403)
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
        if lesson.group.teacher != request.user:
            return Response({'detail': 'Only the teacher can mark attendance.'}, status=403)

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
        if lesson.group.teacher != request.user:
            return Response({'detail': 'Only the teacher can enter scores.'}, status=403)

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


# ── Membership ────────────────────────────────────────────────────────────────

class MembershipDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, pk, member_pk):
        group = get_object_or_404(Group, pk=pk)
        if group.teacher != request.user:
            return Response({'detail': 'Only the teacher can update membership.'}, status=403)
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
        if group.teacher != request.user:
            return Response({'detail': 'Only the teacher can remove students.'}, status=403)
        membership = get_object_or_404(GroupMembership, pk=member_pk, group=group)
        membership.delete()
        return Response(status=204)


# ── Coins ─────────────────────────────────────────────────────────────────────

class CoinView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        if group.teacher != request.user:
            return Response({'detail': 'Only the teacher can manage coins.'}, status=403)

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
