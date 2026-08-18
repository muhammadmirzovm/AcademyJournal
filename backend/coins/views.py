from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from purchases.models import Purchase

from .models import CoinTransaction

User = get_user_model()


class MyBalanceView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response({'balance': CoinTransaction.balance_for(request.user)})


class CoinReportView(APIView):
    """Admin-only financial-exposure snapshot: how many coins are currently
    outstanding (owed to students as future redemptions), how fast coins are
    being issued vs. spent, and which reward categories are driving spend —
    so the academy can sanity-check the coin economy against a real budget."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'detail': 'Only an admin can view this report.'}, status=403)

        cutoff = timezone.now() - timedelta(days=30)
        student_txns = CoinTransaction.objects.filter(student__role='student', student__academy=request.user.academy)

        outstanding = student_txns.aggregate(s=Sum('amount'))['s'] or 0
        issued_30d = student_txns.filter(amount__gt=0, created_at__gte=cutoff).aggregate(s=Sum('amount'))['s'] or 0
        spent_30d = abs(student_txns.filter(
            type=CoinTransaction.Type.PURCHASE, created_at__gte=cutoff,
        ).aggregate(s=Sum('amount'))['s'] or 0)

        spend_by_category = list(
            Purchase.objects.filter(student__academy=request.user.academy)
            .exclude(status=Purchase.Status.EXPIRED)
            .values('reward__category')
            .annotate(coins=Sum('total_price'), purchase_count=Count('id'))
            .order_by('-coins')
        )
        for row in spend_by_category:
            row['category'] = row.pop('reward__category')

        return Response({
            'outstanding_balance': outstanding,
            'issued_last_30_days': issued_30d,
            'spent_last_30_days': spent_30d,
            'spend_by_category': spend_by_category,
        })


class CoinAdjustView(APIView):
    """Admin-only: bulk add or subtract coins for a chosen set of students
    (individual pick or a whole group, resolved to student ids by the
    frontend so the confirm step can show exactly who's affected). Each
    student gets their own reason-tagged ADJUSTMENT ledger entry — the
    in-app, no-Django-admin-required sibling of the "reset to 0" admin
    action."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        if request.user.role != 'admin':
            return Response({'detail': "Faqat admin tangacha qo'sha yoki ayira oladi."}, status=403)

        try:
            amount = int(request.data.get('amount'))
        except (TypeError, ValueError):
            return Response({'detail': "Miqdor noto'g'ri."}, status=400)
        if amount == 0:
            return Response({'detail': "Miqdor 0 bo'lishi mumkin emas."}, status=400)

        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'detail': "Sabab kiritilishi shart."}, status=400)

        student_ids = request.data.get('student_ids')
        if not isinstance(student_ids, list) or not student_ids:
            return Response({'detail': "Kamida bitta o'quvchi tanlanishi kerak."}, status=400)

        students = list(User.objects.filter(
            id__in=student_ids, role='student', academy=request.user.academy,
        ))
        if not students:
            return Response({'detail': "Tanlangan o'quvchilar topilmadi."}, status=400)

        CoinTransaction.objects.bulk_create([
            CoinTransaction(
                student=s, amount=amount, type=CoinTransaction.Type.ADJUSTMENT,
                reason=reason, created_by=request.user,
            ) for s in students
        ])

        return Response({'affected': len(students), 'amount': amount})
