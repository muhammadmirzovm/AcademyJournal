from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academies', '0006_add_language_to_academy_telegram_group'),
    ]

    operations = [
        migrations.AddField(
            model_name='academy',
            name='weekly_report_time',
            field=models.TimeField(
                blank=True, null=True,
                help_text='Weekly parent report time in UTC (sent every Sunday)',
            ),
        ),
    ]
