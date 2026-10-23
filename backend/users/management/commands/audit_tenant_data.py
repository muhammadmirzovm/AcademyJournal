"""Read-only checks for legacy ownership that migrations cannot infer."""
import json

from django.core.management.base import BaseCommand, CommandError
from django.db.models import F, Q


class Command(BaseCommand):
    help = 'Report orphaned or inconsistent academy ownership without changing records.'

    def add_arguments(self, parser):
        parser.add_argument('--strict', action='store_true', help='Exit unsuccessfully when records require review.')

    def handle(self, *args, **options):
        from academies.models import InviteToken
        from coins.models import CoinTransaction
        from groups.models import Announcement, Group, GroupMembership
        from quiz.models import Topic
        from users.models import ParentStudent

        problems = {
            'groups_without_academy': Group.objects.filter(academy__isnull=True).count(),
            'announcements_without_academy': Announcement.objects.filter(academy__isnull=True).count(),
            'topics_without_academy': Topic.objects.filter(academy__isnull=True).count(),
            'coin_transactions_without_academy': CoinTransaction.objects.filter(academy__isnull=True).count(),
            'invalid_group_memberships': GroupMembership.objects.filter(
                Q(student__academy__isnull=True) | Q(group__academy__isnull=True)
                | ~Q(student__academy_id=F('group__academy_id')) | ~Q(student__role='student')
            ).count(),
            'invalid_parent_links': ParentStudent.objects.filter(
                Q(parent__academy__isnull=True) | Q(student__academy__isnull=True)
                | ~Q(parent__academy_id=F('student__academy_id'))
                | ~Q(parent__role='parent') | ~Q(student__role='student')
            ).count(),
            'invalid_group_invites': InviteToken.objects.filter(group__isnull=False).filter(
                Q(group__academy__isnull=True) | ~Q(academy_id=F('group__academy_id'))
            ).count(),
            'invalid_parent_invites': InviteToken.objects.filter(student__isnull=False).filter(
                Q(student__academy__isnull=True) | ~Q(academy_id=F('student__academy_id'))
                | ~Q(student__role='student') | ~Q(role='parent')
            ).count(),
        }
        self.stdout.write(json.dumps(problems, sort_keys=True))
        if options['strict'] and any(problems.values()):
            raise CommandError('Some legacy records require academy ownership review; no data was changed.')
