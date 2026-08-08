from datetime import timedelta

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from purchases.models import Purchase

from .models import CoinSetting, CoinTransaction


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

        setting = CoinSetting.get()
        cutoff = timezone.now() - timedelta(days=30)
        student_txns = CoinTransaction.objects.filter(student__role='student')

        outstanding = student_txns.aggregate(s=Sum('amount'))['s'] or 0
        issued_30d = student_txns.filter(amount__gt=0, created_at__gte=cutoff).aggregate(s=Sum('amount'))['s'] or 0
        spent_30d = abs(student_txns.filter(
            type=CoinTransaction.Type.PURCHASE, created_at__gte=cutoff,
        ).aggregate(s=Sum('amount'))['s'] or 0)

        spend_by_category = list(
            Purchase.objects.exclude(status=Purchase.Status.EXPIRED)
            .values('reward__category')
            .annotate(coins=Sum('total_price'), purchase_count=Count('id'))
            .order_by('-coins')
        )
        for row in spend_by_category:
            row['category'] = row.pop('reward__category')

        return Response({
            'coin_value_som': setting.coin_value_som,
            'outstanding_balance': outstanding,
            'estimated_liability_som': outstanding * setting.coin_value_som,
            'issued_last_30_days': issued_30d,
            'spent_last_30_days': spent_30d,
            'spend_by_category': spend_by_category,
        })
