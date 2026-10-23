import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from django.db import close_old_connections

logger = logging.getLogger(__name__)
_scheduler = BackgroundScheduler(timezone='UTC')


def _run_daily(academy_id):
    # APScheduler runs jobs on its own background thread, outside Django's
    # request/response cycle — close_old_connections() is normally called per
    # request, so a connection that goes stale here (e.g. a DB restart) is
    # never refreshed and every future run fails with "connection already closed".
    close_old_connections()
    from academies.models import Academy
    from .management.commands.send_daily_report import run_report_for_academy
    try:
        academy = Academy.objects.get(id=academy_id)
        run_report_for_academy(academy)
    except Exception as exc:
        logger.error('Daily report failed for academy %s: %s', academy_id, exc)
    finally:
        close_old_connections()


def _run_weekly(academy_id):
    close_old_connections()
    from academies.models import Academy
    from .management.commands.send_weekly_report import run_weekly_report_for_academy
    try:
        academy = Academy.objects.get(id=academy_id)
        run_weekly_report_for_academy(academy)
    except Exception as exc:
        logger.error('Weekly report failed for academy %s: %s', academy_id, exc)
    finally:
        close_old_connections()


def _run_lesson_reminders():
    close_old_connections()
    from .management.commands.send_lesson_reminders import run_lesson_reminders
    try:
        sent = run_lesson_reminders()
        if sent:
            logger.info('Sent %d lesson reminder(s)', sent)
    except Exception as exc:
        logger.error('Lesson reminders failed: %s', exc)
    finally:
        close_old_connections()


def _load_all():
    close_old_connections()
    from academies.models import Academy
    academies = list(Academy.objects.all())
    valid_ids = {f'{kind}_report_{academy.id}' for academy in academies for kind in ('daily', 'weekly')}
    for job in _scheduler.get_jobs():
        if job.id.startswith(('daily_report_', 'weekly_report_')) and job.id not in valid_ids:
            _scheduler.remove_job(job.id)
    for academy in academies:
        reschedule(academy)
    logger.info('Loaded %d academy report schedules', len(_scheduler.get_jobs()))


def _sync_report(job_id, callback, academy_id, trigger):
    existing = _scheduler.get_job(job_id)
    if trigger is None:
        if existing:
            _scheduler.remove_job(job_id)
        return
    # Refreshing unchanged settings must preserve the next scheduled firing.
    if existing and str(existing.trigger) == str(trigger):
        return
    _scheduler.add_job(callback, trigger, id=job_id, args=[academy_id],
                       replace_existing=True, max_instances=1, coalesce=True)


def reschedule(academy):
    daily = CronTrigger(hour=academy.report_time.hour, minute=academy.report_time.minute,
                        timezone='UTC') if academy.report_time else None
    weekly = CronTrigger(day_of_week='sun', hour=academy.weekly_report_time.hour,
                         minute=academy.weekly_report_time.minute,
                         timezone='UTC') if academy.weekly_report_time else None
    _sync_report(f'daily_report_{academy.id}', _run_daily, academy.id, daily)
    _sync_report(f'weekly_report_{academy.id}', _run_weekly, academy.id, weekly)


def start():
    if _scheduler.running:
        return
    _scheduler.start()
    _load_all()
    _scheduler.add_job(_load_all, 'interval', minutes=1, id='refresh_schedules',
                       max_instances=1, coalesce=True)
    _scheduler.add_job(
        _run_lesson_reminders,
        IntervalTrigger(minutes=1, timezone='UTC'),
        id='lesson_reminders',
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
