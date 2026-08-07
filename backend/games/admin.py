from django.contrib import admin
from .models import Game, GameResult


class GameResultInline(admin.TabularInline):
    model = GameResult
    extra = 0
    readonly_fields = ('student', 'place', 'effort', 'coins')
    can_delete = False


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ('group', 'date', 'status', 'is_big_day', 'is_individual', 'teacher', 'closed_at')
    list_filter  = ('status', 'is_big_day', 'is_individual')
    search_fields = ('group__name',)
    readonly_fields = ('applied_rules', 'started_at', 'closed_at')
    inlines = [GameResultInline]
