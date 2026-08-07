from rest_framework import serializers
from .models import Game, GameResult


def _display_name(user):
    if not user:
        return None
    return f'{user.first_name} {user.last_name}'.strip() or user.username


class GameResultSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = GameResult
        fields = ('id', 'student', 'student_name', 'place', 'effort', 'coins')

    def get_student_name(self, obj):
        return _display_name(obj.student)


class GameSerializer(serializers.ModelSerializer):
    results     = GameResultSerializer(many=True, read_only=True)
    first_name  = serializers.SerializerMethodField()
    second_name = serializers.SerializerMethodField()
    third_name  = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = (
            'id', 'lesson', 'group', 'date', 'is_big_day', 'is_individual', 'status',
            'first', 'first_name', 'second', 'second_name', 'third', 'third_name',
            'teacher_name', 'applied_rules', 'started_at', 'closed_at', 'results',
        )

    def get_first_name(self, obj):
        return _display_name(obj.first)

    def get_second_name(self, obj):
        return _display_name(obj.second)

    def get_third_name(self, obj):
        return _display_name(obj.third)

    def get_teacher_name(self, obj):
        return _display_name(obj.teacher)
