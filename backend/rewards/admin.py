from django.contrib import admin
from django.utils.html import format_html
from .models import Reward

STATUS_COLORS = {
    Reward.Status.AVAILABLE:   '#008E00',
    Reward.Status.COMING_SOON: '#F59E0B',
    Reward.Status.HIDDEN:      '#94A3B8',
}


@admin.register(Reward)
class RewardAdmin(admin.ModelAdmin):
    list_display   = ('image_preview', 'name', 'price', 'stock', 'status_badge', 'category', 'sort_order')
    list_editable  = ('price', 'stock', 'sort_order')
    list_filter    = ('status', 'category')
    search_fields  = ('name', 'description')
    readonly_fields = ('opened_at', 'created_at', 'updated_at')
    actions        = ('make_available', 'make_coming_soon', 'make_hidden')

    @admin.display(description='')
    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="width:32px;height:32px;object-fit:cover;border-radius:6px">', obj.image.url)
        if obj.icon:
            return format_html('<span style="font-size:22px">{}</span>', obj.icon)
        return '—'

    @admin.display(description='Holat')
    def status_badge(self, obj):
        color = STATUS_COLORS.get(obj.status, '#94A3B8')
        return format_html(
            '<span style="padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;'
            'color:#fff;background:{}">{}</span>',
            color, obj.get_status_display(),
        )

    @admin.action(description='Sotuvga chiqarish')
    def make_available(self, request, queryset):
        # Iterate (not queryset.update()) so save() can stamp opened_at on first sale.
        for obj in queryset:
            obj.status = Reward.Status.AVAILABLE
            obj.save()

    @admin.action(description="'Tez kunda' qilish")
    def make_coming_soon(self, request, queryset):
        queryset.update(status=Reward.Status.COMING_SOON)

    @admin.action(description='Yashirish')
    def make_hidden(self, request, queryset):
        queryset.update(status=Reward.Status.HIDDEN)
