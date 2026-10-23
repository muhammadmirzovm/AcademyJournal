from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = 'users'

    def ready(self):
        # Scheduling runs in the dedicated run_scheduler command. Starting it
        # here duplicates reports across web workers and management commands.
        pass
