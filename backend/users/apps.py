from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = 'users'

    def ready(self):
        from django.db.models.signals import post_save
        from academies.models import Academy
        from . import scheduler

        scheduler.start()

        def _on_academy_save(sender, instance, **kwargs):
            scheduler.reschedule(instance)

        post_save.connect(_on_academy_save, sender=Academy, weak=False)
