from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
import threading

import pytest
from django.db import connection, close_old_connections
from django.utils import timezone

from groups.test_access import world, client
from groups.models import Attendance, GroupMembership, Score
from users.models import Notification, ParentStudent

pytestmark = pytest.mark.django_db


def endpoint(world):
    return f'/api/groups/{world.group.pk}/lessons/{world.lesson.pk}/end/'


@pytest.fixture
def reports(world, monkeypatch):
    sent = []
    async def fake_send(chat_id, key, lang='uz', **kwargs):
        sent.append((chat_id, key, kwargs))
    monkeypatch.setattr('users.telegram_bot.send_notification', fake_send)
    for number, user in enumerate([world.student, world.outsider, world.parent], start=8001):
        user.telegram_id = number
        user.save()
    GroupMembership.objects.create(group=world.group, student=world.outsider)
    Attendance.objects.create(lesson=world.lesson, student=world.student, present=True)
    Score.objects.create(lesson=world.lesson, student=world.student, value=5)
    Notification.objects.all().delete()
    return world, sent


def publish(world):
    c = client(world.teacher)
    preview = c.get(endpoint(world)).data
    response = c.post(endpoint(world), {'preview_token': preview['preview_token']}, format='json')
    assert response.status_code == 200
    return response


def test_first_end_publishes_once_and_unchanged_retry_is_a_noop(reports):
    w, sent = reports
    publish(w)
    first_count = len(sent)
    w.lesson.refresh_from_db()
    assert w.lesson.ended_at and w.lesson.report_snapshot
    assert w.lesson.report_revision == 1
    response = client(w.teacher).post(endpoint(w))
    assert response.status_code == 200 and response.data['notified'] == 0
    assert len(sent) == first_count
    assert client(w.teacher).get(endpoint(w)).data['has_changes'] is False


def test_score_edit_requires_confirmation_and_notifies_only_affected_family(reports):
    w, sent = reports
    publish(w)
    sent.clear()
    Score.objects.filter(lesson=w.lesson, student=w.student).update(value=4)
    c = client(w.teacher)
    preview = c.get(endpoint(w)).data
    assert preview['student_count'] == 1 and preview['parent_count'] == 1
    assert preview['students'][0]['changes']['score'] == {'old': 5, 'new': 4}
    assert sent == []
    assert c.post(endpoint(w)).status_code == 409
    assert sent == []
    response = c.post(endpoint(w), {'preview_token': preview['preview_token']}, format='json')
    assert response.status_code == 200
    assert {item[0] for item in sent} == {w.student.telegram_id, w.parent.telegram_id}
    assert all(item[1] == 'lesson_update' for item in sent)
    assert all('5 → 4' in item[2]['message'] for item in sent)
    again = c.post(endpoint(w), {'preview_token': preview['preview_token']}, format='json')
    assert again.status_code == 200 and again.data['notified'] == 0
    assert len(sent) == 2


def test_attendance_correction_reaches_only_affected_student_and_parent(reports):
    w, sent = reports
    publish(w)
    sent.clear()
    response = client(w.teacher).post(
        f'/api/groups/{w.group.pk}/lessons/{w.lesson.pk}/attendance/',
        {'records': [{'student': w.student.pk, 'present': False}]}, format='json',
    )
    assert response.status_code == 200
    assert sent == []
    publish(w)
    assert {item[0] for item in sent} == {w.student.telegram_id, w.parent.telegram_id}
    assert all('Qatnashdi → Kelmadi' in item[2]['message'] for item in sent)


@pytest.mark.parametrize('assignment', ['New homework', ''])
def test_homework_edit_or_removal_notifies_students_without_parent_grade_spam(reports, assignment):
    w, sent = reports
    w.lesson.homework = 'Original homework'
    w.lesson.save()
    publish(w)
    sent.clear()
    response = client(w.teacher).post(
        f'/api/groups/{w.group.pk}/lessons/{w.lesson.pk}/homework/',
        {'assignment': assignment}, format='json',
    )
    assert response.status_code == 200 and sent == []
    preview = client(w.teacher).get(endpoint(w)).data
    assert preview['student_count'] == 2 and preview['parent_count'] == 0
    publish(w)
    assert {item[0] for item in sent} == {w.student.telegram_id, w.outsider.telegram_id}
    assert all('Uyga vazifa:' in item[2]['message'] for item in sent)


def test_reverting_an_edit_to_the_confirmed_value_has_no_pending_report(reports):
    w, sent = reports
    publish(w)
    sent.clear()
    score = Score.objects.get(lesson=w.lesson, student=w.student)
    score.value = 4
    score.save()
    assert client(w.teacher).get(endpoint(w)).data['has_changes'] is True
    score.value = 5
    score.save()
    assert client(w.teacher).get(endpoint(w)).data['has_changes'] is False
    publish(w)
    assert sent == []


def test_stale_confirmation_does_not_publish_later_edits(reports):
    w, sent = reports
    publish(w)
    sent.clear()
    score = Score.objects.get(lesson=w.lesson, student=w.student)
    score.value = 4
    score.save()
    c = client(w.teacher)
    old = c.get(endpoint(w)).data
    score.value = 3
    score.save()
    assert c.post(endpoint(w), {'preview_token': old['preview_token']}, format='json').status_code == 409
    w.lesson.refresh_from_db()
    assert w.lesson.report_snapshot['students'][str(w.student.pk)]['score'] == 5
    assert sent == []
    publish(w)
    assert all('5 → 3' in item[2]['message'] for item in sent)


def test_withdrawal_after_preview_invalidates_confirmation(reports):
    w, sent = reports
    publish(w)
    sent.clear()
    Score.objects.filter(lesson=w.lesson, student=w.student).update(value=4)
    c = client(w.teacher)
    old = c.get(endpoint(w)).data
    GroupMembership.objects.filter(group=w.group, student=w.student).delete()
    assert c.post(endpoint(w), {'preview_token': old['preview_token']}, format='json').status_code in (200, 409)
    assert sent == []
    assert c.get(endpoint(w)).data['has_changes'] is False


def test_parent_unlink_after_preview_requires_new_confirmation(reports):
    w, sent = reports
    publish(w)
    sent.clear()
    Score.objects.filter(lesson=w.lesson, student=w.student).update(value=4)
    c = client(w.teacher)
    old = c.get(endpoint(w)).data
    ParentStudent.objects.filter(parent=w.parent, student=w.student).delete()
    assert c.post(endpoint(w), {'preview_token': old['preview_token']}, format='json').status_code == 409
    publish(w)
    assert [item[0] for item in sent] == [w.student.telegram_id]


@pytest.mark.parametrize('actor', ['student', 'parent', 'foreign_admin', 'other_teacher'])
def test_preview_is_private_to_managing_staff(world, actor):
    assert client(getattr(world, actor)).get(endpoint(world)).status_code in (403, 404)


def test_personal_correction_is_not_broadcast_to_group_chat(reports):
    w, sent = reports
    # First report's existing Telegram chat send is irrelevant to this check.
    publish(w)
    w.group.telegram_chat_id = -8001
    w.group.save()
    sent.clear()
    Score.objects.filter(lesson=w.lesson, student=w.student).update(value=4)
    assert client(w.teacher).get(endpoint(w)).data['group_chat'] is False
    publish(w)
    assert -8001 not in [item[0] for item in sent]


@pytest.mark.django_db(transaction=True)
def test_concurrent_first_confirmation_does_not_send_duplicate_reports(reports):
    if connection.vendor != 'postgresql':
        pytest.skip('Requires PostgreSQL row locks')
    w, sent = reports
    token = client(w.teacher).get(endpoint(w)).data['preview_token']
    barrier = threading.Barrier(2)
    def confirm():
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            return client(w.teacher).post(endpoint(w), {'preview_token': token}, format='json')
        finally:
            close_old_connections()
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(confirm) for _ in range(2)]
        results = [future.result(timeout=15) for future in futures]
    assert all(result.status_code == 200 for result in results)
    assert sorted(result.data['notified'] for result in results) == [0, 2]
    assert len(sent) == 3  # two students, one parent, exactly once each


@pytest.mark.django_db(transaction=True)
def test_upgrade_baselines_old_finished_lessons_without_resending():
    from django.db.migrations.executor import MigrationExecutor
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [node for node in latest if node[0] != 'groups'] + [('groups', '0025_stable_academy_ownership')]
    try:
        executor.migrate(previous)
        old = executor.loader.project_state(previous).apps
        academy = old.get_model('academies', 'Academy').objects.create(name='Upgrade', slug='upgrade-report')
        User = old.get_model('users', 'User')
        teacher = User.objects.create(username='upgrade_teacher', role='teacher', academy_id=academy.pk)
        student = User.objects.create(username='upgrade_student', role='student', academy_id=academy.pk)
        group = old.get_model('groups', 'Group').objects.create(name='Upgrade group', teacher_id=teacher.pk,
                                                                academy_id=academy.pk, join_key='UPGRADE1')
        old.get_model('groups', 'GroupMembership').objects.create(group_id=group.pk, student_id=student.pk)
        lesson = old.get_model('groups', 'Lesson').objects.create(group_id=group.pk, title='Finished lesson',
                    date=timezone.localdate(), homework='Existing homework', ended_at=timezone.now())
        old.get_model('groups', 'Attendance').objects.create(lesson_id=lesson.pk, student_id=student.pk, present=True)
        old.get_model('groups', 'Score').objects.create(lesson_id=lesson.pk, student_id=student.pk, value=5)
        executor = MigrationExecutor(connection)
        executor.migrate(latest)
        from groups.models import Lesson
        from groups.lesson_reports import prepare_preview
        migrated = Lesson.objects.get(pk=lesson.pk)
        assert migrated.report_revision == 1
        assert migrated.report_snapshot['students'][str(student.pk)]['score'] == 5
        assert prepare_preview(migrated)[0]['has_changes'] is False
    finally:
        MigrationExecutor(connection).migrate(latest)
