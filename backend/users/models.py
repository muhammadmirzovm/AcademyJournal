from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    TEACHER = 'teacher'
    STUDENT = 'student'
    ADMIN   = 'admin'
    PARENT  = 'parent'
    ROLE_CHOICES = [
        (TEACHER, 'Teacher'),
        (STUDENT, 'Student'),
        (ADMIN,   'Admin'),
        (PARENT,  'Parent'),
    ]

    role      = models.CharField(max_length=10, choices=ROLE_CHOICES, default=STUDENT)
    bio       = models.TextField(blank=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    academy   = models.ForeignKey(
        'academies.Academy',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='members',
    )

    def __str__(self):
        return f'{self.username} ({self.role})'
