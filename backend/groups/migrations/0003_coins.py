from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('groups', '0002_alter_groupmembership_joined_at'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='coin_threshold',
            field=models.PositiveIntegerField(default=10),
        ),
        migrations.AddField(
            model_name='groupmembership',
            name='sticker_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name='CoinTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.IntegerField()),
                ('note', models.CharField(blank=True, max_length=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coin_transactions', to='groups.group')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coin_transactions', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
