from django.contrib import admin
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from coins.models import CoinTransaction
from rewards.models import Reward
from .models import Purchase


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display   = ('code', 'student', 'reward', 'quantity', 'total_price', 'status', 'created_at', 'expires_at')
    list_filter    = ('status',)
    search_fields  = ('code', 'student__username', 'student__first_name', 'student__last_name', 'reward__name')
    readonly_fields = ('code', 'price_at_order', 'total_price', 'created_at', 'issued_at')
    actions        = ('mark_issued', 'expire_and_refund')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(student__academy=request.user.academy)

    @admin.action(description='Berildi deb belgilash')
    def mark_issued(self, request, queryset):
        for purchase in queryset.filter(status=Purchase.Status.ACTIVE):
            purchase.status = Purchase.Status.ISSUED
            purchase.issued_by = request.user
            purchase.issued_at = timezone.now()
            purchase.save(update_fields=['status', 'issued_by', 'issued_at'])

    @admin.action(description="Muddati tugagan deb belgilash (tangacha va zaxira qaytariladi)")
    def expire_and_refund(self, request, queryset):
        with transaction.atomic():
            for purchase in queryset.select_for_update().filter(status=Purchase.Status.ACTIVE):
                CoinTransaction.objects.create(
                    student=purchase.student, amount=purchase.total_price, type=CoinTransaction.Type.REFUND,
                    reason=f"Muddati o'tdi: {purchase.reward.name} × {purchase.quantity}", created_by=request.user,
                )
                Reward.objects.filter(pk=purchase.reward_id).update(stock=F('stock') + purchase.quantity)
                purchase.status = Purchase.Status.EXPIRED
                purchase.save(update_fields=['status'])
