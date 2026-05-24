"""
Daily report: find teachers who had class today but did NOT create a lesson.
Runs every 5 minutes via GitHub Actions; matches academy report_time within a 5-min window.
"""

import os
import json
import logging
import urllib.request
import urllib.parse
from datetime import date, datetime, timezone

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

MSG = {
    'uz': {
        'header':    "📋 *Kunlik hisobot* — {date}\n🏫 {academy}\n\n",
        'no_groups': "Bugun darsi bo'ladigan guruhlar yo'q.",
        'intro_bad': "❌ *Bugun dars yaratmagan o'qituvchilar:*\n",
        'intro_ok':  "\n✅ *Dars yaratgan o'qituvchilar:*\n",
        'bad_row':   "• {teacher} — {group}\n",
        'ok_row':    "• {teacher} — {group}\n",
        'all_ok':    "✅ Barcha o'qituvchilar bugun dars yaratdi!",
        'reminder':  (
            "⏰ Eslatma!\n\n"
            "*{group}* guruhida bugun dars bo'lishi kerak edi, "
            "lekin siz hali dars yaratmadingiz.\n"
            "AcademyJournal'ga kiring va dars yarating."
        ),
    },
    'ru': {
        'header':    "📋 *Ежедневный отчёт* — {date}\n🏫 {academy}\n\n",
        'no_groups': "Сегодня нет групп с занятиями.",
        'intro_bad': "❌ *Учителя, не создавшие урок сегодня:*\n",
        'intro_ok':  "\n✅ *Создали урок:*\n",
        'bad_row':   "• {teacher} — {group}\n",
        'ok_row':    "• {teacher} — {group}\n",
        'all_ok':    "✅ Все учителя создали урок сегодня!",
        'reminder':  (
            "⏰ Напоминание!\n\n"
            "В группе *{group}* сегодня должно быть занятие, "
            "но вы ещё не создали урок.\n"
            "Войдите в AcademyJournal и создайте урок."
        ),
    },
}


def _send(token, chat_id, text):
    url = f'https://api.telegram.org/bot{token}/sendMessage'
    data = urllib.parse.urlencode({'chat_id': chat_id, 'text': text, 'parse_mode': 'Markdown'}).encode()
    req = urllib.request.Request(url, data=data, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            if not result.get('ok'):
                logger.warning('Telegram send failed chat=%s: %s', chat_id, result)
    except Exception as exc:
        logger.error('Telegram send error chat=%s: %s', chat_id, exc)


def _lang(user):
    lang = getattr(user, 'telegram_lang', None) or 'uz'
    return lang if lang in MSG else 'uz'


class Command(BaseCommand):
    help = 'Report teachers who had class today but did not create a lesson'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Run for all academies ignoring report_time')

    def handle(self, *args, **options):
        from academies.models import Academy
        from groups.models import Group, Lesson

        token = os.environ.get('TELEGRAM_BOT_TOKEN')
        if not token:
            self.stderr.write('TELEGRAM_BOT_TOKEN not set — skipping')
            return

        now_utc = datetime.now(timezone.utc)
        today = date.today()
        weekday = today.weekday()  # 0=Mon … 6=Sun

        if options.get('force'):
            matched = list(Academy.objects.filter(report_time__isnull=False))
            self.stdout.write(f'--force: {len(matched)} academies')
        else:
            now_min = now_utc.hour * 60 + now_utc.minute
            matched = [
                a for a in Academy.objects.filter(report_time__isnull=False)
                if a.report_time.hour * 60 + a.report_time.minute in range(now_min - 4, now_min + 1)
            ]

        if not matched:
            self.stdout.write('No academies to report at this time.')
            return

        for academy in matched:
            self.stdout.write(f'Processing: {academy.name}')
            self._report(academy, today, weekday, token, Group, Lesson)

    def _report(self, academy, today, weekday, token, Group, Lesson):
        # All groups of this academy that have class today
        groups_today = [
            g for g in
            Group.objects.filter(teacher__academy=academy).select_related('teacher')
            if isinstance(g.class_days, list) and weekday in g.class_days
        ]

        # Admins with Telegram
        admins = list(academy.members.filter(role='admin', telegram_id__isnull=False))
        if not admins:
            self.stdout.write('  No admins with Telegram — skipping')
            return

        # Classify each group: did the teacher create a lesson today?
        no_lesson = []   # (group, teacher_name)
        has_lesson = []  # (group, teacher_name)

        for g in groups_today:
            t_name = f'{g.teacher.first_name} {g.teacher.last_name}'.strip() or g.teacher.username
            if Lesson.objects.filter(group=g, date=today).exists():
                has_lesson.append((g, t_name))
            else:
                no_lesson.append((g, t_name))

        # ── Send to each admin ─────────────────────────────────────────────
        for admin in admins:
            m = MSG[_lang(admin)]
            msg = m['header'].format(date=today.strftime('%d.%m.%Y'), academy=academy.name)

            if not groups_today:
                msg += m['no_groups']
            elif not no_lesson:
                msg += m['all_ok']
            else:
                msg += m['intro_bad']
                for g, t in no_lesson:
                    msg += m['bad_row'].format(teacher=t, group=g.name)
                if has_lesson:
                    msg += m['intro_ok']
                    for g, t in has_lesson:
                        msg += m['ok_row'].format(teacher=t, group=g.name)

            _send(token, admin.telegram_id, msg)
            self.stdout.write(f'  Report sent to admin {admin.username}')

        # ── Remind teachers who missed creating a lesson ───────────────────
        for g, t_name in no_lesson:
            if not g.teacher.telegram_id:
                continue
            m = MSG[_lang(g.teacher)]
            msg = m['reminder'].format(group=g.name)
            _send(token, g.teacher.telegram_id, msg)
            self.stdout.write(f'  Reminder sent to teacher {g.teacher.username}')
