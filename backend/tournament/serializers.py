from rest_framework import serializers
from .models import Tournament, Participant, TournamentRound, Match


class ParticipantSerializer(serializers.ModelSerializer):
    username   = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    user_id    = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model  = Participant
        fields = ['id', 'user_id', 'username', 'first_name',
                  'is_eliminated', 'final_position', 'best_wpm', 'best_accuracy', 'joined_at']


class MatchSerializer(serializers.ModelSerializer):
    player1    = ParticipantSerializer(read_only=True)
    player2    = ParticipantSerializer(read_only=True)
    winner     = ParticipantSerializer(read_only=True)
    join_code  = serializers.CharField(source='round.tournament.join_code', read_only=True)
    round_name = serializers.CharField(source='round.round_name', read_only=True)
    time_limit = serializers.IntegerField(source='round.tournament.time_limit', read_only=True)
    text       = serializers.CharField(source='round.tournament.text', read_only=True)

    class Meta:
        model  = Match
        fields = ['id', 'match_number', 'status', 'join_code', 'round_name', 'time_limit', 'text',
                  'player1', 'player2', 'winner',
                  'p1_wpm', 'p1_accuracy', 'p2_wpm', 'p2_accuracy',
                  'started_at', 'finished_at']


class RoundSerializer(serializers.ModelSerializer):
    matches = MatchSerializer(many=True, read_only=True)

    class Meta:
        model  = TournamentRound
        fields = ['id', 'round_number', 'round_name', 'status', 'matches']


class TournamentSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    participant_count   = serializers.IntegerField(read_only=True)
    is_full             = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Tournament
        fields = ['id', 'name', 'join_code', 'text', 'time_limit', 'max_players',
                  'status', 'created_at', 'created_by_username',
                  'participant_count', 'is_full']
        read_only_fields = ['join_code', 'status', 'created_at']


class TournamentCreateSerializer(serializers.ModelSerializer):
    text            = serializers.CharField(required=False, allow_blank=True, default='')
    text_difficulty = serializers.ChoiceField(
        choices=['easy', 'medium', 'hard', 'random'],
        default='random', write_only=True, required=False,
    )

    class Meta:
        model  = Tournament
        fields = ['name', 'text', 'text_difficulty', 'time_limit', 'max_players']

    def create(self, validated_data):
        from .models import pick_random_text
        difficulty = validated_data.pop('text_difficulty', 'random')
        if not validated_data.get('text', '').strip():
            validated_data['text'] = pick_random_text(difficulty)
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class BracketSerializer(serializers.ModelSerializer):
    rounds       = RoundSerializer(many=True, read_only=True)
    participants = ParticipantSerializer(many=True, read_only=True)

    class Meta:
        model  = Tournament
        fields = ['id', 'name', 'join_code', 'status', 'time_limit',
                  'participants', 'rounds']
