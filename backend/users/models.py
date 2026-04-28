from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    TEACHER = 'teacher'
    STUDENT = 'student'
    ROLE_CHOICES = [(TEACHER, 'Teacher'), (STUDENT, 'Student')]

    role      = models.CharField(max_length=10, choices=ROLE_CHOICES, default=STUDENT)
    bio       = models.TextField(blank=True)
    last_seen = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'{self.username} ({self.role})'
