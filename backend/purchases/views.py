from django.db import transaction
from django.db.models import F, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from coins.models import CoinSetting, CoinTransaction
from groups.models import GroupMembership
from rewards.models import Reward

from .codes import generate_unique_code
from .models import Purchase
from .serializers import AdminPurchaseSerializer, PurchaseSerializer

# Not admin-configurable — a fixed anti-hoarding rule for the coupon
# category specifically, distinct from CoinSetting's other knobs.
COUPON_MAX_PER_STUDENT = 2

# How long after marking a purchase "issued" the admin can undo a mis-scan.
# Coins/stock are never touched by issue or undo-issue — both only move
# Purchase.status — so this is a low-risk correction window, not a refund.
UNDO_ISSUE_WINDOW_MINUTES = 10


class RewardPurchaseView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, reward_id):
        if request.user.role != 'student':
            return Response({'detail': "Faqat o'quvchi xarid qila oladi."}, status=403)

        try:
            quantity = int(request.data.get('quantity', 1))
        except (TypeError, ValueError):
            return Response({'detail': "Miqdor noto'g'ri."}, status=400)
        if quantity < 1:
            return Response({'detail': "Miqdor kamida 1 bo'lishi kerak."}, status=400)

        with transaction.atomic():
            reward = get_object_or_404(Reward.objects.select_for_update(), pk=reward_id, academy=request.user.academy)

            if reward.status != Reward.Status.AVAILABLE:
                return Response({'detail': "Bu mahsulot hozircha sotuvda emas."}, status=400)
            if reward.stock < quantity:
                return Response({'detail': f"Omborda faqat {reward.stock} dona qoldi."}, status=400)

            if reward.category == Reward.Category.COUPON:
                already = Purchase.objects.filter(
                    student=request.user, reward__category=Reward.Category.COUPON,
                ).exclude(status=Purchase.Status.EXPIRED).aggregate(total=Sum('quantity'))['total'] or 0
                if already + quantity > COUPON_MAX_PER_STUDENT:
                    return Response({
                        'detail': f"Kuponlardan kurs davomida faqat {COUPON_MAX_PER_STUDENT} tagacha xarid qilish mumkin.",
                    }, status=400)

            total = reward.price * quantity
            balance = CoinTransaction.balance_for(request.user)
            if balance < total:
                return Response({'detail': f"Yana {total - balance} tangacha kerak."}, status=400)

            Reward.objects.filter(pk=reward.pk).update(stock=F('stock') - quantity)

            CoinTransaction.objects.create(
                student=request.user, amount=-total, type=CoinTransaction.Type.PURCHASE,
                reason=f'{reward.name} × {quantity}', created_by=request.user,
            )

            setting = CoinSetting.get(request.user.academy)
            purchase = Purchase.objects.create(
                student=request.user, reward=reward, quantity=quantity,
                price_at_order=reward.price, total_price=total,
                code=generate_unique_code(),
                expires_at=timezone.now() + timezone.timedelta(days=setting.purchase_expires_days),
            )

        return Response(PurchaseSerializer(purchase, context={'request': request}).data, status=201)


class MyPurchasesView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        purchases = Purchase.objects.filter(student=request.user).select_related('reward')
        return Response(PurchaseSerializer(purchases, many=True, context={'request': request}).data)


class AdminPurchaseListView(APIView):
    """Admin-only: paginated history of every purchase academy-wide, with
    each student's current group(s) for context — powers the purchase list
    on the coin report page."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != 'admin':
            return Response({'detail': "Faqat admin ko'ra oladi."}, status=403)

        qs = Purchase.objects.filter(student__academy=request.user.academy).select_related('student', 'reward').order_by('-created_at')
        page      = max(1, int(request.query_params.get('page', 1)))
        page_size = max(1, min(50, int(request.query_params.get('page_size', 20))))
        total     = qs.count()
        pages     = max(1, (total + page_size - 1) // page_size)
        page      = min(page, pages)
        purchases = list(qs[(page - 1) * page_size: page * page_size])

        group_map = {}
        for m in GroupMembership.objects.filter(student_id__in=[p.student_id for p in purchases]).select_related('group'):
            group_map.setdefault(m.student_id, []).append(m.group.name)

        data = AdminPurchaseSerializer(purchases, many=True, context={'request': request}).data
        for row, purchase in zip(data, purchases):
            row['student_groups'] = group_map.get(purchase.student_id, [])

        return Response({'results': data, 'total': total, 'pages': pages, 'page': page})


class PurchaseLookupView(APIView):
    """Admin scanner: look up a purchase by its redemption code."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, code):
        if request.user.role != 'admin':
            return Response({'detail': "Faqat admin tekshira oladi."}, status=403)

        code = code.strip().upper()
        purchase = Purchase.objects.filter(code=code, student__academy=request.user.academy).select_related('student', 'reward').first()
        if not purchase:
            return Response({'detail': "Bunday kod topilmadi."}, status=404)

        return Response(AdminPurchaseSerializer(purchase, context={'request': request}).data)


class PurchaseIssueView(APIView):
    """Admin scanner: mark a purchase as issued (sovg'a berildi)."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        if request.user.role != 'admin':
            return Response({'detail': "Faqat admin belgilay oladi."}, status=403)

        with transaction.atomic():
            purchase = get_object_or_404(
                Purchase.objects.select_for_update().select_related('student', 'reward'),
                pk=pk, student__academy=request.user.academy,
            )

            if purchase.status == Purchase.Status.ISSUED:
                return Response({'detail': "Bu xarid allaqachon berilgan."}, status=400)
            if purchase.status == Purchase.Status.EXPIRED or purchase.is_expired:
                return Response({'detail': "Bu xaridning muddati o'tgan."}, status=400)

            purchase.status = Purchase.Status.ISSUED
            purchase.issued_by = request.user
            purchase.issued_at = timezone.now()
            purchase.save(update_fields=['status', 'issued_by', 'issued_at'])

        return Response(AdminPurchaseSerializer(purchase, context={'request': request}).data)


class PurchaseUndoIssueView(APIView):
    """Admin scanner: undo an accidental 'issued' marking (mis-scan/mis-click).

    Only flips status back to ACTIVE — coins and stock were already deducted
    at purchase time, not issue time, so there's nothing to refund here."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        if request.user.role != 'admin':
            return Response({'detail': "Faqat admin bekor qila oladi."}, status=403)

        with transaction.atomic():
            purchase = get_object_or_404(
                Purchase.objects.select_for_update().select_related('student', 'reward'),
                pk=pk, student__academy=request.user.academy,
            )

            if purchase.status != Purchase.Status.ISSUED:
                return Response({'detail': "Bu xarid \"berildi\" deb belgilanmagan."}, status=400)

            elapsed = timezone.now() - purchase.issued_at
            if elapsed > timezone.timedelta(minutes=UNDO_ISSUE_WINDOW_MINUTES):
                return Response({
                    'detail': f"Faqat berilgandan keyingi {UNDO_ISSUE_WINDOW_MINUTES} daqiqa ichida bekor qilish mumkin.",
                }, status=400)

            purchase.status = Purchase.Status.ACTIVE
            purchase.issued_by = None
            purchase.issued_at = None
            purchase.save(update_fields=['status', 'issued_by', 'issued_at'])

        return Response(AdminPurchaseSerializer(purchase, context={'request': request}).data)
