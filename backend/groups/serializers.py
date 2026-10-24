from rest_framework import serializers
from .models import Group, GroupMembership, Lesson, GroupDayOff, Attendance, Score, Journal, HomeworkSubmission, Announcement, Exam, ExamResult
from django.contrib.auth import get_user_model

User = get_user_model()


class MemberSerializer(serializers.ModelSerializer):
    membership_id    = serializers.IntegerField(source='id', read_only=True)
    id               = serializers.IntegerField(source='student.id')
    username         = serializers.CharField(source='student.username')
    first_name       = serializers.CharField(source='student.first_name')
    last_name        = serializers.CharField(source='student.last_name')
    comprehension    = serializers.SerializerMethodField()
    attendance_rate  = serializers.SerializerMethodField()
    has_parent       = serializers.SerializerMethodField()
    student_telegram = serializers.SerializerMethodField()

    class Meta:
        model  = GroupMembership
        fields = (
            'membership_id', 'id', 'username', 'first_name', 'last_name',
            'joined_at', 'comprehension', 'attendance_rate',
            'has_parent', 'student_telegram',
        )

    def get_comprehension(self, obj):
        return self.context.get('comprehension_map', {}).get(obj.student.id)

    def get_attendance_rate(self, obj):
        return self.context.get('attendance_map', {}).get(obj.student.id)

    def get_has_parent(self, obj):
        return obj.student.id in self.context.get('parent_set', set())

    def get_student_telegram(self, obj):
        return obj.student.id in self.context.get('telegram_set', set())


class GroupSerializer(serializers.ModelSerializer):
    def to_internal_value(self, data):
        # Older form clients submit repeated weekday values instead of JSON.
        if hasattr(data, 'getlist') and 'class_days' in data:
            import json
            values = data.getlist('class_days')
            if values and not str(values[0]).lstrip().startswith('['):
                from backend.validation import integer
                data = data.copy()
                data['class_days'] = json.dumps([integer(v, 'class_days', minimum=0, maximum=6) for v in values])
        return super().to_internal_value(data)

    teacher_name = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    is_member    = serializers.SerializerMethodField()

    class Meta:
        model  = Group
        fields = ('id', 'name', 'description', 'join_key', 'teacher', 'teacher_name',
                  'member_count', 'is_member', 'class_days', 'class_time',
                  'telegram_chat_id', 'language', 'is_individual', 'status', 'is_graduated', 'exam_ready',
                  'exam_ready_at', 'exam_ready_note', 'created_at')
        read_only_fields = ('join_key', 'teacher')

    def to_representation(self, instance):
        from .access import can_manage_group
        data = super().to_representation(instance)
        request = self.context.get('request')
        if not request or not can_manage_group(request.user, instance):
            data.pop('join_key', None)
            data.pop('telegram_chat_id', None)
        return data

    def validate_class_days(self, value):
        if not isinstance(value, list) or any(type(d) is not int or d not in range(7) for d in value):
            raise serializers.ValidationError('Use weekday integers from 0 to 6.')
        return sorted(set(value))

    def get_teacher_name(self, obj):
        return f'{obj.teacher.first_name} {obj.teacher.last_name}'.strip() or obj.teacher.username

    def get_member_count(self, obj):
        if hasattr(obj, 'active_member_count'):
            return obj.active_member_count
        return obj.memberships.filter(student__is_active=True).count()

    def get_is_member(self, obj):
        if hasattr(obj, 'viewer_is_member'):
            return obj.viewer_is_member
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.memberships.filter(student=request.user).exists()
        return False


class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Lesson
        fields = ('id', 'group', 'title', 'date', 'homework', 'homework_format', 'created_at', 'ended_at')
        read_only_fields = ('group', 'ended_at')

    def validate(self, attrs):
        from .homework_formatting import sanitize_homework
        if 'homework_format' in attrs and 'homework' not in attrs:
            raise serializers.ValidationError({'homework': 'Provide homework text when changing its format.'})
        if 'homework' in attrs:
            if len(attrs['homework']) > 100000:
                raise serializers.ValidationError({'homework': 'Homework is too long (maximum 100000 characters).'})
            format = attrs.get('homework_format', 'plain')
            attrs['homework_format'] = format
            if format == 'html':
                attrs['homework'] = sanitize_homework(attrs['homework'])
        return attrs



class GroupDayOffSerializer(serializers.ModelSerializer):
    class Meta:
        model  = GroupDayOff
        fields = ('id', 'group', 'date', 'reason', 'note', 'created_by', 'created_at')
        read_only_fields = ('group', 'created_by', 'created_at')


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model  = Attendance
        fields = ('id', 'lesson', 'student', 'student_name', 'present')
        read_only_fields = ('lesson', 'student')

    def get_student_name(self, obj):
        return f'{obj.student.first_name} {obj.student.last_name}'.strip() or obj.student.username


class AttendanceRecordSerializer(serializers.Serializer):
    student = serializers.IntegerField(min_value=1)
    present = serializers.BooleanField()


class BulkAttendanceSerializer(serializers.Serializer):
    records = AttendanceRecordSerializer(many=True)

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


class ScoreRecordSerializer(serializers.Serializer):
    student = serializers.IntegerField(min_value=1)
    value = serializers.IntegerField(min_value=0, max_value=5, allow_null=True)


class BulkScoreSerializer(serializers.Serializer):
    records = ScoreRecordSerializer(many=True)

    def validate_records(self, value):
        for r in value:
            if 'student' not in r or 'value' not in r:
                raise serializers.ValidationError('Each record needs student and value fields.')
            if r['value'] is not None and not (0 <= int(r['value']) <= 5):
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


class ExamResultSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    total        = serializers.IntegerField(read_only=True)
    max_score    = serializers.IntegerField(read_only=True)
    percentage   = serializers.IntegerField(read_only=True)

    class Meta:
        model  = ExamResult
        fields = ('id', 'student', 'student_name', 'scores', 'comments', 'absent', 'total', 'max_score', 'percentage')

    def get_student_name(self, obj):
        return f'{obj.student.first_name} {obj.student.last_name}'.strip() or obj.student.username


class ExamSerializer(serializers.ModelSerializer):
    def get_results(self, obj):
        from .access import can_manage_group
        request = self.context.get('request')
        if not request:
            return []
        rows = obj.results.all()
        user = request.user
        if not can_manage_group(user, obj.group):
            if user.role == 'parent':
                rows = rows.filter(student__parents__parent=user, student__academy_id=user.academy_id)
            else:
                rows = rows.filter(student=user)
        return ExamResultSerializer(rows, many=True).data

    results         = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    group_id        = serializers.IntegerField(source='group.id', read_only=True)
    group_name      = serializers.CharField(source='group.name', read_only=True)

    class Meta:
        model  = Exam
        fields = ('id', 'name', 'question_count', 'status', 'created_by_name',
                  'group_id', 'group_name', 'results', 'created_at')
        read_only_fields = ('status', 'created_at')

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ''
        return f'{obj.created_by.first_name} {obj.created_by.last_name}'.strip() or obj.created_by.username


class ExamSubmissionEntrySerializer(serializers.Serializer):
    student = serializers.IntegerField(min_value=1)
    absent = serializers.BooleanField(default=False)
    scores = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=5), default=list, max_length=500)
    comments = serializers.ListField(child=serializers.CharField(allow_blank=True, max_length=2000), default=list, max_length=500)

    def validate(self, data):
        if not data['absent'] and not data['scores']:
            raise serializers.ValidationError('Each present student needs at least one question.')
        return data


class ExamSubmissionSerializer(serializers.Serializer):
    results = ExamSubmissionEntrySerializer(many=True)
    finish = serializers.BooleanField(default=True)
