from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('groups', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='groupmembership',
            name='joined_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
    ]
