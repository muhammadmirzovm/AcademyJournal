import random
from django.db import models
from django.conf import settings


class Topic(models.Model):
    name       = models.CharField(max_length=100)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='topics')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Question(models.Model):
    MCQ        = 'mcq'
    TRUE_FALSE = 'true_false'
    OPEN       = 'open'
    ANSWER_TYPES = [(MCQ, 'Multiple Choice'), (TRUE_FALSE, 'True / False'), (OPEN, 'Open Answer')]

    EASY   = 'easy'
    MEDIUM = 'medium'
    HARD   = 'hard'
    DIFFICULTIES = [(EASY, 'Easy'), (MEDIUM, 'Medium'), (HARD, 'Hard')]

    topic          = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name='questions')
    text           = models.TextField()
    answer_type    = models.CharField(max_length=20, choices=ANSWER_TYPES, default=MCQ)
    points         = models.PositiveIntegerField(default=1)
    difficulty     = models.CharField(max_length=10, choices=DIFFICULTIES, default=EASY)
    options        = models.JSONField(null=True, blank=True)   # {'a':..,'b':..,'c':..,'d':..}
    correct_answer = models.CharField(max_length=500, blank=True)
    hint           = models.CharField(max_length=300, blank=True)
    created_by     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='questions')
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['topic', 'points']

    def __str__(self):
        return f'[{self.topic.name}] {self.text[:60]}'


class Game(models.Model):
    WAITING  = 'waiting'
    ACTIVE   = 'active'
    FINAL    = 'final'
    FINISHED = 'finished'
    STATUSES = [(WAITING, 'Waiting'), (ACTIVE, 'Active'), (FINAL, 'Final Round'), (FINISHED, 'Finished')]

    group            = models.ForeignKey('groups.Group', on_delete=models.CASCADE, related_name='games')
    name             = models.CharField(max_length=200)
    questions        = models.ManyToManyField(Question, blank=True, related_name='games')
    timer_seconds    = models.PositiveIntegerField(default=30)
    team_count       = models.PositiveIntegerField(default=2)
    students_per_team= models.PositiveIntegerField(default=3)
    status           = models.CharField(max_length=10, choices=STATUSES, default=WAITING)
    current_question = models.ForeignKey(Question, null=True, blank=True, on_delete=models.SET_NULL, related_name='active_in_games')
    current_team     = models.ForeignKey('Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    double_question  = models.ForeignKey(Question, null=True, blank=True, on_delete=models.SET_NULL, related_name='double_in_games')
    created_by       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_games')
    created_at       = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.group.name} — {self.name}'


class Team(models.Model):
    game      = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='teams')
    name      = models.CharField(max_length=100)
    members   = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='game_teams')
    score     = models.IntegerField(default=0)
    final_bet = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.game} — {self.name}'


class GameRound(models.Model):
    game           = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='rounds')
    question       = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='rounds')
    picked_by      = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='picked_rounds')
    stolen_by      = models.ForeignKey(Team, null=True, blank=True, on_delete=models.SET_NULL, related_name='stolen_rounds')
    is_correct     = models.BooleanField(default=False)
    is_stolen      = models.BooleanField(default=False)
    points_awarded = models.IntegerField(default=0)
    is_double      = models.BooleanField(default=False)
    created_at     = models.DateTimeField(auto_now_add=True)
