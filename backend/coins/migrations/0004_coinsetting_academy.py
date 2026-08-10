from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('academies', '0001_initial'),
        ('coins', '0003_remove_coinsetting_coin_value_som'),
    ]

    operations = [
        migrations.AddField(
            model_name='coinsetting',
            name='academy',
            field=models.OneToOneField(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='coin_setting', to='academies.academy'),
        ),
    ]
