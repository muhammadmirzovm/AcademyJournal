"""
Daily report management command.

Run every minute via Fly.io cron. Finds academies whose report_time matches
the current UTC minute, then sends attendance reports to admins and reminders
to teachers who haven't completed attendance for today's lessons.
"""

import os
import json
import logging
import urllib.request
import urllib.parse
from datetime import date, datetime, timezone

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()
logger = logging.getLogger(__name__)

# ── Translations ──────────────────────────────────────────────────────────────

REPORT_MSG = {
    'uz': {
        'report_header': (
            "📋 *Kunlik hisobot* — {date}\n"
            "🏫 Akademiya: {academy}\n\n"
        ),
        'group_ok': "✅ *{group}* — davomat belgilangan\n",
        'group_no_lesson': "📭 *{group}* — bugun dars yo'q (dars yaratilmagan)\n",
        'group_absent': (
            "⚠️ *{group}* (o'qituvchi: {teacher})\n"
            "  ❌ Davomat belgilanmagan\n"
            "  Kelmagan o'quvchilar: {absent}\n\n"
        ),
        'group_absent_none': (
            "⚠️ *{group}* (o'qituvchi: {teacher})\n"
            "  ❌ Davomat belgilanmagan\n\n"
        ),
        'no_groups': "Bugun dars bo'ladigan guruhlar yo'q.\n",
        'teacher_reminder': (
            "⏰ Eslatma: *{group}* guruhida bugun davomat belgilanmagan!\n"
            "AcademyJournal'ga kiring va davomatni belgilang."
        ),
    },
    'ru': {
        'report_header': (
            "📋 *Ежедневный отчёт* — {date}\n"
            "🏫 Академия: {academy}\n\n"
        ),
        'group_ok': "✅ *{group}* — посещаемость отмечена\n",
        'group_no_lesson': "📭 *{group}* — урока сегодня нет (урок не создан)\n",
        'group_absent': (
            "⚠️ *{group}* (учитель: {teacher})\n"
            "  ❌ Посещаемость не отмечена\n"
            "  Отсутствующие: {absent}\n\n"
        ),
        'group_absent_none': (
            "⚠️ *{group}* (учитель: {teacher})\n"
            "  ❌ Посещаемость не отмечена\n\n"
        ),
        'no_groups': "Сегодня нет групп с занятиями.\n",
        'teacher_reminder': (
            "⏰ Напоминание: в группе *{group}* посещаемость сегодня не отмечена!\n"
            "Войдите в AcademyJournal и отметьте посещаемость."
        ),
    },
}


def _send(token, chat_id, text):
    """Send a Telegram message synchronously."""
    url = f'https://api.telegram.org/bot{token}/sendMessage'
    payload = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'Markdown',
    }
    data = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(url, data=data, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            if not result.get('ok'):
                logger.warning('Telegram send failed for chat %s: %s', chat_id, result)
    except Exception as exc:
        logger.error('Telegram send error for chat %s: %s', chat_id, exc)


def _lang(user):
    lang = getattr(user, 'telegram_lang', None) or 'uz'
    return lang if lang in REPORT_MSG else 'uz'


class Command(BaseCommand):
    help = 'Send daily attendance reports to admins and reminders to teachers'

    def handle(self, *args, **options):
        from academies.models import Academy
        from groups.models import Group, Lesson, Attendance, GroupMembership

        token = os.environ.get('TELEGRAM_BOT_TOKEN')
        if not token:
            self.stderr.write('TELEGRAM_BOT_TOKEN not set — skipping')
            return

        now_utc = datetime.now(timezone.utc)
        today = date.today()
        weekday = today.weekday()  # 0=Mon … 6=Sun

        # Find academies whose report_time falls within the current 5-minute window.
        # GitHub Actions cron fires every 5 minutes, so we match any academy whose
        # report_time hour matches and whose minute is within [now, now+5).
        now_minutes = now_utc.hour * 60 + now_utc.minute
        academies = Academy.objects.filter(report_time__isnull=False)
        matched = [
            a for a in academies
            if a.report_time.hour * 60 + a.report_time.minute in range(now_minutes, now_minutes + 5)
        ]

        if not matched:
            self.stdout.write('No academies to report at this time.')
            return

        for academy in matched:
            self.stdout.write(f'Processing academy: {academy.name}')
            self._process_academy(academy, today, weekday, token, Lesson, Attendance, GroupMembership)

    def _process_academy(self, academy, today, weekday, token, Lesson, Attendance, GroupMembership):
        # Groups that have class today
        all_groups = academy.members.filter(
            role='teacher'
        ).values_list('taught_groups', flat=True)

        # Get all groups belonging to teachers in this academy
        from groups.models import Group
        groups_today = [
            g for g in Group.objects.filter(
                teacher__academy=academy
            ).select_related('teacher')
            if isinstance(g.class_days, list) and weekday in g.class_days
        ]

        # Find admins with Telegram
        admins = list(
            academy.members.filter(role='admin', telegram_id__isnull=False)
        )

        if not admins and not groups_today:
            return

        # Build report lines per group
        report_lines = []
        teacher_reminders = []  # list of (teacher_user, group_name)

        for group in groups_today:
            lesson = Lesson.objects.filter(group=group, date=today).first()

            if not lesson:
                report_lines.append(('no_lesson', group, None, []))
                continue

            # Get all members
            member_ids = list(
                GroupMembership.objects.filter(group=group).values_list('student_id', flat=True)
            )

            if not member_ids:
                report_lines.append(('ok', group, lesson, []))
                continue

            # Get attended student IDs
            attended_ids = set(
                Attendance.objects.filter(lesson=lesson, present=True).values_list('student_id', flat=True)
            )
            marked_ids = set(
                Attendance.objects.filter(lesson=lesson).values_list('student_id', flat=True)
            )

            # Attendance is considered incomplete if not all members have a record
            all_marked = set(member_ids).issubset(marked_ids)

            if all_marked:
                # Find absent students (present=False)
                absent_names = list(
                    Attendance.objects.filter(
                        lesson=lesson, present=False
                    ).select_related('student').values_list(
                        'student__first_name', 'student__last_name', 'student__username'
                    )
                )
                absent_display = [
                    f'{fn} {ln}'.strip() or un for fn, ln, un in absent_names
                ]
                report_lines.append(('ok_with_absent', group, lesson, absent_display))
            else:
                # Attendance not completed — find who is absent (not marked)
                from django.contrib.auth import get_user_model
                U = get_user_model()
                unmarked = U.objects.filter(
                    id__in=set(member_ids) - marked_ids
                ).values_list('first_name', 'last_name', 'username')
                absent_display = [
                    f'{fn} {ln}'.strip() or un for fn, ln, un in unmarked
                ]
                report_lines.append(('incomplete', group, lesson, absent_display))
                teacher_reminders.append(group.teacher)

        # ── Send report to each admin ──────────────────────────────────────
        for admin in admins:
            lang = _lang(admin)
            t = REPORT_MSG[lang]
            msg = t['report_header'].format(
                date=today.strftime('%d.%m.%Y'),
                academy=academy.name,
            )

            if not groups_today:
                msg += t['no_groups']
            else:
                for status, group, lesson, absent in report_lines:
                    teacher_name = (
                        f'{group.teacher.first_name} {group.teacher.last_name}'.strip()
                        or group.teacher.username
                    )
                    if status == 'no_lesson':
                        msg += t['group_no_lesson'].format(group=group.name)
                    elif status == 'ok_with_absent':
                        if absent:
                            msg += t['group_absent'].format(
                                group=group.name,
                                teacher=teacher_name,
                                absent=', '.join(absent),
                            )
                        else:
                            msg += t['group_ok'].format(group=group.name)
                    elif status == 'incomplete':
                        if absent:
                            msg += t['group_absent'].format(
                                group=group.name,
                                teacher=teacher_name,
                                absent=', '.join(absent),
                            )
                        else:
                            msg += t['group_absent_none'].format(
                                group=group.name,
                                teacher=teacher_name,
                            )

            _send(token, admin.telegram_id, msg)
            self.stdout.write(f'  Sent report to admin {admin.username}')

        # ── Send reminders to teachers who missed attendance ───────────────
        seen_teachers = set()
        for teacher in teacher_reminders:
            if teacher.id in seen_teachers:
                continue
            seen_teachers.add(teacher.id)

            if not teacher.telegram_id:
                continue

            # Collect group names for this teacher
            teacher_groups = [
                g.name for status, g, _, _ in report_lines
                if status == 'incomplete' and g.teacher_id == teacher.id
            ]

            lang = _lang(teacher)
            t = REPORT_MSG[lang]
            for gname in teacher_groups:
                msg = t['teacher_reminder'].format(group=gname)
                _send(token, teacher.telegram_id, msg)

            self.stdout.write(f'  Sent reminder to teacher {teacher.username}')
