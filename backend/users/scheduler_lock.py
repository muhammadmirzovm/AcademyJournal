"""Hold a process-wide lease before starting any scheduled jobs."""
from contextlib import contextmanager
from pathlib import Path

from django.conf import settings
from django.core.management.base import CommandError
from django.db import connections


LOCK_ID = 664501837201


@contextmanager
def scheduler_lease():
    database = connections['default']
    if database.vendor == 'postgresql':
        # Dedicated connection: close_old_connections in report jobs must not
        # release the scheduler's session-level advisory lock.
        lease = database.Database.connect(**database.get_connection_params())
        lease.autocommit = True
        try:
            with lease.cursor() as cursor:
                cursor.execute('SELECT pg_try_advisory_lock(%s)', [LOCK_ID])
                if not cursor.fetchone()[0]:
                    raise CommandError('Another academy scheduler is already running.')

            def verify():
                with lease.cursor() as cursor:
                    cursor.execute('SELECT 1')
                    cursor.fetchone()

            yield verify
        finally:
            # Closing this connection also releases the advisory lock.
            lease.close()
    elif database.vendor == 'sqlite':
        import fcntl
        lock_path = Path(getattr(settings, 'SCHEDULER_LOCK_FILE', settings.BASE_DIR / '.scheduler.lock'))
        with lock_path.open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise CommandError('Another academy scheduler is already running.') from exc
            try:
                yield lambda: None
            finally:
                fcntl.flock(lock, fcntl.LOCK_UN)
    else:
        raise CommandError('Scheduler locking supports PostgreSQL and SQLite only.')
