from datetime import timedelta

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from coins.models import CoinSetting, CoinTransaction
from groups.models import Attendance, Lesson

from .models import Game, GameResult
from .rules import build_applied_rules, coins_for_effort, coins_for_place, is_big_day, preview_total
from .serializers import GameSerializer


def _is_teacher_or_admin(request, group):
    return request.user.role == 'admin' or group.teacher == request.user


def _can_pick_third(lesson, setting):
    return lesson.group.memberships.count() >= setting.min_group_for_3rd


class LessonGameView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, group_pk, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)
        setting = CoinSetting.get()
        can_pick_third = _can_pick_third(lesson, setting)

        game = Game.objects.filter(lesson=lesson).first()
        if game:
            data = GameSerializer(game).data
            data['can_pick_third'] = can_pick_third
            return Response(data)

        big = is_big_day(lesson.date, setting)
        individual = lesson.group.is_individual
        attended_count = Attendance.objects.filter(lesson=lesson, present=True).count()
        rules = build_applied_rules(setting, big, individual)

        return Response({
            'status': Game.Status.NOT_STARTED,
            'is_big_day': big,
            'is_individual': individual,
            'attended_count': attended_count,
            'can_pick_third': can_pick_third,
            'rules': rules,
            'total_preview': preview_total(rules, individual, attended_count),
        })


class GameStartView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, group_pk, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)
        if not _is_teacher_or_admin(request, lesson.group):
            return Response({'detail': "Only the teacher or admin can start a game."}, status=403)

        if Game.objects.filter(lesson=lesson).exists():
            return Response({'detail': "Bu dars uchun o'yin allaqachon mavjud."}, status=400)

        setting = CoinSetting.get()
        week_start = lesson.date - timedelta(days=lesson.date.weekday())
        week_end = week_start + timedelta(days=6)
        started_this_week = Game.objects.filter(group=lesson.group, date__gte=week_start, date__lte=week_end).count()
        if started_this_week >= setting.max_games_per_week:
            return Response(
                {'detail': f"Haftasiga {setting.max_games_per_week} tadan ortiq o'yin o'tkazib bo'lmaydi."},
                status=400,
            )

        big = is_big_day(lesson.date, setting)
        individual = lesson.group.is_individual
        rules = build_applied_rules(setting, big, individual)

        try:
            game = Game.objects.create(
                lesson=lesson, group=lesson.group, teacher=request.user, date=lesson.date,
                is_big_day=big, is_individual=individual, status=Game.Status.IN_PROGRESS,
                applied_rules=rules, started_at=timezone.now(),
            )
        except IntegrityError:
            return Response({'detail': "Bugun bu guruh uchun o'yin allaqachon boshlangan."}, status=400)

        data = GameSerializer(game).data
        data['can_pick_third'] = _can_pick_third(lesson, setting)
        return Response(data, status=201)


class GameCancelView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, group_pk, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)
        game = get_object_or_404(Game, lesson=lesson)
        if not _is_teacher_or_admin(request, lesson.group):
            return Response({'detail': "Only the teacher or admin."}, status=403)
        if game.status != Game.Status.IN_PROGRESS:
            return Response({'detail': "Faqat davom etayotgan o'yinni bekor qilish mumkin."}, status=400)
        game.delete()
        return Response(status=204)


class GameCloseView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, group_pk, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk, group_id=group_pk)
        if not _is_teacher_or_admin(request, lesson.group):
            return Response({'detail': "Only the teacher or admin."}, status=403)

        with transaction.atomic():
            game = get_object_or_404(Game.objects.select_for_update(), lesson=lesson)

            if game.status == Game.Status.CLOSED:
                return Response(GameSerializer(game).data)  # idempotent — no double-processing

            if game.status != Game.Status.IN_PROGRESS:
                return Response({'detail': "O'yin boshlanmagan."}, status=400)

            attended_ids = set(
                Attendance.objects.filter(lesson=lesson, present=True).values_list('student_id', flat=True)
            )
            rules = game.applied_rules

            if game.is_individual:
                self._close_individual(request, game, lesson, attended_ids, rules)
            else:
                error = self._close_group(request, game, lesson, attended_ids, rules)
                if error:
                    return error

            game.status = Game.Status.CLOSED
            game.closed_at = timezone.now()
            game.save()

        return Response(GameSerializer(game).data)

    def _close_individual(self, request, game, lesson, attended_ids, rules):
        student_id = next(iter(attended_ids), None)
        if student_id is None:
            return
        completed = bool(request.data.get('completed'))
        coins = rules['individual'] if completed else 0
        effort = GameResult.Effort.GOOD if completed else GameResult.Effort.NONE
        GameResult.objects.create(game=game, student_id=student_id, effort=effort, coins=coins)
        if coins:
            CoinTransaction.objects.create(
                student_id=student_id, amount=coins, type=CoinTransaction.Type.GAME_EFFORT,
                reason=f"{lesson.title} — bajarildi", created_by=request.user,
            )

    def _close_group(self, request, game, lesson, attended_ids, rules):
        first, second, third = request.data.get('first'), request.data.get('second'), request.data.get('third')
        efforts = request.data.get('efforts', {})

        placed_ids = {int(x) for x in (first, second, third) if x}
        if not placed_ids.issubset(attended_ids):
            return Response({'detail': "Faqat darsga kelgan o'quvchi tanlanishi mumkin."}, status=400)

        place_map = {}
        if first:  place_map[int(first)] = 1
        if second: place_map[int(second)] = 2
        if third:  place_map[int(third)] = 3

        for student_id in attended_ids:
            if student_id in place_map:
                place = place_map[student_id]
                coins = coins_for_place(rules, place)
                GameResult.objects.create(game=game, student_id=student_id, place=place, coins=coins)
                txn_type, reason = CoinTransaction.Type.GAME_PLACE, f"{lesson.title} — {place}-o'rin"
            else:
                effort = int(efforts.get(str(student_id), GameResult.Effort.OK))
                coins = coins_for_effort(rules, effort)
                GameResult.objects.create(game=game, student_id=student_id, effort=effort, coins=coins)
                txn_type, reason = CoinTransaction.Type.GAME_EFFORT, f"{lesson.title} — harakat"

            if coins:
                CoinTransaction.objects.create(
                    student_id=student_id, amount=coins, type=txn_type, reason=reason, created_by=request.user,
                )

        game.first_id  = int(first) if first else None
        game.second_id = int(second) if second else None
        game.third_id  = int(third) if third else None
        return None


class GroupGameHistoryView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, group_pk):
        games = (
            Game.objects.filter(group_id=group_pk, status=Game.Status.CLOSED)
            .select_related('first', 'second', 'third', 'teacher')
            .prefetch_related('results__student')
        )
        return Response(GameSerializer(games, many=True).data)
