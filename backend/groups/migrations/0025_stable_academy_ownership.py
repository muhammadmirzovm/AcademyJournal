from django.db import migrations, models
import django.db.models.deletion


def backfill(apps, schema_editor):
    Group = apps.get_model('groups', 'Group')
    Announcement = apps.get_model('groups', 'Announcement')
    alias = schema_editor.connection.alias
    for group in Group.objects.using(alias).select_related('teacher').iterator():
        Group.objects.using(alias).filter(pk=group.pk).update(academy_id=group.teacher.academy_id)
    for ann in Announcement.objects.using(alias).select_related('author', 'group').iterator():
        academy_id = ann.group.academy_id if ann.group_id else ann.author.academy_id
        Announcement.objects.using(alias).filter(pk=ann.pk).update(academy_id=academy_id)


class Migration(migrations.Migration):
    dependencies = [('groups', '0024_group_status'), ('academies', '0007_add_weekly_report_time')]
    operations = [
        migrations.AddField(model_name='group', name='academy', field=models.ForeignKey(
            null=True, blank=True, on_delete=django.db.models.deletion.CASCADE,
            related_name='groups', to='academies.academy')),
        migrations.AddField(model_name='announcement', name='academy', field=models.ForeignKey(
            null=True, blank=True, on_delete=django.db.models.deletion.CASCADE,
            related_name='announcements', to='academies.academy')),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
