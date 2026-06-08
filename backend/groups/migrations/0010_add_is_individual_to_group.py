from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('groups', '0009_add_language_to_group'),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='is_individual',
            field=models.BooleanField(default=False),
        ),
    ]
