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

    def reverse_awarded_coins(self, actor=None):
        """Offsets coins this game handed out with a reversing ledger entry —
        called when the underlying lesson is deleted. Capped at the
        student's current balance so someone who already spent those coins
        (e.g. on a reward) is never pushed negative; already-redeemed coins
        simply aren't recoverable."""
        from django.db.models import Sum
        from coins.models import CoinTransaction

        results = list(self.results.filter(coins__gt=0).select_related('student'))
        if not results:
            return

        balances = {
            row['student']: row['balance']
            for row in CoinTransaction.objects.filter(student__in=[r.student for r in results])
                .values('student').annotate(balance=Sum('amount'))
        }

        txns = []
        for result in results:
            balance = balances.get(result.student_id, 0)
            reversal = min(result.coins, balance)
            if reversal <= 0:
                continue
            txns.append(CoinTransaction(
                student=result.student, amount=-reversal, type=CoinTransaction.Type.ADJUSTMENT,
                reason=f"Dars o'chirildi: {self.group.name} — {self.date}", created_by=actor,
            ))
        CoinTransaction.objects.bulk_create(txns)


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
