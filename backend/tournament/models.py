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
        "The sun sets slowly over the calm blue ocean on a warm summer evening. Children play along the shore, laughing as the waves wash over their feet. The smell of salt fills the air as seagulls circle overhead. Families gather on the beach to watch the golden light fade behind the horizon.",
        "Birds fly south when winter comes and return again every spring to build their nests. They sing early in the morning before the rest of the world wakes up. Some birds travel thousands of miles without stopping to rest. It is one of the greatest journeys in the natural world.",
        "A good book can change the way you see and understand the world around you. Stories allow us to live many lives in the space of a single afternoon. The best books stay with you long after you have turned the last page. Reading every day is one of the simplest habits that can improve your life.",
        "She walks to school every morning whether it rains or shines outside. Along the way she passes the old bakery where fresh bread fills the street with warmth. She always stops to pet the friendly dog that sits by the wooden gate. These small moments make her morning feel complete and full of life.",
        "Learning new skills takes time patience and a willingness to make mistakes along the way. Nobody becomes an expert on their first attempt at something difficult. The key is to keep going even when progress feels slow or impossible. Every mistake teaches you something that success never could.",
        "Every morning the baker wakes up before sunrise to prepare fresh bread for the entire town. The dough must be kneaded carefully and left to rise in a warm corner of the kitchen. By the time the sun comes up the whole street smells of baked bread and butter. Neighbors arrive early hoping to get the first warm loaf.",
        "The mountains stand tall and silent above the quiet valley below. Snow covers their peaks even during the warmest months of the year. Hikers climb the steep trails looking for the view from the top. Standing at the summit you can see for hundreds of miles in every direction.",
    ],
    'medium': [
        "Programming is the art of telling a computer what to do in a clear and precise way. It requires logical thinking, attention to detail, and the patience to debug problems that arise. Every program starts as an idea and transforms through writing, testing, and refining code. The best programmers write code that is not only correct but easy for others to read and maintain.",
        "Django makes it easier to build better web applications more quickly and with less code than ever before. It follows the principle of convention over configuration, so developers spend less time making decisions about structure. The built-in admin panel, ORM, and authentication system give you a strong foundation from the start. With Django you can go from an idea to a working prototype in just a few hours.",
        "Speed and accuracy are the two pillars of great typing and both require consistent daily practice. When you first start learning to type properly your speed will slow down before it speeds up. This is normal and happens because your brain is forming new muscle memory patterns in your fingers. Over time your hands will know where each key is without you needing to look at the keyboard.",
        "Python is a high-level language known for its simple syntax and readability across many different domains. It is used in web development, data science, automation, artificial intelligence, and scientific research. The large standard library means you can accomplish complex tasks with just a few lines of code. Learning Python is often recommended as the best first programming language for beginners.",
        "The best way to learn software development is by writing actual code, making mistakes, and understanding exactly why they happen. Reading books and watching tutorials can only take you so far before you need to build real projects. Choose something you care about and try to build it even if you do not know how yet. The process of figuring things out is where the real learning takes place.",
        "Good software design requires thinking about the user first and the technology second at every stage. Features that seem technically impressive often fail because they do not solve a real problem people have. The most successful products are simple, fast, and do exactly what users expect without confusion. Start with the simplest solution and only add complexity when the problem truly demands it.",
        "Version control systems like Git allow developers to collaborate across teams and track every change made over time. You can go back to any previous version of your code if something breaks unexpectedly after a change. Branching lets you work on new features without affecting the stable version others depend on. Understanding Git well is one of the most valuable skills a developer can have.",
    ],
    'hard': [
        "Real-time applications require careful architectural design of both backend and frontend systems to handle concurrent WebSocket connections efficiently at scale. Each connected client maintains a persistent socket that the server must track and manage without blocking other operations. Django Channels solves this by running an asynchronous layer alongside the traditional synchronous Django request cycle. Properly managing channel groups, message routing, and disconnection cleanup is critical to building a reliable real-time experience.",
        "WebSockets provide a persistent full-duplex communication channel over a single TCP connection, enabling real-time bidirectional data exchange between client and server. Unlike HTTP polling, which opens a new connection for every request, a WebSocket handshake upgrades an existing HTTP connection and keeps it open indefinitely. This dramatically reduces latency and server overhead for applications that require frequent updates such as live games, chat, and collaborative editing. Implementing proper heartbeat mechanisms and reconnection logic is essential for production-grade WebSocket applications.",
        "Asynchronous programming paradigms, particularly async and await patterns in Python, fundamentally change how developers reason about input and output bound concurrency. Instead of blocking a thread while waiting for a database query or network response, the event loop can switch to another coroutine and resume the first one when the result is ready. This allows a single process to handle thousands of concurrent connections that would otherwise require thousands of threads. Understanding when to use async code and when synchronous code is actually more appropriate is a skill that comes with experience.",
        "The Fisher-Yates shuffle produces an unbiased random permutation of a finite sequence in linear time, making it ideal for generating fair tournament brackets at any scale. Naive shuffling approaches introduce subtle biases that skew the distribution of outcomes in ways that are hard to detect without statistical testing. The algorithm works by iterating from the last element to the first and swapping each element with a randomly chosen element at or before its current position. This simple change guarantees that every possible permutation of the sequence is equally likely to be produced.",
        "Distributed systems must carefully balance consistency, availability, and partition tolerance according to the CAP theorem, often requiring difficult and context-specific architectural trade-offs. In the presence of a network partition the system must choose between serving potentially stale data or refusing to respond at all until consistency can be guaranteed. Most modern distributed databases choose availability over strict consistency and instead offer eventual consistency with configurable conflict resolution strategies. Designing for these trade-offs requires a deep understanding of how your application actually uses data and what errors users can tolerate.",
        "Database indexing strategies dramatically affect query performance and choosing the wrong approach can make an application feel fast in development but painfully slow under real production load. Composite indexes, partial indexes, and covering indexes each suit different access patterns and must be chosen based on how queries are actually written. Adding too many indexes increases write overhead and storage requirements while too few indexes cause full table scans on every read. Regularly reviewing query plans with tools like EXPLAIN ANALYZE is essential for keeping a database performing well as data grows.",
        "Containerization with Docker and orchestration with Kubernetes enable reproducible deployments and horizontal scaling across heterogeneous infrastructure environments. Each container packages an application together with all of its dependencies into an isolated unit that runs consistently regardless of the underlying host operating system. Kubernetes manages the scheduling, health checking, and scaling of these containers across a cluster of machines automatically. Adopting these technologies introduces operational complexity but pays off significantly as systems grow and deployment frequency increases.",
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
