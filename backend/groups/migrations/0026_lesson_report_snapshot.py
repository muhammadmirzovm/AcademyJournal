from django.db import migrations, models


def baseline_existing_reports(apps, schema_editor):
    """Old finished lessons start clean, without broadcasting on upgrade."""
    Lesson = apps.get_model('groups', 'Lesson')
    Membership = apps.get_model('groups', 'GroupMembership')
    Attendance = apps.get_model('groups', 'Attendance')
    Score = apps.get_model('groups', 'Score')
    Result = apps.get_model('games', 'GameResult')
    alias = schema_editor.connection.alias
    last_pk = 0
    while True:
        lessons = list(Lesson.objects.using(alias).filter(
            ended_at__isnull=False, pk__gt=last_pk,
        ).select_related('group').order_by('pk')[:200])
        if not lessons:
            break
        ids = [lesson.pk for lesson in lessons]
        groups = {lesson.group_id: lesson.group for lesson in lessons}
        members = {}
        for membership in Membership.objects.using(alias).filter(
            group_id__in=groups, student__is_active=True, student__role='student',
        ).select_related('student'):
            if membership.student.academy_id == groups[membership.group_id].academy_id:
                members.setdefault(membership.group_id, []).append(membership.student_id)
        attendance = {(r.lesson_id, r.student_id): r.present for r in Attendance.objects.using(alias).filter(lesson_id__in=ids)}
        scores = {(r.lesson_id, r.student_id): r.value for r in Score.objects.using(alias).filter(lesson_id__in=ids)}
        coins = {(lesson_id, student_id): amount for lesson_id, student_id, amount in
                 Result.objects.using(alias).filter(game__lesson_id__in=ids).values_list('game__lesson_id', 'student_id', 'coins')}
        for lesson in lessons:
            lesson.report_snapshot = {
                'title': lesson.title, 'date': str(lesson.date), 'homework': lesson.homework,
                'students': {str(sid): {'attendance': attendance.get((lesson.pk, sid)),
                                      'score': scores.get((lesson.pk, sid)),
                                      'coins': coins.get((lesson.pk, sid), 0)}
                             for sid in members.get(lesson.group_id, [])},
            }
            lesson.report_revision = 1
        Lesson.objects.using(alias).bulk_update(lessons, ['report_snapshot', 'report_revision'])
        last_pk = lessons[-1].pk


class Migration(migrations.Migration):
    dependencies = [('groups', '0025_stable_academy_ownership'), ('games', '0001_initial')]
    operations = [
        migrations.AddField(model_name='lesson', name='report_snapshot', field=models.JSONField(null=True, blank=True, editable=False)),
        migrations.AddField(model_name='lesson', name='report_revision', field=models.PositiveIntegerField(default=0, editable=False)),
        migrations.RunPython(baseline_existing_reports, migrations.RunPython.noop),
    ]
