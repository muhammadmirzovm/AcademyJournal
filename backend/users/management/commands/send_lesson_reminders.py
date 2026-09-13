from datetime import datetime, timedelta

from asgiref.sync import async_to_sync
from django.core.management.base import BaseCommand
from django.db import IntegrityError
from django.utils import timezone


REMINDER_WINDOW = timedelta(minutes=1)


def _parse_start_time(class_time):
    if not class_time:
        return None
    try:
        start = class_time.split('-', 1)[0].strip()
        hour, minute = start.split(':', 1)
        return int(hour), int(minute)
    except (AttributeError, ValueError):
        return None


def _display_time(class_time):
    if not class_time:
        return ''
    return class_time.split('-', 1)[0].strip()


def _student_name(student):
    return f'{student.first_name} {student.last_name}'.strip() or student.username


def run_lesson_reminders(now=None):
    from groups.models import Group, GroupDayOff, GroupLessonReminder
    from users.models import Notification
    from users.telegram_bot import send_notification

    now = timezone.localtime(now or timezone.now())
    target_from = now + timedelta(hours=1)
    target_to = target_from + REMINDER_WINDOW
    local_tz = timezone.get_current_timezone()

    groups = Group.objects.filter(status=Group.ACTIVE).select_related('teacher')
    sent = 0

    for group in groups:
        start = _parse_start_time(group.class_time)
        if start is None:
            continue

        target_date = target_from.date()
        if not isinstance(group.class_days, list) or target_date.weekday() not in group.class_days:
            continue

        starts_at = timezone.make_aware(
            datetime.combine(target_date, datetime.min.time().replace(hour=start[0], minute=start[1])),
            local_tz,
        )
        if not (target_from <= starts_at < target_to):
            continue

        if GroupDayOff.objects.filter(group=group, date=target_date).exists():
            continue

        memberships = group.memberships.filter(
            student__is_active=True,
            joined_at__date__lte=target_date,
        ).select_related('student')

        for membership in memberships:
            student = membership.student
            try:
                GroupLessonReminder.objects.create(group=group, student=student, date=target_date)
            except IntegrityError:
                continue

            lang = student.telegram_lang or group.language or 'uz'
            if lang not in ('uz', 'ru'):
                lang = 'uz'
            start_label = _display_time(group.class_time)
            title = 'Dars eslatmasi' if lang == 'uz' else 'Напоминание об уроке'
            if lang == 'ru':
                body = f'Урок в группе {group.name} начнется через 1 час, в {start_label}.'
            else:
                body = f'{group.name} guruhida dars 1 soatdan keyin, {start_label} da boshlanadi.'

            Notification.objects.create(
                user=student,
                type=Notification.LESSON,
                title=title,
                body=body[:500],
            )
            if student.telegram_id:
                async_to_sync(send_notification)(
                    student.telegram_id,
                    'lesson_reminder',
                    lang,
                    name=_student_name(student),
                    group=group.name,
                    time=start_label,
                )
            sent += 1

    return sent


class Command(BaseCommand):
    help = 'Send student reminders one hour before scheduled lessons'

    def handle(self, *args, **options):
        sent = run_lesson_reminders()
        self.stdout.write(f'Sent {sent} lesson reminder(s)')
