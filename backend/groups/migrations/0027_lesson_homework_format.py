from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('groups', '0026_lesson_report_snapshot')]
    operations = [migrations.AddField(
        model_name='lesson', name='homework_format',
        field=models.CharField(choices=[('plain', 'Plain text'), ('html', 'Rich text')], default='plain', max_length=5),
    )]
