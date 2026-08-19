from django.contrib import admin, messages
from django.db.models import Sum
from django.contrib.auth.admin import UserAdmin
from django.template.response import TemplateResponse
from .models import User


def _balances_for(students):
    """One aggregate query for every student's balance, instead of a
    separate CoinTransaction.balance_for() query per student."""
    from coins.models import CoinTransaction

    by_id = {
        row['student']: row['balance']
        for row in CoinTransaction.objects.filter(student__in=students)
            .values('student').annotate(balance=Sum('amount'))
    }
    return {s.id: by_id.get(s.id, 0) for s in students}


@admin.action(description="Tangacha balansini 0 ga tushirish (tanlangan o'quvchilar)")
def reset_coin_balance(modeladmin, request, queryset):
    from coins.models import CoinTransaction

    students = list(queryset.filter(role=User.STUDENT))
    if not request.user.is_superuser:
        students = [s for s in students if s.academy_id == request.user.academy_id]

    balances = _balances_for(students)

    if 'apply' in request.POST:
        reset_count, already_zero = 0, 0
        txns = []
        for student in students:
            balance = balances[student.id]
            if balance != 0:
                txns.append(CoinTransaction(
                    student=student, amount=-balance,
                    type=CoinTransaction.Type.ADJUSTMENT,
                    reason="Balans 0 ga tushirildi (admin, ommaviy)",
                    created_by=request.user,
                ))
                reset_count += 1
            else:
                already_zero += 1
        CoinTransaction.objects.bulk_create(txns)
        modeladmin.message_user(
            request,
            f"{reset_count} ta o'quvchi balansi 0 ga tushirildi. "
            f"({already_zero} tasi allaqachon 0 edi.)",
            level=messages.SUCCESS,
        )
        return None

    rows = [(student, balances[student.id]) for student in students]
    total = sum(balances[student.id] for student in students)

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
