import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Academy(models.Model):
    name          = models.CharField(max_length=120)
    slug          = models.SlugField(unique=True)
    logo          = models.ImageField(upload_to='academy_logos/', blank=True, null=True)
    primary_color = models.CharField(max_length=7, default='#0D9488')
    created_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='owned_academies',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'academies'

    def __str__(self):
        return self.name


class InviteToken(models.Model):
    ROLE_CHOICES = [
        ('teacher', 'Teacher'),
        ('student', 'Student'),
        ('admin',   'Admin'),
        ('parent',  'Parent'),
    ]

    token      = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    academy    = models.ForeignKey(Academy, on_delete=models.CASCADE, related_name='invite_tokens')
    group      = models.ForeignKey(
        'groups.Group',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='invite_tokens',
    )
    role       = models.CharField(max_length=10, choices=ROLE_CHOICES)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_invites',
    )
    expires_at = models.DateTimeField()
    max_uses   = models.PositiveIntegerField(default=1)
    use_count  = models.PositiveIntegerField(default=0)
    used_by    = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='used_invites',
    )
    note       = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_valid(self):
        return self.use_count < self.max_uses and self.expires_at > timezone.now()

    def __str__(self):
        return f'{self.role} invite for {self.academy.name} [{self.token}]'
