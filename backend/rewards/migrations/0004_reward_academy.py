from django.db import migrations, models
import django.db.models.deletion


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
    ]
