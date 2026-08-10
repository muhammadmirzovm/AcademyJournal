from django.db import migrations


def assign_academy(apps, schema_editor):
    """There is at most one CoinSetting row before this migration (it was a
    global singleton). Attach it to the first Academy — safe for both local
    dev (one test academy) and production (exactly one real academy today).
    If no Academy exists yet, create a placeholder rather than deleting it."""
    CoinSetting = apps.get_model('coins', 'CoinSetting')
    Academy = apps.get_model('academies', 'Academy')

    setting = CoinSetting.objects.first()
    if setting is None:
        return
    academy = Academy.objects.order_by('id').first()
    if academy is None:
        academy = Academy.objects.create(name='Default Academy', slug='default-academy')
    setting.academy_id = academy.id
    setting.save(update_fields=['academy_id'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('coins', '0004_coinsetting_academy'),
    ]

    operations = [
        migrations.RunPython(assign_academy, noop),
    ]
