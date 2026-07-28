from django.contrib import admin
from .models import Group, GroupMembership, Lesson, Attendance, Score, Journal, GroupDayOff

@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'teacher', 'join_key', 'created_at')
    search_fields = ('name', 'join_key')

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'group', 'date')
    list_filter = ('group',)

@admin.register(GroupDayOff)
class GroupDayOffAdmin(admin.ModelAdmin):
    list_display = ('group', 'date', 'reason', 'created_by', 'created_at')
    list_filter = ('reason', 'group')

admin.site.register(GroupMembership)
admin.site.register(Attendance)
admin.site.register(Score)
admin.site.register(Journal)
