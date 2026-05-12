import random
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db.models import Count
from .models import Topic, Question, Game, Team, GameRound
from .serializers import TopicSerializer, QuestionSerializer, GameSerializer, GameListSerializer

User = get_user_model()

TEAM_NAMES = [
    '🦁 Lions', '🐍 Pythons', '🦊 Foxes', '🦅 Eagles',
    '🐉 Dragons', '🦄 Unicorns', '🐺 Wolves', '🦈 Sharks',
]


class IsTeacher(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'teacher'


# ── Topics ────────────────────────────────────────────────────────────────────

class TopicListCreateView(generics.ListCreateAPIView):
    serializer_class   = TopicSerializer
    permission_classes = [IsTeacher]

    def get_queryset(self):
        qs = Topic.objects.all().select_related('created_by')
        if owner := self.request.query_params.get('owner'):
            qs = qs.filter(created_by_id=owner)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class TopicDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = TopicSerializer
    permission_classes = [IsTeacher]

    def get_queryset(self):
        return Topic.objects.filter(created_by=self.request.user)


# ── Questions ─────────────────────────────────────────────────────────────────

class QuestionListCreateView(generics.ListCreateAPIView):
    serializer_class   = QuestionSerializer
    permission_classes = [IsTeacher]

    def get_queryset(self):
        qs = Question.objects.all().select_related('topic', 'created_by')
        if owner := self.request.query_params.get('owner'):
            qs = qs.filter(created_by_id=owner)
        if t := self.request.query_params.get('topic'):
            qs = qs.filter(topic_id=t)
        if d := self.request.query_params.get('difficulty'):
            qs = qs.filter(difficulty=d)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class QuestionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = QuestionSerializer
    permission_classes = [IsTeacher]

    def get_queryset(self):
        return Question.objects.filter(created_by=self.request.user)


# ── Question Banks ─────────────────────────────────────────────────────────────

class QuestionBankListView(APIView):
    permission_classes = [IsTeacher]

    def get(self, request):
        teacher_ids = Question.objects.values_list('created_by_id', flat=True).distinct()
        teachers = User.objects.filter(id__in=teacher_ids).annotate(
            question_count=Count('questions', distinct=True),
            topic_count=Count('topics', distinct=True),
        )
        result = []
        for t in teachers:
            result.append({
                'id':             t.id,
                'name':           t.get_full_name() or t.username,
                'username':       t.username,
                'question_count': t.question_count,
                'topic_count':    t.topic_count,
                'is_me':          t.id == request.user.id,
            })
        result.sort(key=lambda x: (0 if x['is_me'] else 1, x['name'].lower()))
        return Response(result)


# ── Game helpers ──────────────────────────────────────────────────────────────

def get_group_and_check_teacher(group_pk, user):
    from groups.models import Group
    group = get_object_or_404(Group, pk=group_pk)
    is_teacher = group.teacher == user
    return group, is_teacher


def game_response(game):
    """Serialize game including board. Board is a SerializerMethodField so always present."""
    return GameSerializer(game).data


def pick_questions_by_difficulty(teacher, topic_id, diff_counts):
    """
    Pick exactly diff_counts['easy'/'medium'/'hard'] questions per difficulty.
    Raises ValueError if not enough questions are available.
    """
    chosen = []
    for diff in ('easy', 'medium', 'hard'):
        count = max(0, int(diff_counts.get(diff) or 0))
        if count == 0:
            continue
        pool = list(Question.objects.filter(created_by=teacher, topic_id=topic_id, difficulty=diff))
        if len(pool) < count:
            raise ValueError(f'{diff}:{topic_id}:{count}:{len(pool)}')
        random.shuffle(pool)
        chosen.extend(pool[:count])
    random.shuffle(chosen)
    return chosen


# ── Games ─────────────────────────────────────────────────────────────────────

class GameListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, group_pk):
        group, _ = get_group_and_check_teacher(group_pk, request.user)
        games = Game.objects.filter(group=group).order_by('-created_at')
        return Response(GameListSerializer(games, many=True).data)

    def post(self, request, group_pk):
        group, is_teacher = get_group_and_check_teacher(group_pk, request.user)
        if not is_teacher:
            return Response({'detail': 'Not allowed.'}, status=403)
        serializer = GameListSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        game = serializer.save(group=group, created_by=request.user)

        source_id = request.data.get('source_teacher_id')
        source_teacher = get_object_or_404(User, pk=source_id) if source_id else request.user

        topic_difficulty_counts = request.data.get('topic_difficulty_counts', {})
        chosen = []
        try:
            for topic_id, diff_counts in topic_difficulty_counts.items():
                if isinstance(diff_counts, dict):
                    chosen.extend(pick_questions_by_difficulty(source_teacher, topic_id, diff_counts))
        except ValueError as e:
            game.delete()
            parts = str(e).split(':')
            diff, topic_id, requested, available = parts[0], parts[1], parts[2], parts[3]
            return Response({
                'detail': f'Not enough {diff} questions for topic {topic_id}: '
                          f'requested {requested}, available {available}.'
            }, status=400)

        if chosen:
            game.questions.set(chosen)

        return Response(game_response(game), status=201)


class GameDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, group_pk, game_pk):
        group, _ = get_group_and_check_teacher(group_pk, request.user)
        game = get_object_or_404(Game, pk=game_pk, group=group)
        return Response(game_response(game))

    def delete(self, request, group_pk, game_pk):
        group, is_teacher = get_group_and_check_teacher(group_pk, request.user)
        if not is_teacher:
            return Response({'detail': 'Not allowed.'}, status=403)
        game = get_object_or_404(Game, pk=game_pk, group=group)
        game.delete()
        return Response(status=204)


class GameStartView(APIView):
    permission_classes = [IsTeacher]

    def post(self, request, group_pk, game_pk):
        group, is_teacher = get_group_and_check_teacher(group_pk, request.user)
        if not is_teacher:
            return Response({'detail': 'Not allowed.'}, status=403)
        game = get_object_or_404(Game, pk=game_pk, group=group)
        if game.status != Game.WAITING:
            return Response({'detail': 'Game already started.'}, status=400)

        students = list(User.objects.filter(memberships__group=group))
        random.shuffle(students)

        game.teams.all().delete()
        shuffled_names = random.sample(TEAM_NAMES, min(game.team_count, len(TEAM_NAMES)))
        while len(shuffled_names) < game.team_count:
            shuffled_names.append(f'Team {len(shuffled_names) + 1}')
        teams = [Team.objects.create(game=game, name=shuffled_names[i]) for i in range(game.team_count)]
        for i, student in enumerate(students):
            teams[i % game.team_count].members.add(student)

        questions = list(game.questions.all())
        if questions:
            game.double_question = random.choice(questions)
        game.status = Game.ACTIVE
        game.save()
        return Response(game_response(game))


class GamePickView(APIView):
    permission_classes = [IsTeacher]

    def post(self, request, group_pk, game_pk):
        group, is_teacher = get_group_and_check_teacher(group_pk, request.user)
        if not is_teacher:
            return Response({'detail': 'Not allowed.'}, status=403)
        game = get_object_or_404(Game, pk=game_pk, group=group)
        if game.status != Game.ACTIVE:
            return Response({'detail': 'Game not active.'}, status=400)

        question = get_object_or_404(Question, pk=request.data.get('question_id'))
        team     = get_object_or_404(Team, pk=request.data.get('team_id'), game=game)

        if game.rounds.filter(question=question).exists():
            return Response({'detail': 'Already answered.'}, status=400)

        game.current_question = question
        game.current_team     = team
        game.save()
        return Response(game_response(game))


class GameAnswerView(APIView):
    permission_classes = [IsTeacher]

    def post(self, request, group_pk, game_pk):
        group, is_teacher = get_group_and_check_teacher(group_pk, request.user)
        if not is_teacher:
            return Response({'detail': 'Not allowed.'}, status=403)
        game = get_object_or_404(Game, pk=game_pk, group=group)

        question = game.current_question
        team     = game.current_team
        if not question or not team:
            return Response({'detail': 'No active question.'}, status=400)

        correct       = request.data.get('correct', False)
        steal_team_id = request.data.get('steal_team_id')
        partial_pct   = request.data.get('partial_pct')   # 25 | 50 | 75 | 100 | None
        is_double     = game.double_question_id == question.id
        base_points   = question.points * (2 if is_double else 1)

        if steal_team_id:
            steal_team = get_object_or_404(Team, pk=steal_team_id, game=game)
            pts = base_points // 2
            steal_team.score += pts
            steal_team.save()
            GameRound.objects.create(game=game, question=question, picked_by=team,
                stolen_by=steal_team, is_correct=True, is_stolen=True,
                points_awarded=pts, is_double=is_double)
        elif partial_pct is not None:
            pct = max(0, min(100, int(partial_pct)))
            pts = int(base_points * pct / 100)
            team.score += pts
            team.save()
            GameRound.objects.create(game=game, question=question, picked_by=team,
                is_correct=pct > 0, points_awarded=pts, is_double=is_double)
        elif correct:
            team.score += base_points
            team.save()
            GameRound.objects.create(game=game, question=question, picked_by=team,
                is_correct=True, points_awarded=base_points, is_double=is_double)
        else:
            GameRound.objects.create(game=game, question=question, picked_by=team,
                is_correct=False, points_awarded=0, is_double=is_double)

        game.current_question = None
        game.current_team     = None
        game.save()
        return Response(game_response(game))


class GameFinishView(APIView):
    permission_classes = [IsTeacher]

    def post(self, request, group_pk, game_pk):
        group, is_teacher = get_group_and_check_teacher(group_pk, request.user)
        if not is_teacher:
            return Response({'detail': 'Not allowed.'}, status=403)
        game = get_object_or_404(Game, pk=game_pk, group=group)
        game.status = Game.FINISHED
        game.current_question = None
        game.current_team     = None
        game.save()
        return Response(game_response(game))


class GameResetView(APIView):
    permission_classes = [IsTeacher]

    def post(self, request, group_pk, game_pk):
        group, is_teacher = get_group_and_check_teacher(group_pk, request.user)
        if not is_teacher:
            return Response({'detail': 'Not allowed.'}, status=403)
        game = get_object_or_404(Game, pk=game_pk, group=group)
        game.rounds.all().delete()
        game.teams.all().update(score=0, final_bet=None)
        questions = list(game.questions.all())
        if questions:
            game.double_question = random.choice(questions)
        game.status = Game.ACTIVE
        game.current_question = None
        game.current_team     = None
        game.save()
        return Response(game_response(game))


class GameCopyView(APIView):
    permission_classes = [IsTeacher]

    def post(self, request, group_pk, game_pk):
        group, is_teacher = get_group_and_check_teacher(group_pk, request.user)
        if not is_teacher:
            return Response({'detail': 'Not allowed.'}, status=403)
        original = get_object_or_404(Game, pk=game_pk, group=group)
        copy = Game.objects.create(
            group=group,
            name=f'Copy of {original.name}',
            timer_seconds=original.timer_seconds,
            team_count=original.team_count,
            students_per_team=original.students_per_team,
            created_by=request.user,
        )
        copy.questions.set(original.questions.all())
        return Response(GameListSerializer(copy).data, status=201)
