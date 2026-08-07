from django.conf import settings
from django.db import models


class Game(models.Model):
    """The 'winning game' a teacher runs at the end of a lesson to award
    coins — not to be confused with quiz.Game (the Kahoot-style quiz)."""

    class Status(models.TextChoices):
        NOT_STARTED = 'not_started', 'Boshlanmagan'
        IN_PROGRESS = 'in_progress', 'Davom etmoqda'
        CLOSED      = 'closed',      'Yakunlangan'

    lesson        = models.OneToOneField('groups.Lesson', on_delete=models.CASCADE, related_name='game')
    group         = models.ForeignKey('groups.Group', on_delete=models.CASCADE, related_name='coin_games')
    teacher       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    date          = models.DateField()
    is_big_day    = models.BooleanField(default=False)
    is_individual = models.BooleanField(default=False)
    status        = models.CharField(max_length=12, choices=Status.choices, default=Status.NOT_STARTED)

    first  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    second = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    third  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    # Snapshot of CoinSetting rates taken at start-time — coin math always
    # reads from here, never from the live CoinSetting, so a later change
    # to the settings can never retroactively alter a past game.
    applied_rules = models.JSONField(null=True, blank=True)
    started_at    = models.DateTimeField(null=True, blank=True)
    closed_at     = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('group', 'date')
        ordering = ['-date']

    def __str__(self):
        return f'{self.group.name} — {self.date} ({self.status})'


class GameResult(models.Model):
    class Effort(models.IntegerChoices):
        NONE = 0, 'Qatnashmadi'
        OK   = 1, 'Harakat qildi'
        GOOD = 2, 'Yaxshi harakat qildi'

    game    = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='results')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='game_results')
    place   = models.PositiveSmallIntegerField(null=True, blank=True)
    effort  = models.IntegerField(choices=Effort.choices, default=Effort.OK)
    coins   = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('game', 'student')

    def __str__(self):
        return f'{self.student} — {self.game} ({self.coins:+d})'
