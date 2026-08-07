from rest_framework import serializers
from .models import Purchase


class PurchaseSerializer(serializers.ModelSerializer):
    reward_name  = serializers.CharField(source='reward.name', read_only=True)
    reward_icon  = serializers.CharField(source='reward.icon', read_only=True)
    reward_image = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = (
            'id', 'reward', 'reward_name', 'reward_icon', 'reward_image', 'quantity',
            'price_at_order', 'total_price', 'code', 'status', 'created_at', 'issued_at', 'expires_at',
        )

    def get_reward_image(self, obj):
        if not obj.reward.image:
            return None
        request = self.context.get('request')
        url = obj.reward.image.url
        return request.build_absolute_uri(url) if request else url
