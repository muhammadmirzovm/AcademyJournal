from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('groups', '0014_add_is_graduated_to_group'),
    ]

    operations = [
        migrations.AlterField(
            model_name='group',
            name='class_time',
            field=models.CharField(
                max_length=11, blank=True,
                help_text='HH:MM-HH:MM lesson time range',
            ),
        ),
    ]
