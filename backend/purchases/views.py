from django.db import transaction
from django.db.models import F, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from coins.models import CoinSetting, CoinTransaction
from rewards.models import Reward

from .codes import generate_unique_code
from .models import Purchase
from .serializers import PurchaseSerializer

# Not admin-configurable — a fixed anti-hoarding rule for the coupon
# category specifically, distinct from CoinSetting's other knobs.
COUPON_MAX_PER_STUDENT = 2


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
            reward = get_object_or_404(Reward.objects.select_for_update(), pk=reward_id)

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

            setting = CoinSetting.get()
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
