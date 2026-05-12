from rest_framework import serializers
from .models import Topic, Question, Game, Team, GameRound


class TopicSerializer(serializers.ModelSerializer):
    question_count  = serializers.IntegerField(source='questions.count', read_only=True)
    easy_count      = serializers.SerializerMethodField()
    medium_count    = serializers.SerializerMethodField()
    hard_count      = serializers.SerializerMethodField()
    created_by_id   = serializers.IntegerField(source='created_by.id', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = Topic
        fields = ['id', 'name', 'question_count', 'easy_count', 'medium_count', 'hard_count',
                  'created_by_id', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_created_by_name(self, obj):
        u = obj.created_by
        return u.get_full_name() or u.username

    def get_easy_count(self, obj):
        return obj.questions.filter(difficulty='easy', created_by=obj.created_by).count()

    def get_medium_count(self, obj):
        return obj.questions.filter(difficulty='medium', created_by=obj.created_by).count()

    def get_hard_count(self, obj):
        return obj.questions.filter(difficulty='hard', created_by=obj.created_by).count()


class QuestionSerializer(serializers.ModelSerializer):
    topic_name      = serializers.CharField(source='topic.name', read_only=True)
    created_by_id   = serializers.IntegerField(source='created_by.id', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = Question
        fields = ['id', 'topic', 'topic_name', 'text', 'hint', 'answer_type', 'points',
                  'difficulty', 'options', 'correct_answer', 'created_by_id', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_created_by_name(self, obj):
        u = obj.created_by
        return u.get_full_name() or u.username


class TeamSerializer(serializers.ModelSerializer):
    members = serializers.SerializerMethodField()

    class Meta:
        model  = Team
        fields = ['id', 'name', 'score', 'final_bet', 'members']

    def get_members(self, obj):
        return [{'id': m.id, 'first_name': m.first_name, 'username': m.username}
                for m in obj.members.all()]


class GameListSerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(source='questions.count', read_only=True)

    class Meta:
        model  = Game
        fields = ['id', 'name', 'timer_seconds', 'team_count', 'students_per_team', 'status', 'question_count', 'created_at']
        read_only_fields = ['id', 'status', 'question_count', 'created_at']


class GameSerializer(serializers.ModelSerializer):
    teams                = TeamSerializer(many=True, read_only=True)
    answered_question_ids= serializers.SerializerMethodField()
    current_question_data= serializers.SerializerMethodField()
    double_question_id   = serializers.IntegerField(read_only=True, allow_null=True)
    board                = serializers.SerializerMethodField()

    class Meta:
        model  = Game
        fields = ['id', 'name', 'timer_seconds', 'team_count', 'students_per_team', 'status',
                  'current_question', 'current_question_data', 'current_team',
                  'double_question_id', 'teams', 'answered_question_ids', 'board', 'created_at']
        read_only_fields = ['id', 'status', 'current_question', 'current_team',
                            'double_question_id', 'created_at']

    def get_answered_question_ids(self, obj):
        return list(obj.rounds.values_list('question_id', flat=True).distinct())

    def get_current_question_data(self, obj):
        if obj.current_question:
            return QuestionSerializer(obj.current_question).data
        return None

    def get_board(self, obj):
        questions    = obj.questions.select_related('topic').all()
        answered_ids = set(obj.rounds.values_list('question_id', flat=True))
        board = {}
        for q in questions:
            topic = q.topic.name
            if topic not in board:
                board[topic] = []
            board[topic].append({
                'id':          q.id,
                'points':      q.points,
                'difficulty':  q.difficulty,
                'answer_type': q.answer_type,
                'answered':    q.id in answered_ids,
                'is_double':   obj.double_question_id == q.id,
            })
        for topic in board:
            board[topic].sort(key=lambda x: x['points'])
        return board
