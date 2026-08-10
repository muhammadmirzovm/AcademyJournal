from django.contrib import admin
from django.shortcuts import redirect
from django.utils.safestring import mark_safe
from .models import CoinSetting, CoinTransaction


@admin.register(CoinSetting)
class CoinSettingAdmin(admin.ModelAdmin):
    fieldsets = (
        (None, {
            'fields': ('live_preview',),
            'description': "⚠️ Bu o'zgarish faqat KEYINGI o'yinlarga ta'sir qiladi — har bir o'yin boshlanganda "
                            "shu sozlamalardan nusxa (\"snapshot\") olinadi, eski o'yinlar o'zgarmaydi.",
        }),
        ("Oddiy kun", {
            'fields': ('place_1_normal', 'place_2_normal', 'place_3_normal', 'effort_min_normal', 'effort_max_normal'),
        }),
        ("Katta kun (dam olish)", {
            'fields': ('place_1_big', 'place_2_big', 'place_3_big', 'effort_min_big', 'effort_max_big', 'big_days'),
        }),
        ("Individual dars", {
            'fields': ('individual_normal', 'individual_big'),
        }),
        ("Qoidalar", {
            'fields': ('min_group_for_3rd', 'max_games_per_week', 'edit_window_hours', 'purchase_expires_days'),
        }),
    )
    readonly_fields = ('live_preview',)

    class Media:
        js = ('coins/admin_preview.js',)

    @admin.display(description='Jonli oldindan ko\'rish')
    def live_preview(self, obj):
        return mark_safe('<div id="coin-live-preview" style="font-size:14px;font-weight:600;color:#008E00">…</div>')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(academy=request.user.academy)

    def has_add_permission(self, request):
        if not request.user.academy:
            return False
        return not CoinSetting.objects.filter(academy=request.user.academy).exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        if not request.user.academy:
            self.message_user(request, "Sizning hisobingiz hech qanday akademiyaga bog'lanmagan.", level='error')
            return redirect('admin:index')
        obj = CoinSetting.get(request.user.academy)
        return redirect('admin:coins_coinsetting_change', obj.pk)


@admin.register(CoinTransaction)
class CoinTransactionAdmin(admin.ModelAdmin):
    list_display  = ('student', 'amount', 'type', 'reason', 'created_by', 'created_at')
    list_filter   = ('type',)
    search_fields = ('student__username', 'student__first_name', 'student__last_name', 'reason')
    readonly_fields = ('created_at',)
    autocomplete_fields = ('student',)

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
