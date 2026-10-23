import signal
import threading

from django.core.management.base import BaseCommand
from users import scheduler
from users.scheduler_lock import scheduler_lease


class Command(BaseCommand):
    help = 'Run the single academy report/reminder scheduler process.'

    def handle(self, *args, **options):
        stopped = threading.Event()
        for signum in (signal.SIGINT, signal.SIGTERM):
            signal.signal(signum, lambda *_: stopped.set())
        with scheduler_lease() as verify_lease:
            try:
                scheduler.start()
                self.stdout.write('Academy scheduler started with an exclusive lease.')
                while not stopped.wait(5):
                    verify_lease()
            finally:
                if scheduler._scheduler.running:
                    scheduler._scheduler.shutdown(wait=True)
