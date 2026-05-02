from django.contrib import admin
from .models import Academy, InviteToken


@admin.register(Academy)
class AcademyAdmin(admin.ModelAdmin):
    list_display        = ('name', 'slug', 'primary_color', 'created_by', 'created_at')
    prepopulated_fields = {'slug': ('name',)}
    search_fields       = ('name', 'slug')


@admin.register(InviteToken)
class InviteTokenAdmin(admin.ModelAdmin):
    list_display    = ('token', 'role', 'academy', 'group', 'use_count', 'max_uses', 'expires_at', 'created_by')
    list_filter     = ('role', 'academy')
    readonly_fields = ('token', 'use_count', 'used_by', 'created_at')
    search_fields   = ('note',)
