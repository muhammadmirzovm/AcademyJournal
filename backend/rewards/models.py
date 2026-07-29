from django.db import models
from django.utils import timezone


class Reward(models.Model):
    LOW_STOCK_THRESHOLD = 5

    class Category(models.TextChoices):
        SNACK      = 'snack',      'Yengil taom'
        STATIONERY = 'stationery', 'Kantselyariya'
        MERCH      = 'merch',      'Merch'
        DISCOUNT   = 'discount',   'Chegirma'
        OTHER      = 'other',      'Boshqa'

    class Status(models.TextChoices):
        AVAILABLE    = 'available',    'Sotuvda'
        COMING_SOON  = 'coming_soon',  'Tez kunda'
        HIDDEN       = 'hidden',       'Yashirilgan'

    name        = models.CharField(max_length=120)
    description = models.CharField(max_length=200, blank=True)
    icon        = models.CharField(max_length=8, blank=True, help_text='Emoji, masalan: 🎁')
    price       = models.PositiveIntegerField(help_text='Narx — tangachada')
    stock       = models.PositiveIntegerField(default=0)
    category    = models.CharField(max_length=12, choices=Category.choices, default=Category.OTHER)
    status      = models.CharField(max_length=12, choices=Status.choices, default=Status.COMING_SOON)
    opened_at   = models.DateTimeField(null=True, blank=True)
    sort_order  = models.IntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'price', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.status == self.Status.AVAILABLE and self.opened_at is None:
            self.opened_at = timezone.now()
        super().save(*args, **kwargs)

    @property
    def is_coming_soon(self):
        return self.status == self.Status.COMING_SOON

    @property
    def is_sold_out(self):
        return self.stock <= 0

    @property
    def can_be_ordered(self):
        return self.status == self.Status.AVAILABLE and not self.is_sold_out

    @property
    def badge(self):
        if self.status == self.Status.COMING_SOON:
            return ('Tez kunda', 'badge-soon')
        if self.status == self.Status.AVAILABLE:
            if self.is_sold_out:
                return ('Tugadi', 'badge-soldout')
            if self.stock <= self.LOW_STOCK_THRESHOLD:
                return (f'Oxirgi {self.stock} ta', 'badge-low')
        return None
