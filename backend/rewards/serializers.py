from rest_framework import serializers
from .models import Reward


class RewardSerializer(serializers.ModelSerializer):
    badge = serializers.SerializerMethodField()

    class Meta:
        model = Reward
        fields = (
            'id', 'name', 'description', 'icon', 'image', 'price', 'stock',
            'category', 'status', 'sort_order', 'badge', 'created_at',
        )
        read_only_fields = ('id', 'created_at')

    def get_badge(self, obj):
        badge = obj.badge
        if not badge:
            return None
        label, kind = badge
        return {'label': label, 'kind': kind}
