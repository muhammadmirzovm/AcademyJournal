import random
from .models import TournamentRound, Match

ROUND_NAMES = {
    16: ['Round of 16', 'Quarterfinals', 'Semifinals', 'Final'],
    8:  ['Quarterfinals', 'Semifinals', 'Final'],
    4:  ['Semifinals', 'Final'],
    2:  ['Final'],
}


def fisher_yates_shuffle(lst):
    arr = list(lst)
    for i in range(len(arr) - 1, 0, -1):
        j = random.randint(0, i)
        arr[i], arr[j] = arr[j], arr[i]
    return arr


def next_power_of_two(n):
    size = 2
    while size < n:
        size *= 2
    return max(size, 4)


def generate_bracket(tournament):
    """
    Fisher-Yates shuffle → pad to next power of 2 with BYE (None).
    Creates Round 1 matches; future rounds get empty placeholder matches.
    BYE winners are immediately advanced so TBD slots never appear.
    Returns list of created Match objects in round 1.
    """
    participants = list(tournament.participants.all())
    shuffled     = fisher_yates_shuffle(participants)

    size   = next_power_of_two(len(shuffled))
    padded = shuffled + [None] * (size - len(shuffled))

    names      = ROUND_NAMES.get(size, ['Final'])
    num_rounds = len(names)

    # ── Round 1 ──────────────────────────────────────────────────────────────
    r1 = TournamentRound.objects.create(
        tournament   = tournament,
        round_number = 1,
        round_name   = names[0],
        status       = TournamentRound.ACTIVE,
    )

    r1_matches = []
    for i in range(0, size, 2):
        p1 = padded[i]
        p2 = padded[i + 1]
        is_bye = p1 is None or p2 is None
        m = Match.objects.create(
            round        = r1,
            player1      = p1,
            player2      = p2,
            match_number = i // 2 + 1,
            status       = Match.BYE if is_bye else Match.PENDING,
        )
        if is_bye:
            m.winner = p1 or p2   # None if both are None
            m.status = Match.FINISHED
            m.save()
        r1_matches.append(m)

    # ── Future rounds (empty placeholders) ───────────────────────────────────
    for round_idx in range(1, num_rounds):
        tr = TournamentRound.objects.create(
            tournament   = tournament,
            round_number = round_idx + 1,
            round_name   = names[round_idx],
            status       = TournamentRound.PENDING,
        )
        matches_in_round = size // (2 ** (round_idx + 1))
        for mn in range(1, matches_in_round + 1):
            Match.objects.create(round=tr, match_number=mn, status=Match.PENDING)

    # ── Advance BYE winners immediately so no TBD slots appear ───────────────
    # Process non-null BYE winners first; the auto-bye cascade in advance_winner
    # handles the case where their future opponent is also a BYE null.
    for m in r1_matches:
        if m.status == Match.FINISHED and m.winner is not None:
            advance_winner(m)

    return r1_matches


def advance_winner(match):
    """
    After a match finishes: put the winner into the correct slot of the next round.
    If the other slot in the next match will never be filled (its source match is
    already finished with no winner), auto-advance as a BYE cascading upward.
    Returns the next-round Match if found, else None (tournament over).
    """
    current_round = match.round
    next_round    = TournamentRound.objects.filter(
        tournament   = current_round.tournament,
        round_number = current_round.round_number + 1,
    ).first()

    if not next_round:
        return None

    # Which slot in the next round? Each pair of matches feeds one next match.
    next_match_number = (match.match_number + 1) // 2
    next_match = Match.objects.filter(
        round        = next_round,
        match_number = next_match_number,
    ).first()

    if not next_match:
        return None

    # Skip if next match already finished (can happen with cascading BYEs)
    if next_match.status == Match.FINISHED:
        return next_match

    # Odd-numbered matches → player1 slot; even → player2 slot
    if match.match_number % 2 == 1:
        next_match.player1 = match.winner
    else:
        next_match.player2 = match.winner
    next_match.save()

    # Both slots filled → activate next match for real play
    if next_match.player1 and next_match.player2:
        next_match.status = Match.PENDING
        next_match.save()
        return next_match

    # One slot filled, other still null — check if sibling match can ever fill it.
    # Sibling: the other match in current round that feeds the same next-round match.
    sibling_number = (
        match.match_number + 1
        if match.match_number % 2 == 1
        else match.match_number - 1
    )
    sibling_finished = not Match.objects.filter(
        round        = current_round,
        match_number = sibling_number,
    ).exclude(status=Match.FINISHED).exists()

    if sibling_finished:
        # Sibling is done (or doesn't exist) and the slot is still null → auto-BYE
        present_player = next_match.player1 or next_match.player2
        if present_player:
            next_match.winner = present_player
            next_match.status = Match.FINISHED
            next_match.save()
            advance_winner(next_match)  # cascade up to next rounds

    return next_match


def check_round_complete(tournament_round):
    """Returns True if every match in this round is finished."""
    return not tournament_round.matches.exclude(status=Match.FINISHED).exists()


def activate_next_round(tournament):
    """Mark next pending round as active after current round finishes."""
    next_round = TournamentRound.objects.filter(
        tournament = tournament,
        status     = TournamentRound.PENDING,
    ).order_by('round_number').first()
    if next_round:
        next_round.status = TournamentRound.ACTIVE
        next_round.save()
    return next_round
