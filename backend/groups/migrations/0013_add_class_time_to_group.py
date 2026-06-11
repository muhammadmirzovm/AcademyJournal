from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('groups', '0012_add_absent_to_examresult'),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='class_time',
            field=models.CharField(blank=True, help_text='HH:MM lesson start time', max_length=5),
        ),
    ]
