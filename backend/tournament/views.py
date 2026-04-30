from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Tournament, Participant, Match
from .serializers import (
    TournamentSerializer, TournamentCreateSerializer, BracketSerializer, MatchSerializer
)


class TournamentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return TournamentCreateSerializer if self.request.method == 'POST' else TournamentSerializer

    def get_queryset(self):
        user = self.request.user
        from django.db.models import Q
        return Tournament.objects.filter(
            Q(created_by=user) | Q(participants__user=user)
        ).distinct()

    def create(self, request, *args, **kwargs):
        ser = TournamentCreateSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        tournament = ser.save()
        return Response(TournamentSerializer(tournament).data, status=status.HTTP_201_CREATED)


class TournamentDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = TournamentSerializer
    queryset           = Tournament.objects.all()
    lookup_field       = 'join_code'

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        data = TournamentSerializer(instance).data
        data['is_participant'] = instance.participants.filter(user=request.user).exists()
        data['is_creator']     = instance.created_by_id == request.user.id
        return Response(data)


class JoinTournamentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        join_code  = request.data.get('join_code', '').strip().upper()
        tournament = get_object_or_404(Tournament, join_code=join_code)

        if tournament.status != Tournament.WAITING:
            return Response({'detail': 'Tournament already started or finished.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if tournament.is_full:
            return Response({'detail': 'Tournament is full.'},
                            status=status.HTTP_400_BAD_REQUEST)

        participant, created = Participant.objects.get_or_create(
            tournament=tournament, user=request.user
        )
        # Return 200 whether newly joined or already a participant
        return Response(TournamentSerializer(tournament).data, status=status.HTTP_200_OK)


class TournamentBracketView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = BracketSerializer
    queryset           = Tournament.objects.prefetch_related(
        'rounds__matches__player1__user',
        'rounds__matches__player2__user',
        'rounds__matches__winner__user',
        'participants__user',
    )
    lookup_field = 'join_code'


class MatchDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = MatchSerializer
    queryset           = Match.objects.select_related(
        'round__tournament',
        'player1__user', 'player2__user', 'winner__user',
    )


class MatchWalkoverView(APIView):
    """Teacher-only: force-finish a match by picking the winner (or auto-pick if one slot is empty)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from django.utils import timezone
        from .bracket import advance_winner, check_round_complete, activate_next_round

        match = get_object_or_404(
            Match.objects.select_related('round__tournament', 'player1__user', 'player2__user'),
            pk=pk,
        )
        tournament = match.round.tournament

        if tournament.created_by_id != request.user.id:
            return Response({'detail': 'Only the teacher can do this.'}, status=status.HTTP_403_FORBIDDEN)
        if match.status == Match.FINISHED:
            return Response({'detail': 'Match already finished.'}, status=status.HTTP_400_BAD_REQUEST)

        winner_id = request.data.get('winner_id')
        p1 = match.player1
        p2 = match.player2

        # Determine winner: explicit pick → present player → player1 fallback
        if winner_id:
            winner = p1 if (p1 and p1.user_id == int(winner_id)) else p2
        elif p1 and not p2:
            winner = p1
        elif p2 and not p1:
            winner = p2
        else:
            winner = p1  # both present: default to p1

        if not winner:
            return Response({'detail': 'No players in this match yet.'}, status=status.HTTP_400_BAD_REQUEST)

        loser = p2 if winner == p1 else p1

        match.winner     = winner
        match.status     = Match.FINISHED
        match.finished_at = timezone.now()
        match.save()

        if loser:
            remaining = tournament.participants.filter(is_eliminated=False).count()
            loser.is_eliminated  = True
            loser.final_position = remaining
            loser.save()

        next_match = advance_winner(match)

        if check_round_complete(match.round):
            match.round.status = 'finished'
            match.round.save()
            next_round = activate_next_round(tournament)
            if not next_round:
                tournament.status = 'finished'
                tournament.save()
                if winner:
                    winner.final_position = 1
                    winner.save()

        from .serializers import BracketSerializer
        return Response(BracketSerializer(tournament).data)
