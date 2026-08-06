from django.db import migrations
from django.utils import timezone


def _rewards():
    now = timezone.now()
    return [
        dict(name='Ichimlik (kichik)', icon='🥤', price=10, category='snack', status='available', sort_order=0, opened_at=now),
        dict(name='Ichimlik / shirinlik', icon='🍬', price=15, category='snack', status='available', sort_order=1, opened_at=now),
        dict(name='Snack + ichimlik seti', icon='🍿', price=25, category='snack', status='available', sort_order=2, opened_at=now),
        dict(name="Kupon 100 000 so'm", icon='🎫', price=150, category='coupon', status='coming_soon', sort_order=3),
        dict(name="Kupon 200 000 so'm", icon='🎫', price=280, category='coupon', status='coming_soon', sort_order=4),
    ]


INITIAL_REWARD_NAMES = [
    'Ichimlik (kichik)', 'Ichimlik / shirinlik', 'Snack + ichimlik seti',
    "Kupon 100 000 so'm", "Kupon 200 000 so'm",
]


def seed_rewards(apps, schema_editor):
    Reward = apps.get_model('rewards', 'Reward')
    for data in _rewards():
        Reward.objects.get_or_create(name=data['name'], defaults=data)


def unseed_rewards(apps, schema_editor):
    Reward = apps.get_model('rewards', 'Reward')
    Reward.objects.filter(name__in=INITIAL_REWARD_NAMES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('rewards', '0002_reward_image_alter_reward_category'),
    ]

    operations = [
        migrations.RunPython(seed_rewards, unseed_rewards),
    ]
