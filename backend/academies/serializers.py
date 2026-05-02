from rest_framework import serializers
from .models import Academy, InviteToken


class AcademySerializer(serializers.ModelSerializer):
    class Meta:
        model  = Academy
        fields = ('id', 'name', 'slug', 'logo', 'primary_color', 'created_at')
        read_only_fields = ('created_at',)


class AcademyBrandSerializer(serializers.ModelSerializer):
    """Lightweight public-facing serializer (used on invite landing page)."""
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model  = Academy
        fields = ('id', 'name', 'primary_color', 'logo_url')

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None


class InviteTokenSerializer(serializers.ModelSerializer):
    academy_name = serializers.CharField(source='academy.name', read_only=True)
    is_valid     = serializers.SerializerMethodField()

    class Meta:
        model  = InviteToken
        fields = (
            'id', 'token', 'role', 'academy', 'academy_name',
            'group', 'expires_at', 'max_uses', 'use_count',
            'note', 'is_valid', 'created_at',
        )
        read_only_fields = ('token', 'use_count', 'created_at')

    def get_is_valid(self, obj):
        return obj.is_valid
