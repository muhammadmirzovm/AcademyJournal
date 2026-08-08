from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum


class CoinSetting(models.Model):
    """Singleton — use CoinSetting.get(), never .objects.create() directly."""

    # Oddiy kun
    place_1_normal    = models.PositiveIntegerField(default=5)
    place_2_normal    = models.PositiveIntegerField(default=4)
    place_3_normal    = models.PositiveIntegerField(default=3)
    effort_min_normal = models.PositiveIntegerField(default=1)
    effort_max_normal = models.PositiveIntegerField(default=2)

    # Hafta oxiri (katta kun)
    place_1_big    = models.PositiveIntegerField(default=10)
    place_2_big    = models.PositiveIntegerField(default=8)
    place_3_big    = models.PositiveIntegerField(default=6)
    effort_min_big = models.PositiveIntegerField(default=2)
    effort_max_big = models.PositiveIntegerField(default=4)

    # Individual dars
    individual_normal = models.PositiveIntegerField(default=3)
    individual_big    = models.PositiveIntegerField(default=6)

    # Qoidalar
    big_days              = models.CharField(max_length=20, default='4,5', help_text="Vergul bilan ajratilgan hafta kunlari: 0=dushanba ... 6=yakshanba")
    min_group_for_3rd     = models.PositiveIntegerField(default=6)
    max_games_per_week    = models.PositiveIntegerField(default=3)
    edit_window_hours      = models.PositiveIntegerField(default=24)
    purchase_expires_days  = models.PositiveIntegerField(default=14)

    # Faqat hisobot/moliyaviy baholash uchun — o'yin hisob-kitobiga ta'sir qilmaydi.
    coin_value_som = models.PositiveIntegerField(
        default=0, help_text="1 tangachaning taxminiy real qiymati (so'mda) — faqat hisobot sahifasida ishlatiladi.",
    )

    class Meta:
        verbose_name = 'Tangacha sozlamasi'
        verbose_name_plural = 'Tangacha sozlamalari'

    def __str__(self):
        return 'Tangacha sozlamalari'

    @classmethod
    def get(cls):
        return cls.objects.first() or cls.objects.create()


class CoinTransaction(models.Model):
    """Append-only ledger. Never updated or deleted — balance is always
    derived via balance_for(), and a mistake is corrected with a new
    reversing entry (type=ADJUSTMENT), not by editing an old row."""

    class Type(models.TextChoices):
        GAME_PLACE  = 'game_place',  "O'yin — o'rin"
        GAME_EFFORT = 'game_effort', "O'yin — harakat"
        PURCHASE    = 'purchase',    'Xarid'
        REFUND      = 'refund',      'Qaytarish'
        ADJUSTMENT  = 'adjustment',  'Tuzatish'

    student    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='coin_ledger')
    amount     = models.IntegerField()
    type       = models.CharField(max_length=20, choices=Type.choices)
    reason     = models.CharField(max_length=200)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['student', '-created_at'])]

    def __str__(self):
        return f'{self.student} {self.amount:+d} ({self.type})'

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError('CoinTransaction yozuvlari tahrirlanmaydi — teskari yozuv qo\'shing.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('CoinTransaction yozuvlari o\'chirilmaydi — teskari yozuv qo\'shing.')

    @staticmethod
    def balance_for(student):
        return CoinTransaction.objects.filter(student=student).aggregate(s=Sum('amount'))['s'] or 0
