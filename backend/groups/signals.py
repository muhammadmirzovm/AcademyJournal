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
