from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('groups', '0008_add_telegram_chat_id_to_group'),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='language',
            field=models.CharField(
                choices=[('uz', 'Uzbek'), ('ru', 'Russian')],
                default='uz',
                max_length=2,
            ),
        ),
    ]
