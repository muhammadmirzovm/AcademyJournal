from rest_framework import serializers
from .models import Group, GroupMembership, Lesson, Attendance, Score, Journal, CoinTransaction, HomeworkSubmission, Announcement
from django.contrib.auth import get_user_model

User = get_user_model()


class MemberSerializer(serializers.ModelSerializer):
    membership_id    = serializers.IntegerField(source='id', read_only=True)
    id               = serializers.IntegerField(source='student.id')
    username         = serializers.CharField(source='student.username')
    first_name       = serializers.CharField(source='student.first_name')
    last_name        = serializers.CharField(source='student.last_name')
    sticker_count    = serializers.IntegerField(read_only=True)
    comprehension    = serializers.SerializerMethodField()
    coin_balance     = serializers.SerializerMethodField()
    attendance_rate  = serializers.SerializerMethodField()
    has_parent       = serializers.SerializerMethodField()
    student_telegram = serializers.SerializerMethodField()

    class Meta:
        model  = GroupMembership
        fields = (
            'membership_id', 'id', 'username', 'first_name', 'last_name',
            'joined_at', 'sticker_count',
            'comprehension', 'coin_balance', 'attendance_rate',
            'has_parent', 'student_telegram',
        )

    def get_comprehension(self, obj):
        return self.context.get('comprehension_map', {}).get(obj.student.id)

    def get_coin_balance(self, obj):
        return self.context.get('coin_map', {}).get(obj.student.id, 0)

    def get_attendance_rate(self, obj):
        return self.context.get('attendance_map', {}).get(obj.student.id)

    def get_has_parent(self, obj):
        return obj.student.id in self.context.get('parent_set', set())

    def get_student_telegram(self, obj):
        return obj.student.id in self.context.get('telegram_set', set())


class GroupSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    is_member    = serializers.SerializerMethodField()

    class Meta:
        model  = Group
        fields = ('id', 'name', 'description', 'join_key', 'teacher', 'teacher_name',
                  'member_count', 'is_member', 'coin_threshold', 'class_days', 'created_at')
        read_only_fields = ('join_key', 'teacher')

    def get_teacher_name(self, obj):
        return f'{obj.teacher.first_name} {obj.teacher.last_name}'.strip() or obj.teacher.username

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.memberships.filter(student=request.user).exists()
        return False


class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Lesson
        fields = ('id', 'group', 'title', 'date', 'homework', 'created_at')
        read_only_fields = ('group',)


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model  = Attendance
        fields = ('id', 'lesson', 'student', 'student_name', 'present')
        read_only_fields = ('lesson', 'student')

    def get_student_name(self, obj):
        return f'{obj.student.first_name} {obj.student.last_name}'.strip() or obj.student.username


class BulkAttendanceSerializer(serializers.Serializer):
    records = serializers.ListField(child=serializers.DictField())

    def validate_records(self, value):
        for r in value:
            if 'student' not in r or 'present' not in r:
                raise serializers.ValidationError('Each record needs student and present fields.')
        return value


class ScoreSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model  = Score
        fields = ('id', 'lesson', 'student', 'student_name', 'value')
        read_only_fields = ('lesson', 'student')

    def get_student_name(self, obj):
        return f'{obj.student.first_name} {obj.student.last_name}'.strip() or obj.student.username


class BulkScoreSerializer(serializers.Serializer):
    records = serializers.ListField(child=serializers.DictField())

    def validate_records(self, value):
        for r in value:
            if 'student' not in r or 'value' not in r:
                raise serializers.ValidationError('Each record needs student and value fields.')
            if not (0 <= int(r['value']) <= 5):
                raise serializers.ValidationError('Score value must be 0–5.')
        return value


class HomeworkSubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model  = HomeworkSubmission
        fields = ('id', 'lesson', 'student', 'student_name', 'body', 'submitted_at')
        read_only_fields = ('lesson', 'student')

    def get_student_name(self, obj):
        return f'{obj.student.first_name} {obj.student.last_name}'.strip() or obj.student.username


class AnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model  = Announcement
        fields = ('id', 'title', 'body', 'author_name', 'is_pinned', 'group', 'created_at')
        read_only_fields = ('created_at',)

    def get_author_name(self, obj):
        return f'{obj.author.first_name} {obj.author.last_name}'.strip() or obj.author.username


class JournalSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model  = Journal
        fields = ('id', 'lesson', 'student', 'student_name', 'body', 'updated_at')
        read_only_fields = ('lesson', 'student')

    def get_student_name(self, obj):
        return f'{obj.student.first_name} {obj.student.last_name}'.strip() or obj.student.username
