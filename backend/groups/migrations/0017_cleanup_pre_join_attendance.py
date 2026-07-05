from django.db import migrations


def delete_pre_join_attendance(apps, schema_editor):
    """Remove attendance records for lessons dated before each student's
    join date in that group, so late joiners are only counted from when
    they actually joined."""
    GroupMembership = apps.get_model('groups', 'GroupMembership')
    Attendance      = apps.get_model('groups', 'Attendance')

    for membership in GroupMembership.objects.select_related('group').iterator():
        join_date = membership.joined_at.date()
        Attendance.objects.filter(
            student=membership.student,
            lesson__group=membership.group,
            lesson__date__lt=join_date,
        ).delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('groups', '0016_group_exam_ready_at_group_exam_ready_note'),
    ]

    operations = [
        migrations.RunPython(delete_pre_join_attendance, noop),
    ]
