from django.db import migrations, models
import django.db.models.deletion


def backfill(apps, schema_editor):
    Transaction = apps.get_model('coins', 'CoinTransaction')
    alias = schema_editor.connection.alias
    for row in Transaction.objects.using(alias).select_related('student').iterator():
        Transaction.objects.using(alias).filter(pk=row.pk).update(academy_id=row.student.academy_id)


class Migration(migrations.Migration):
    dependencies = [('coins', '0006_coinsetting_academy_notnull')]
    operations = [
        migrations.AddField(model_name='cointransaction', name='academy', field=models.ForeignKey(
            null=True, blank=True, on_delete=django.db.models.deletion.CASCADE,
            related_name='coin_transactions', to='academies.academy')),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
