from django.db import migrations, models
import django.db.models.deletion


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
        ('academies', '0001_initial'),
        ('rewards', '0003_seed_initial_rewards'),
    ]

    operations = [
        migrations.AddField(
            model_name='reward',
            name='academy',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='rewards', to='academies.academy'),
        ),
        migrations.RunPython(assign_academy, noop),
        migrations.AlterField(
            model_name='reward',
            name='academy',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rewards', to='academies.academy'),
        ),
    ]
