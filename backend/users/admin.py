from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Lead

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'is_staff')
    list_filter = ('role', 'is_staff')
    fieldsets = UserAdmin.fieldsets + (
        ('Academy Journal', {'fields': ('role','bio')}),
    )


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display    = ('name', 'username', 'phone', 'handled', 'created_at')
    list_filter     = ('handled', 'created_at')
    search_fields   = ('name', 'username', 'phone', 'message')
    list_editable   = ('handled',)
    readonly_fields = ('name', 'username', 'telegram_id', 'phone', 'message', 'created_at')
