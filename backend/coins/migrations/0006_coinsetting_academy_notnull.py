from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('coins', '0005_coinsetting_academy_backfill'),
    ]

    operations = [
        migrations.AlterField(
            model_name='coinsetting',
            name='academy',
            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='coin_setting', to='academies.academy'),
        ),
    ]
