from django.db import migrations, models


def copy_graduated_to_status(apps, schema_editor):
    Group = apps.get_model('groups', 'Group')
    Group.objects.filter(is_graduated=True).update(status='graduated')


class Migration(migrations.Migration):

    dependencies = [
        ('groups', '0023_grouplessonreminder'),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='status',
            field=models.CharField(
                choices=[
                    ('active', 'Active'),
                    ('paused', 'Paused'),
                    ('closed', 'Closed'),
                    ('graduated', 'Graduated'),
                ],
                default='active',
                max_length=12,
            ),
        ),
        migrations.RunPython(copy_graduated_to_status, migrations.RunPython.noop),
    ]
