from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('groups', '0003_coins'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Topic',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='topics', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['name']},
        ),
        migrations.CreateModel(
            name='Question',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField()),
                ('answer_type', models.CharField(choices=[('mcq', 'Multiple Choice'), ('true_false', 'True / False'), ('open', 'Open Answer')], default='mcq', max_length=20)),
                ('points', models.PositiveIntegerField(default=1)),
                ('difficulty', models.CharField(choices=[('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard')], default='easy', max_length=10)),
                ('options', models.JSONField(blank=True, null=True)),
                ('correct_answer', models.CharField(blank=True, max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='questions', to=settings.AUTH_USER_MODEL)),
                ('topic', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='questions', to='quiz.topic')),
            ],
            options={'ordering': ['topic', 'points']},
        ),
        migrations.CreateModel(
            name='Game',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('timer_seconds', models.PositiveIntegerField(default=30)),
                ('team_count', models.PositiveIntegerField(default=2)),
                ('students_per_team', models.PositiveIntegerField(default=3)),
                ('status', models.CharField(choices=[('waiting', 'Waiting'), ('active', 'Active'), ('final', 'Final Round'), ('finished', 'Finished')], default='waiting', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='games', to='groups.group')),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='created_games', to=settings.AUTH_USER_MODEL)),
                ('questions', models.ManyToManyField(blank=True, related_name='games', to='quiz.question')),
            ],
        ),
        migrations.AddField(
            model_name='game',
            name='current_question',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='active_in_games', to='quiz.question'),
        ),
        migrations.AddField(
            model_name='game',
            name='double_question',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='double_in_games', to='quiz.question'),
        ),
        migrations.CreateModel(
            name='Team',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('score', models.IntegerField(default=0)),
                ('final_bet', models.IntegerField(blank=True, null=True)),
                ('game', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='teams', to='quiz.game')),
                ('members', models.ManyToManyField(blank=True, related_name='game_teams', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['name']},
        ),
        migrations.AddField(
            model_name='game',
            name='current_team',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='quiz.team'),
        ),
        migrations.CreateModel(
            name='GameRound',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_correct', models.BooleanField(default=False)),
                ('is_stolen', models.BooleanField(default=False)),
                ('points_awarded', models.IntegerField(default=0)),
                ('is_double', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('game', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rounds', to='quiz.game')),
                ('picked_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='picked_rounds', to='quiz.team')),
                ('question', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rounds', to='quiz.question')),
                ('stolen_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='stolen_rounds', to='quiz.team')),
            ],
        ),
    ]
