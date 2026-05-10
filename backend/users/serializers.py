from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    email    = serializers.EmailField(required=False, allow_blank=True, default='')

    class Meta:
        model  = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'password', 'role')

    def create(self, validated_data):
        role = validated_data.pop('role', User.STUDENT)
        user = User.objects.create_user(**validated_data)
        user.role = role
        user.save(update_fields=['role'])
        return user


class UserSerializer(serializers.ModelSerializer):
    academy_name  = serializers.CharField(source='academy.name', read_only=True)
    academy_color = serializers.CharField(source='academy.primary_color', read_only=True)
    has_password  = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'bio', 'academy', 'academy_name', 'academy_color',
            'has_password',
        )

    def get_has_password(self, obj):
        return obj.has_usable_password()


class UserStatsSerializer(serializers.Serializer):
    score_trend        = serializers.ListField()
    attendance_summary = serializers.DictField()
