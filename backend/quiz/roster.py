"""Remove withdrawn students from unfinished quiz rosters; preserve history."""
from django.db import transaction

from groups.access import current_memberships
from groups.models import Group
from .models import Game, Team


@transaction.atomic
def prune_unfinished_rosters(group_id):
    group = Group.objects.select_for_update().filter(pk=group_id).first()
    if group is None:
        return
    eligible = current_memberships(group).values('student_id')
    games = Game.objects.filter(group=group).exclude(status=Game.FINISHED)
    links = Team.members.through.objects.filter(team__game__in=games)
    links.exclude(user_id__in=eligible).delete()
    empty_teams = Team.objects.filter(game__in=games, members__isnull=True)
    games.filter(current_team__in=empty_teams).update(current_team=None, current_question=None)
    if group.is_individual:
        empty_teams.update(name='Student')
