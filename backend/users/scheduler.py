import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)
_scheduler = BackgroundScheduler(timezone='UTC')


def _run(academy_id):
    from academies.models import Academy
    from .management.commands.send_daily_report import run_report_for_academy
    try:
        academy = Academy.objects.get(id=academy_id)
        run_report_for_academy(academy)
    except Exception as exc:
        logger.error('Daily report failed for academy %s: %s', academy_id, exc)


def _load_all():
    from academies.models import Academy
    for academy in Academy.objects.filter(report_time__isnull=False):
        reschedule(academy)
    logger.info('Loaded %d academy report schedules', len(_scheduler.get_jobs()))


def reschedule(academy):
    job_id = f'daily_report_{academy.id}'
    if _scheduler.get_job(job_id):
        _scheduler.remove_job(job_id)
    if academy.report_time:
        _scheduler.add_job(
            _run,
            CronTrigger(hour=academy.report_time.hour, minute=academy.report_time.minute),
            id=job_id,
            args=[academy.id],
        )
        logger.info('Scheduled report for academy %s at %s UTC', academy.name, academy.report_time)
    else:
        logger.info('Removed report schedule for academy %s', academy.name)


def start():
    if _scheduler.running:
        return
    _scheduler.start()
    # Load academy schedules 2s after startup to avoid querying DB inside ready()
    _scheduler.add_job(_load_all, 'date', run_date=datetime.now() + timedelta(seconds=2), id='_startup_load')
