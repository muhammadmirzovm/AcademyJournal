from rest_framework import serializers

from .models import CoinSetting


class CoinSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoinSetting
        fields = [
            'place_1_normal', 'place_2_normal', 'place_3_normal',
            'effort_min_normal', 'effort_max_normal',
            'place_1_big', 'place_2_big', 'place_3_big',
            'effort_min_big', 'effort_max_big',
            'individual_normal', 'individual_big',
            'big_days', 'min_group_for_3rd', 'max_games_per_week',
            'edit_window_hours', 'purchase_expires_days',
        ]

    def validate_big_days(self, value):
        parts = [p.strip() for p in value.split(',') if p.strip()]
        if not parts:
            return ''
        try:
            nums = [int(p) for p in parts]
        except ValueError:
            raise serializers.ValidationError("Hafta kunlari 0 (dushanba) dan 6 (yakshanba) gacha raqamlar bo'lishi kerak.")
        if any(n < 0 or n > 6 for n in nums):
            raise serializers.ValidationError("Hafta kunlari 0 dan 6 gacha bo'lishi kerak.")
        return ','.join(str(n) for n in sorted(set(nums)))

    def validate(self, data):
        for suffix in ('normal', 'big'):
            emin = data.get(f'effort_min_{suffix}', getattr(self.instance, f'effort_min_{suffix}', None))
            emax = data.get(f'effort_max_{suffix}', getattr(self.instance, f'effort_max_{suffix}', None))
            if emin is not None and emax is not None and emin > emax:
                raise serializers.ValidationError({
                    f'effort_min_{suffix}': "Minimal qiymat maksimaldan katta bo'lmasligi kerak.",
                })
        return data
