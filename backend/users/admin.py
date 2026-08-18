from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.template.response import TemplateResponse
from .models import User


@admin.action(description="Tangacha balansini 0 ga tushirish (tanlangan o'quvchilar)")
def reset_coin_balance(modeladmin, request, queryset):
    from coins.models import CoinTransaction

    students = queryset.filter(role=User.STUDENT)
    if not request.user.is_superuser:
        students = students.filter(academy=request.user.academy)

    if 'apply' in request.POST:
        reset_count, already_zero = 0, 0
        for student in students:
            balance = CoinTransaction.balance_for(student)
            if balance != 0:
                CoinTransaction.objects.create(
                    student=student, amount=-balance,
                    type=CoinTransaction.Type.ADJUSTMENT,
                    reason="Balans 0 ga tushirildi (admin, ommaviy)",
                    created_by=request.user,
                )
                reset_count += 1
            else:
                already_zero += 1
        modeladmin.message_user(
            request,
            f"{reset_count} ta o'quvchi balansi 0 ga tushirildi. "
            f"({already_zero} tasi allaqachon 0 edi.)",
            level=messages.SUCCESS,
        )
        return None

    rows, total = [], 0
    for student in students:
        balance = CoinTransaction.balance_for(student)
        rows.append((student, balance))
        total += balance

    return TemplateResponse(request, 'admin/users/reset_coins_confirm.html', {
        'students': rows,
        'total': total,
        'opts': modeladmin.model._meta,
    })


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'is_staff')
    list_filter = ('role', 'is_staff')
    fieldsets = UserAdmin.fieldsets + (
        ('Academy Journal', {'fields': ('role','bio')}),
    )
    actions = [reset_coin_balance]
