from django.conf import settings
from django.db import models
from django.utils import timezone


class Purchase(models.Model):
    class Status(models.TextChoices):
        ACTIVE  = 'active',  'Kutilmoqda'
        ISSUED  = 'issued',  'Berildi'
        EXPIRED = 'expired', "Muddati o'tdi"

    student        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='purchases')
    reward         = models.ForeignKey('rewards.Reward', on_delete=models.CASCADE, related_name='purchases')
    quantity       = models.PositiveSmallIntegerField(default=1)
    price_at_order = models.PositiveIntegerField(help_text='1 dona narxining sotib olingan paytdagi nusxasi')
    total_price    = models.PositiveIntegerField()
    code           = models.CharField(max_length=6, unique=True, db_index=True)
    status         = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    issued_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at     = models.DateTimeField(auto_now_add=True)
    issued_at      = models.DateTimeField(null=True, blank=True)
    expires_at     = models.DateTimeField()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.student} — {self.reward.name} × {self.quantity} ({self.code})'

    @property
    def is_expired(self):
        return self.status == self.Status.ACTIVE and timezone.now() > self.expires_at
