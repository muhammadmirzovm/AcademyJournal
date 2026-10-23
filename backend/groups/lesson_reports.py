"""Compare persisted lesson edits with the last explicitly confirmed report."""
import hashlib
import json
import logging

from asgiref.sync import async_to_sync
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied

from .access import current_memberships, can_manage_group
from .models import Attendance, Group, Lesson, Score


class ReportChanged(APIException):
    status_code = 409
    default_detail = 'Lesson data changed. Review the latest preview before confirming.'


def snapshot(lesson):
    from games.models import GameResult
    members = list(current_memberships(lesson.group).select_related('student'))
    attendance = dict(Attendance.objects.filter(lesson=lesson).values_list('student_id', 'present'))
    scores = dict(Score.objects.filter(lesson=lesson).values_list('student_id', 'value'))
    coins = dict(GameResult.objects.filter(game__lesson=lesson).values_list('student_id', 'coins'))
    state = {
        'title': lesson.title, 'date': str(lesson.date), 'homework': lesson.homework,
        'students': {str(m.student_id): {
            'attendance': attendance.get(m.student_id),
            'score': scores.get(m.student_id), 'coins': coins.get(m.student_id, 0),
        } for m in members},
    }
    return state, members


def changes_since(lesson, state):
    previous = lesson.report_snapshot or state
    common = {key: {'old': previous.get(key), 'new': state[key]}
              for key in ('title', 'date', 'homework') if previous.get(key) != state[key]}
    students = {}
    for sid, values in state['students'].items():
        old = previous.get('students', {}).get(sid, {'attendance': None, 'score': None, 'coins': 0})
        fields = {key: {'old': old.get(key), 'new': value}
                  for key, value in values.items() if old.get(key) != value}
        if fields:
            students[sid] = fields
    return {'common': common, 'students': students}


def eligible_parents(student, group):
    return student.parents.filter(
        parent__is_active=True, parent__role='parent', parent__academy_id=group.academy_id,
    ).select_related('parent')


def prepare_preview(lesson):
    state, members = snapshot(lesson)
    changes = changes_since(lesson, state)
    is_update = lesson.ended_at is not None
    common = changes['common']
    everyone = not is_update or bool(common)
    parent_everyone = not is_update or bool(set(common) - {'homework'})
    affected = [m for m in members if everyone or str(m.student_id) in changes['students']]
    from users.models import ParentStudent
    parents = {}
    audience = {str(m.student_id): [] for m in members}
    for link in ParentStudent.objects.filter(
        student_id__in=[m.student_id for m in members], parent__is_active=True,
        parent__role='parent', parent__academy_id=lesson.group.academy_id,
    ).select_related('parent').order_by('parent_id'):
        sid = str(link.student_id)
        audience[sid].append(link.parent_id)
        if parent_everyone or sid in changes['students']:
            parents[link.parent_id] = link.parent
    has_changes = not is_update or bool(common or changes['students'])
    token = hashlib.sha256(json.dumps({
        'revision': lesson.report_revision, 'ended_at': str(lesson.ended_at),
        'state': state, 'audience': audience, 'group_chat': lesson.group.telegram_chat_id,
    }, sort_keys=True).encode()).hexdigest()
    preview = {
        'is_update': is_update, 'has_changes': has_changes,
        'preview_token': token, 'revision': lesson.report_revision,
        'common_changes': common,
        'students': [{
            'id': m.student_id, 'name': m.student.get_full_name() or m.student.username,
            'changes': changes['students'].get(str(m.student_id), {}),
        } for m in affected],
        'parents': [{'id': pk, 'name': parent.get_full_name() or parent.username}
                    for pk, parent in sorted(parents.items())],
        'student_count': len(affected), 'parent_count': len(parents),
        'group_chat': bool(lesson.group.telegram_chat_id and (not is_update or common)),
    }
    changes['audience'] = audience
    return preview, state, changes


def confirm_report(group_pk, lesson_pk, preview_token, actor):
    # Publish the baseline atomically before network delivery. Concurrent clicks
    # and HTTP retries observe the confirmed snapshot and do not resend it.
    with transaction.atomic():
        group = Group.objects.select_for_update().get(pk=group_pk)
        if not can_manage_group(actor, group):
            raise PermissionDenied('Only current managing staff can confirm lesson reports.')
        lesson = get_object_or_404(Lesson.objects.select_for_update(), pk=lesson_pk, group_id=group_pk)
        preview, state, changes = prepare_preview(lesson)
        if preview['has_changes']:
            if (preview['is_update'] or preview_token is not None) and preview_token != preview['preview_token']:
                raise ReportChanged()
            if not lesson.ended_at:
                lesson.ended_at = timezone.now()
            lesson.report_snapshot = state
            lesson.report_revision += 1
            lesson.save(update_fields=['ended_at', 'report_snapshot', 'report_revision'])
        result = {
            'ok': True, 'has_changes': preview['has_changes'], 'is_update': preview['is_update'],
            'notified': preview['student_count'] if preview['has_changes'] else 0,
            'ended_at': lesson.ended_at, 'revision': lesson.report_revision,
        }
    return result, lesson, state, changes


LABELS = {
    'uz': {'attendance': 'Davomat', 'score': 'Baho', 'coins': 'Coin',
           'title': 'Dars', 'date': 'Sana', 'homework': 'Uyga vazifa',
           True: 'Qatnashdi', False: 'Kelmadi', None: 'Belgilanmagan'},
    'ru': {'attendance': 'Посещаемость', 'score': 'Оценка', 'coins': 'Монеты',
           'title': 'Урок', 'date': 'Дата', 'homework': 'Домашнее задание',
           True: 'Присутствовал(а)', False: 'Отсутствовал(а)', None: 'Не указано'},
}


def change_lines(fields, lang):
    labels = LABELS.get(lang, LABELS['uz'])
    def display(key, value):
        if value is None or (key == 'attendance' and isinstance(value, bool)):
            return labels[value]
        return str(value) if value != '' else '—'
    return [f"{labels[key]}: {display(key, item['old'])} → {display(key, item['new'])}"
            for key, item in fields.items()]


def send_updates(lesson, state, changes):
    from users.models import Notification
    from users.telegram_bot import send_notification
    group = lesson.group
    common = changes['common']
    logger = logging.getLogger(__name__)
    def deliver(user, fields, student_name=None):
        lang = user.telegram_lang or group.language or 'uz'
        lines = [lesson.title, group.name]
        if student_name:
            lines.append(student_name)
        lines.extend(change_lines(fields, lang))
        text = '\n'.join(lines)
        heading = 'Dars ma’lumotlari yangilandi' if lang != 'ru' else 'Данные урока обновлены'
        Notification.objects.create(user=user, type='lesson', title=heading, body=text[:500])
        if user.telegram_id:
            try:
                async_to_sync(send_notification)(user.telegram_id, 'lesson_update', lang, message=text)
            except Exception:
                logger.exception('Lesson update delivery failed for user %s', user.pk)
    # Recheck the current roster at delivery so a withdrawn account cannot be
    # reintroduced by a historical attendance/score record or the preview.
    for membership in current_memberships(group).select_related('student'):
        student = membership.student
        sid = str(student.pk)
        if sid not in state['students']:
            continue
        personal = changes['students'].get(sid, {})
        if personal or common:
            deliver(student, {**common, **personal})
        parent_fields = {key: value for key, value in common.items() if key != 'homework'}
        parent_fields.update(personal)
        if parent_fields:
            for link in eligible_parents(student, group).filter(parent_id__in=changes['audience'].get(sid, [])):
                deliver(link.parent, parent_fields, student.get_full_name() or student.username)
    if common and group.telegram_chat_id:
        lang = group.language or 'uz'
        text = '\n'.join([lesson.title, group.name, *change_lines(common, lang)])
        try:
            async_to_sync(send_notification)(group.telegram_chat_id, 'lesson_update', lang, message=text)
        except Exception:
            logger.exception('Lesson group update delivery failed')
