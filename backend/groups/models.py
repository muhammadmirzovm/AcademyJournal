import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator


def generate_join_key():
    return uuid.uuid4().hex[:8].upper()


class Group(models.Model):
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='taught_groups')
    join_key = models.CharField(max_length=8, unique=True, default=generate_join_key)
    coin_threshold = models.PositiveIntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class GroupMembership(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    joined_at = models.DateTimeField(default=timezone.now)
    sticker_count = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('group', 'student')

    def __str__(self):
        return f'{self.student.username} in {self.group.name}'


class Lesson(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=200)
    date = models.DateField()
    homework = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.group.name} — {self.title}'


class Attendance(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='attendances')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attendances')
    present = models.BooleanField(default=False)

    class Meta:
        unique_together = ('lesson', 'student')

    def __str__(self):
        status = 'present' if self.present else 'absent'
        return f'{self.student.username} — {self.lesson.title} ({status})'


class Score(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='scores')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='scores')
    value = models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(5)])

    class Meta:
        unique_together = ('lesson', 'student')

    def __str__(self):
        return f'{self.student.username} — {self.lesson.title}: {self.value}/5'


class Journal(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='journals')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='journals')
    body = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('lesson', 'student')

    def __str__(self):
        return f'{self.student.username} journal — {self.lesson.title}'


class HomeworkSubmission(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='homework_submissions')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='homework_submissions')
    body = models.TextField()
    submitted_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('lesson', 'student')

    def __str__(self):
        return f'{self.student.username} homework — {self.lesson.title}'


class Announcement(models.Model):
    author     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='announcements')
    group      = models.ForeignKey(Group, on_delete=models.CASCADE, null=True, blank=True, related_name='announcements')
    title      = models.CharField(max_length=200)
    body       = models.TextField(blank=True)
    is_pinned  = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_pinned', '-created_at']

    def __str__(self):
        scope = self.group.name if self.group else 'Academy'
        return f'[{scope}] {self.title}'


class CoinTransaction(models.Model):
    group   = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='coin_transactions')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='coin_transactions')
    amount  = models.IntegerField()
    note    = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.student.username} {self.amount:+d} coins in {self.group.name}'
