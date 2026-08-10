from django.db import migrations


def assign_academy(apps, schema_editor):
    """Existing rewards predate per-academy isolation — attach them all to
    the first Academy, safe for both local dev (one test academy) and
    production (exactly one real academy today). If no Academy exists yet
    (e.g. a fresh test database where migrations run before any fixture
    creates one), create a placeholder rather than deleting seeded data."""
    Reward = apps.get_model('rewards', 'Reward')
    Academy = apps.get_model('academies', 'Academy')

    if not Reward.objects.filter(academy__isnull=True).exists():
        return
    academy = Academy.objects.order_by('id').first()
    if academy is None:
        academy = Academy.objects.create(name='Default Academy', slug='default-academy')
    Reward.objects.filter(academy__isnull=True).update(academy_id=academy.id)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('rewards', '0004_reward_academy'),
    ]

    operations = [
        migrations.RunPython(assign_academy, noop),
    ]
