import random
import string
from django.db import models
from django.conf import settings


def generate_join_code():
    chars = string.ascii_uppercase + string.digits
    code = ''.join(random.choices(chars, k=6))
    return f'TRN-{code}'


SAMPLE_TEXTS = {
    'easy': [
        "The sun sets slowly over the calm blue ocean on a warm summer evening.",
        "Birds fly south when winter comes and return again every spring.",
        "A good book can change the way you see and understand the world.",
        "She walks to school every morning whether it rains or shines outside.",
        "The cat sat on the warm windowsill watching the street below all day.",
        "Learning new skills takes time patience and a willingness to make mistakes.",
        "Every morning the baker wakes up early to prepare fresh bread for the town.",
    ],
    'medium': [
        "Programming is the art of telling a computer what to do in a clear and precise way.",
        "Django makes it easier to build better web applications more quickly and with less code.",
        "Speed and accuracy are the two pillars of great typing. Practice every day to improve both.",
        "Python is a high-level language known for its simple syntax and readability across many domains.",
        "The best way to learn is by writing actual code, making mistakes, and understanding why they happen.",
        "Good software design requires thinking about the user first and the technology second.",
        "Version control systems like Git allow developers to collaborate and track changes over time.",
    ],
    'hard': [
        "Real-time applications require careful architectural design of both backend and frontend to handle concurrent WebSocket connections efficiently.",
        "WebSockets provide a persistent full-duplex communication channel over a single TCP connection, enabling real-time bidirectional data exchange.",
        "Asynchronous programming paradigms, particularly async/await patterns in Python, fundamentally change how developers reason about I/O-bound concurrency.",
        "The Fisher-Yates shuffle produces an unbiased random permutation of a finite sequence in O(n) time, ideal for generating tournament brackets.",
        "Distributed systems must balance consistency, availability, and partition tolerance per the CAP theorem, often requiring difficult architectural trade-offs.",
        "Database indexing strategies dramatically affect query performance; composite indexes, partial indexes, and covering indexes each suit different access patterns.",
        "Containerization with Docker and orchestration with Kubernetes enable reproducible deployments and horizontal scaling across heterogeneous infrastructure.",
    ],
}


def pick_random_text(difficulty='random'):
    if difficulty in SAMPLE_TEXTS:
        return random.choice(SAMPLE_TEXTS[difficulty])
    all_texts = [t for pool in SAMPLE_TEXTS.values() for t in pool]
    return random.choice(all_texts)


class Tournament(models.Model):
    WAITING  = 'waiting'
    ACTIVE   = 'active'
    FINISHED = 'finished'
    STATUS_CHOICES = [(WAITING, 'Waiting'), (ACTIVE, 'Active'), (FINISHED, 'Finished')]

    MAX_CHOICES = [(4, '4 players'), (8, '8 players'), (16, '16 players')]

    name       = models.CharField(max_length=120)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_tournaments')
    join_code  = models.CharField(max_length=10, unique=True, default=generate_join_code)
    text       = models.TextField()
    time_limit = models.PositiveIntegerField(default=60)
    max_players= models.PositiveSmallIntegerField(default=8, choices=MAX_CHOICES)
    status     = models.CharField(max_length=10, choices=STATUS_CHOICES, default=WAITING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} [{self.join_code}]'

    @property
    def participant_count(self):
        return self.participants.count()

    @property
    def is_full(self):
        return self.participants.count() >= self.max_players


class Participant(models.Model):
    tournament     = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='participants')
    user           = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tournament_entries')
    joined_at      = models.DateTimeField(auto_now_add=True)
    is_eliminated  = models.BooleanField(default=False)
    final_position = models.PositiveSmallIntegerField(null=True, blank=True)
    best_wpm       = models.FloatField(default=0)
    best_accuracy  = models.FloatField(default=0)

    class Meta:
        unique_together = ('tournament', 'user')

    def __str__(self):
        return f'{self.user.username} @ {self.tournament.join_code}'


class TournamentRound(models.Model):
    PENDING  = 'pending'
    ACTIVE   = 'active'
    FINISHED = 'finished'
    STATUS_CHOICES = [(PENDING, 'Pending'), (ACTIVE, 'Active'), (FINISHED, 'Finished')]

    tournament   = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='rounds')
    round_number = models.PositiveSmallIntegerField()
    round_name   = models.CharField(max_length=30)
    status       = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)

    class Meta:
        ordering = ['round_number']

    def __str__(self):
        return f'{self.tournament.name} — {self.round_name}'


class Match(models.Model):
    PENDING  = 'pending'
    ACTIVE   = 'active'
    FINISHED = 'finished'
    BYE      = 'bye'
    STATUS_CHOICES = [
        (PENDING,  'Pending'),
        (ACTIVE,   'Active'),
        (FINISHED, 'Finished'),
        (BYE,      'Bye'),
    ]

    round        = models.ForeignKey(TournamentRound, on_delete=models.CASCADE, related_name='matches')
    player1      = models.ForeignKey(Participant, null=True, blank=True, on_delete=models.SET_NULL, related_name='matches_as_p1')
    player2      = models.ForeignKey(Participant, null=True, blank=True, on_delete=models.SET_NULL, related_name='matches_as_p2')
    winner       = models.ForeignKey(Participant, null=True, blank=True, on_delete=models.SET_NULL, related_name='matches_won')
    status       = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)
    match_number = models.PositiveSmallIntegerField(default=1)
    p1_wpm       = models.FloatField(null=True, blank=True)
    p1_accuracy  = models.FloatField(null=True, blank=True)
    p2_wpm       = models.FloatField(null=True, blank=True)
    p2_accuracy  = models.FloatField(null=True, blank=True)
    started_at   = models.DateTimeField(null=True, blank=True)
    finished_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['match_number']

    def __str__(self):
        p1 = self.player1.user.username if self.player1 else 'BYE'
        p2 = self.player2.user.username if self.player2 else 'BYE'
        return f'{self.round.round_name} M{self.match_number}: {p1} vs {p2}'
