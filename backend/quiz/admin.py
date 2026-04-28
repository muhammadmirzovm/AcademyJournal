from django.contrib import admin
from .models import Topic, Question, Game, Team, GameRound

admin.site.register(Topic)
admin.site.register(Question)
admin.site.register(Game)
admin.site.register(Team)
admin.site.register(GameRound)
