from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Run the Telegram bot for password reset and account linking'

    def handle(self, *args, **options):
        from users.telegram_bot import run_bot
        self.stdout.write('Starting Telegram bot...')
        run_bot()
