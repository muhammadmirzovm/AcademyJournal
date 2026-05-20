from django.db.models.signals import post_save
from django.dispatch import receiver
from asgiref.sync import async_to_sync


def _create(user, ntype, title, body):
    from users.models import Notification
    Notification.objects.create(user=user, type=ntype, title=title, body=body)


def _tg(telegram_id, lang, msg_key, **kwargs):
    if not telegram_id:
        return
    from users.telegram_bot import send_notification
    try:
        async_to_sync(send_notification)(telegram_id, msg_key, lang or 'uz', **kwargs)
    except Exception:
        pass


@receiver(post_save, sender='groups.Score')
def on_score_saved(sender, instance, created, **kwargs):
    if not created:
        return
    student = instance.student
    lesson  = instance.lesson
    group   = lesson.group
    score   = instance.value

    _create(student, 'score',
            f'{lesson.title} — {score}/5',
            f'{group.name}')
    _tg(student.telegram_id, student.telegram_lang, 'score',
        lesson=lesson.title, score=score, group=group.name)

    for ps in student.parents.select_related('parent').all():
        parent = ps.parent
        name   = f'{student.first_name} {student.last_name}'.strip() or student.username
        _create(parent, 'score',
                f'{name} — {lesson.title} — {score}/5',
                f'{group.name}')
        _tg(parent.telegram_id, parent.telegram_lang, 'score_parent',
            name=name, lesson=lesson.title, score=score, group=group.name)


@receiver(post_save, sender='groups.Attendance')
def on_attendance_saved(sender, instance, created, **kwargs):
    if instance.present:
        return
    student = instance.student
    lesson  = instance.lesson
    group   = lesson.group

    _create(student, 'absent',
            lesson.title,
            group.name)
    _tg(student.telegram_id, student.telegram_lang, 'absent',
        lesson=lesson.title, group=group.name)

    for ps in student.parents.select_related('parent').all():
        parent = ps.parent
        name   = f'{student.first_name} {student.last_name}'.strip() or student.username
        _create(parent, 'absent',
                f'{name} — {lesson.title}',
                group.name)
        _tg(parent.telegram_id, parent.telegram_lang, 'absent_parent',
            name=name, lesson=lesson.title, group=group.name)


@receiver(post_save, sender='groups.Lesson')
def on_lesson_created(sender, instance, created, **kwargs):
    if not created:
        return
    group    = instance.group
    students = group.memberships.select_related('student').all()
    for m in students:
        _create(m.student, 'lesson',
                instance.title,
                group.name)
