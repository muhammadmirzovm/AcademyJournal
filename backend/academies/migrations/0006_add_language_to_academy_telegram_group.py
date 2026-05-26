from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('academies', '0005_remove_logo'),
    ]

    operations = [
        migrations.AddField(
            model_name='academytelegramgroup',
            name='language',
            field=models.CharField(
                choices=[('uz', 'Uzbek'), ('ru', 'Russian')],
                default='uz',
                max_length=2,
            ),
        ),
    ]
