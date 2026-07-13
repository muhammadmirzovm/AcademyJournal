import os
import logging
import urllib.request
import urllib.parse
import json
from datetime import timedelta
from django.utils import timezone

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

MSG = {
    'uz': {
        'header':    "📅 *Haftalik hisobot* — {from_date} – {to_date}\n\n",
        'child':     "👤 *{name}*\n",
        'group':     "📚 {group}\n",
        'lessons':   "• Darslar: *{attended}/{total}* ta",
        'all_ok':    " ✅\n",
        'some_miss': " ⚠️\n",
        'score':     "• O'rtacha ball: *{score}/5*\n",
        'no_score':  "• Ball berilmagan\n",
        'coins':     "• Coinlar: *+{coins}* ta\n",
        'no_data':   "Bu hafta dars bo'lmadi.\n",
        'sep':       "\n",
    },
    'ru': {
        'header':    "📅 *Еженедельный отчёт* — {from_date} – {to_date}\n\n",
        'child':     "👤 *{name}*\n",
        'group':     "📚 {group}\n",
        'lessons':   "• Уроки: *{attended}/{total}* шт.",
        'all_ok':    " ✅\n",
        'some_miss': " ⚠️\n",
        'score':     "• Средний балл: *{score}/5*\n",
        'no_score':  "• Оценок не выставлено\n",
        'coins':     "• Монеты: *+{coins}* шт.\n",
        'no_data':   "На этой неделе уроков не было.\n",
        'sep':       "\n",
    },
}


def _send(token, chat_id, text):
    url = f'https://api.telegram.org/bot{token}/sendMessage'
    data = urllib.parse.urlencode({
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'Markdown',
    }).encode()
    req = urllib.request.Request(url, data=data, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            if not result.get('ok'):
                logger.warning('Telegram send failed chat=%s: %s', chat_id, result)
    except Exception as exc:
        logger.error('Telegram send error chat=%s: %s', chat_id, exc)


def _week_range():
    today = timezone.localdate()
    start = today - timedelta(days=today.weekday())   # Monday
    end   = start + timedelta(days=6)                 # Sunday
    return start, end


def _build_message(parent, week_start, week_end):
    from groups.models import GroupMembership, Attendance, Score, CoinTransaction

    lang = (getattr(parent, 'telegram_lang', None) or 'uz')
    lang = lang if lang in MSG else 'uz'
    m = MSG[lang]

    fmt = lambda d: d.strftime('%d.%m')
    text = m['header'].format(from_date=fmt(week_start), to_date=fmt(week_end))

    for ps in parent.children.select_related('student').all():
        child = ps.student
        name  = f'{child.first_name} {child.last_name}'.strip() or child.username
        text += m['child'].format(name=name)

        memberships = list(GroupMembership.objects.filter(student=child, group__is_graduated=False).select_related('group'))
        if not memberships:
            text += m['no_data'] + m['sep']
            continue

        for mem in memberships:
            group   = mem.group
            lessons = list(group.lessons.filter(date__gte=week_start, date__lte=week_end))

            text += m['group'].format(group=group.name)

            if not lessons:
                text += m['no_data']
                text += m['sep']
                continue

            attended = Attendance.objects.filter(
                lesson__in=lessons, student=child, present=True
            ).count()
            total = len(lessons)

            text += m['lessons'].format(attended=attended, total=total)
            text += m['all_ok'] if attended == total else m['some_miss']

            scores = list(Score.objects.filter(lesson__in=lessons, student=child).values_list('value', flat=True))
            if scores:
                avg = round(sum(scores) / len(scores), 1)
                text += m['score'].format(score=avg)
            else:
                text += m['no_score']

            coins = CoinTransaction.objects.filter(
                group=group, student=child,
                created_at__date__gte=week_start,
                created_at__date__lte=week_end,
            ).values_list('amount', flat=True)
            total_coins = sum(c for c in coins if c > 0)
            if total_coins:
                text += m['coins'].format(coins=total_coins)

            text += m['sep']

    return text


def run_weekly_report_for_academy(academy):
    from django.contrib.auth import get_user_model
    User = get_user_model()

    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not token:
        logger.warning('TELEGRAM_BOT_TOKEN not set')
        return

    week_start, week_end = _week_range()

    parents = User.objects.filter(
        academy=academy,
        role='parent',
        telegram_id__isnull=False,
    ).prefetch_related('children__student')

    sent = 0
    for parent in parents:
        if not parent.children.exists():
            continue
        text = _build_message(parent, week_start, week_end)
        _send(token, parent.telegram_id, text)
        sent += 1

    logger.info('Weekly report sent to %d parents in academy %s', sent, academy.name)


class Command(BaseCommand):
    help = 'Send weekly parent report for one or all academies'

    def add_arguments(self, parser):
        parser.add_argument('--academy-id', type=int)
        parser.add_argument('--force', action='store_true', help='Run for all academies')

    def handle(self, *args, **options):
        from academies.models import Academy

        if options.get('academy_id'):
            academies = Academy.objects.filter(id=options['academy_id'])
        elif options.get('force'):
            academies = Academy.objects.all()
        else:
            self.stderr.write('Use --academy-id <id> or --force')
            return

        for academy in academies:
            self.stdout.write(f'Sending weekly report: {academy.name}')
            run_weekly_report_for_academy(academy)
