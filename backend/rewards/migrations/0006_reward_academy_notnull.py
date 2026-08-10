from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('rewards', '0005_reward_academy_backfill'),
    ]

    operations = [
        migrations.AlterField(
            model_name='reward',
            name='academy',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rewards', to='academies.academy'),
        ),
    ]
