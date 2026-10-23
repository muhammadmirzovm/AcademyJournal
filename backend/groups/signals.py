from django.db.models.signals import post_save, post_delete
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
    from groups.access import current_memberships
    students = current_memberships(group, instance.date).select_related('student')
    for m in students:
        _create(m.student, 'lesson',
                instance.title,
                group.name)


@receiver(post_delete, sender='groups.GroupMembership')
def on_membership_removed(sender, instance, **kwargs):
    # Also runs for bulk removal through academy management and Django admin.
    from quiz.roster import prune_unfinished_rosters
    prune_unfinished_rosters(instance.group_id)
