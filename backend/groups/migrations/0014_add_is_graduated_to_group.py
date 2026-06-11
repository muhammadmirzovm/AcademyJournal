from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('groups', '0013_add_class_time_to_group'),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='is_graduated',
            field=models.BooleanField(default=False),
        ),
    ]
