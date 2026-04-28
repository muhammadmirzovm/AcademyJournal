from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import tournament.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Tournament',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('join_code', models.CharField(default=tournament.models.generate_join_code, max_length=10, unique=True)),
                ('text', models.TextField()),
                ('time_limit', models.PositiveIntegerField(default=60)),
                ('max_players', models.PositiveSmallIntegerField(choices=[(4, '4 players'), (8, '8 players'), (16, '16 players')], default=8)),
                ('status', models.CharField(choices=[('waiting', 'Waiting'), ('active', 'Active'), ('finished', 'Finished')], default='waiting', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='created_tournaments', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='Participant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('is_eliminated', models.BooleanField(default=False)),
                ('final_position', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('best_wpm', models.FloatField(default=0)),
                ('best_accuracy', models.FloatField(default=0)),
                ('tournament', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='participants', to='tournament.tournament')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tournament_entries', to=settings.AUTH_USER_MODEL)),
            ],
            options={'unique_together': {('tournament', 'user')}},
        ),
        migrations.CreateModel(
            name='TournamentRound',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('round_number', models.PositiveSmallIntegerField()),
                ('round_name', models.CharField(max_length=30)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('active', 'Active'), ('finished', 'Finished')], default='pending', max_length=10)),
                ('tournament', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rounds', to='tournament.tournament')),
            ],
            options={'ordering': ['round_number']},
        ),
        migrations.CreateModel(
            name='Match',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('active', 'Active'), ('finished', 'Finished'), ('bye', 'Bye')], default='pending', max_length=10)),
                ('match_number', models.PositiveSmallIntegerField(default=1)),
                ('p1_wpm', models.FloatField(blank=True, null=True)),
                ('p1_accuracy', models.FloatField(blank=True, null=True)),
                ('p2_wpm', models.FloatField(blank=True, null=True)),
                ('p2_accuracy', models.FloatField(blank=True, null=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('round', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='matches', to='tournament.tournamentround')),
                ('player1', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='matches_as_p1', to='tournament.participant')),
                ('player2', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='matches_as_p2', to='tournament.participant')),
                ('winner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='matches_won', to='tournament.participant')),
            ],
            options={'ordering': ['match_number']},
        ),
    ]
