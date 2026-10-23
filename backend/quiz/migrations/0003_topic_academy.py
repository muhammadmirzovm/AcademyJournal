from django.db import migrations, models
import django.db.models.deletion


def backfill(apps, schema_editor):
    Topic = apps.get_model('quiz', 'Topic')
    alias = schema_editor.connection.alias
    for topic in Topic.objects.using(alias).select_related('created_by').iterator():
        Topic.objects.using(alias).filter(pk=topic.pk).update(academy_id=topic.created_by.academy_id)


class Migration(migrations.Migration):
    dependencies = [('quiz', '0002_question_hint')]
    operations = [
        migrations.AddField(model_name='topic', name='academy', field=models.ForeignKey(
            null=True, blank=True, on_delete=django.db.models.deletion.CASCADE,
            related_name='topics', to='academies.academy')),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
