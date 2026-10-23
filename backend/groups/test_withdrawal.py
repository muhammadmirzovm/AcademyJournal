"""Withdrawal revokes current participation without destroying earned history."""
from datetime import timedelta

import pytest
from django.utils import timezone

from groups.test_access import world, client  # Shared isolated academy fixture.
from groups.models import Attendance, ExamResult, GroupMembership, Score
from quiz.models import Game as QuizGame, Team
from users.models import Notification, ParentStudent

pytestmark = pytest.mark.django_db


def withdraw(world):
    membership = world.group.memberships.get(student=world.student)
    response = client(world.teacher).delete(
        f'/api/groups/{world.group.pk}/members/{membership.pk}/',
    )
    assert response.status_code == 204


@pytest.mark.parametrize('status', [QuizGame.WAITING, QuizGame.ACTIVE, QuizGame.FINAL, QuizGame.FINISHED])
def test_withdrawal_prunes_only_unfinished_teams_and_preserves_history(world, status):
    from coins.models import CoinTransaction
    from games.models import Game, GameResult
    world.game.status = status
    world.game.save()
    team = Team.objects.create(game=world.game, name='Existing team')
    team.members.add(world.student)
    world.game.current_team = team
    world.game.current_question = world.question
    world.game.save()
    attendance = Attendance.objects.create(lesson=world.lesson, student=world.student, present=True)
    score = Score.objects.create(lesson=world.lesson, student=world.student, value=5)
    ledger = CoinTransaction.objects.create(student=world.student, amount=10, type='game_place')
    coin_game = Game.objects.create(lesson=world.lesson, group=world.group, teacher=world.teacher,
                                    date=world.lesson.date, status=Game.Status.CLOSED)
    result = GameResult.objects.create(game=coin_game, student=world.student, coins=10)
    withdraw(world)
    assert team.members.filter(pk=world.student.pk).exists() == (status == QuizGame.FINISHED)
    world.game.refresh_from_db()
    if status != QuizGame.FINISHED:
        assert world.game.current_team_id is None
        assert world.game.current_question_id is None
    for record in (attendance, score, ledger, result):
        assert type(record).objects.filter(pk=record.pk).exists()
    assert ParentStudent.objects.filter(parent=world.parent, student=world.student).exists()
    assert client(world.student).get(f'/api/groups/{world.group.pk}/games/').status_code == 404
    assert client(world.parent).get(f'/api/groups/{world.group.pk}/').status_code == 404


def test_bulk_academy_removal_prunes_teams_in_every_group(world):
    world.game.status = QuizGame.ACTIVE
    world.game.save()
    team = Team.objects.create(game=world.game, name='Team')
    team.members.add(world.student)
    response = client(world.admin).delete(f'/api/academy/members/{world.student.pk}/')
    assert response.status_code == 204
    assert not team.members.exists()


def test_withdrawal_keeps_other_group_and_rejoining_does_not_restore_old_team(world):
    from groups.models import Group
    other = Group.objects.create(name='Other current group', teacher=world.teacher)
    GroupMembership.objects.create(group=other, student=world.student)
    other_game = QuizGame.objects.create(group=other, created_by=world.teacher, name='Other quiz', status=QuizGame.ACTIVE)
    other_team = Team.objects.create(game=other_game, name='Other team')
    other_team.members.add(world.student)
    world.game.status = QuizGame.ACTIVE
    world.game.save()
    team = Team.objects.create(game=world.game, name='Old team')
    team.members.add(world.student)
    withdraw(world)
    assert other_team.members.filter(pk=world.student.pk).exists()
    GroupMembership.objects.create(group=world.group, student=world.student)
    assert not team.members.exists()


def test_finished_quiz_reset_prunes_withdrawn_historical_members(world):
    world.game.status = QuizGame.FINISHED
    world.game.save()
    team = Team.objects.create(game=world.game, name='Historical team')
    team.members.add(world.student)
    withdraw(world)
    assert team.members.exists()
    response = client(world.teacher).post(f'/api/groups/{world.group.pk}/games/{world.game.pk}/reset/')
    assert response.status_code == 200
    assert not team.members.exists()


def test_legacy_active_team_serializer_hides_departed_student(world):
    from quiz.serializers import GameSerializer
    withdraw(world)
    world.game.status = QuizGame.ACTIVE
    world.game.save()
    # Simulate a stale roster left by the previous application version.
    team = Team.objects.create(game=world.game, name='Old team')
    team.members.add(world.student)
    assert GameSerializer(world.game).data['teams'][0]['members'] == []


def test_weekly_report_skips_parent_without_current_children(world, monkeypatch):
    from users.management.commands import send_weekly_report as report
    world.parent.telegram_id = 9001
    world.parent.save()
    withdraw(world)
    sent = []
    monkeypatch.setenv('TELEGRAM_BOT_TOKEN', 'test-token')
    monkeypatch.setattr(report, '_send', lambda *args: sent.append(args))
    report.run_weekly_report_for_academy(world.a)
    assert sent == []
    assert report._build_message(world.parent, timezone.localdate()-timedelta(days=6), timezone.localdate()) is None


def test_weekly_report_keeps_other_current_child(world, monkeypatch):
    from users.management.commands.send_weekly_report import _build_message
    world.outsider.first_name = 'Current child'
    world.outsider.save()
    GroupMembership.objects.create(group=world.group, student=world.outsider)
    ParentStudent.objects.create(parent=world.parent, student=world.outsider)
    withdraw(world)
    message = _build_message(world.parent, timezone.localdate()-timedelta(days=6), timezone.localdate())
    assert 'Current child' in message
    assert world.student.username not in message


def test_exam_delivery_rechecks_membership_and_preserves_results(world, monkeypatch):
    from groups.views import _notify_exam_finished
    result = ExamResult.objects.create(exam=world.exam, student=world.student, scores=[5])
    withdraw(world)
    sent = []
    async def fake_send(*args, **kwargs):
        sent.append(args)
    monkeypatch.setattr('users.telegram_bot.send_notification', fake_send)
    _notify_exam_finished(world.exam, [world.student.pk], send_group_summary=False)
    assert sent == []
    assert not Notification.objects.filter(user__in=[world.student, world.parent], type='exam').exists()
    assert ExamResult.objects.filter(pk=result.pk).exists()


def test_exam_group_message_excludes_former_students(world, monkeypatch):
    from groups.views import _send_exam_group_summary
    ExamResult.objects.create(exam=world.exam, student=world.student, scores=[5])
    withdraw(world)
    world.group.telegram_chat_id = -9001
    messages = []
    class FakeBot:
        def __init__(self, **kwargs): pass
        async def send_message(self, **kwargs): messages.append(kwargs['text'])
    monkeypatch.setenv('TELEGRAM_BOT_TOKEN', 'fake-token')
    monkeypatch.setattr('telegram.Bot', FakeBot)
    _send_exam_group_summary(world.exam, world.group)
    assert len(messages) == 1
    assert world.student.username not in messages[0]


def test_teacher_bot_statistics_exclude_withdrawn_students(world):
    from users.telegram_bot import _teacher_groups
    GroupMembership.objects.create(group=world.group, student=world.outsider)
    for student in [world.student, world.outsider]:
        Attendance.objects.create(lesson=world.lesson, student=student, present=True)
        Score.objects.create(lesson=world.lesson, student=student, value=5)
    withdraw(world)
    assert _teacher_groups(world.teacher) == [{'name': world.group.name, 'count': 1, 'score': 100, 'att': 100}]


def test_disabled_telegram_user_is_not_authorized(world):
    from users.telegram_bot import _get_user
    world.student.telegram_id = 9991
    world.student.is_active = False
    world.student.save()
    assert _get_user(9991) is None


def test_lesson_end_does_not_message_withdrawn_student_or_parent(world, monkeypatch):
    withdraw(world)
    Notification.objects.all().delete()
    sent = []
    async def fake_send(*args, **kwargs): sent.append(args)
    monkeypatch.setattr('users.telegram_bot.send_notification', fake_send)
    response = client(world.teacher).post(f'/api/groups/{world.group.pk}/lessons/{world.lesson.pk}/end/')
    assert response.status_code == 200
    assert response.data['notified'] == 0
    assert sent == []
    assert not Notification.objects.exists()


def test_past_invitation_does_not_allow_former_teacher_to_send_messages(world):
    from academies.models import InviteToken
    invite = InviteToken.objects.create(academy=world.a, created_by=world.teacher,
                                        role='student', group=world.group, expires_at=timezone.now()+timedelta(days=1))
    invite.used_by.add(world.student)
    withdraw(world)
    c = client(world.teacher)
    url = f'/api/auth/users/{world.student.pk}/notify/'
    assert c.get(url).status_code == 404
    assert c.post(url, {'message': 'Stale contact', 'recipients': ['student']}, format='json').status_code == 404


@pytest.mark.django_db(transaction=True)
def test_quiz_start_and_withdrawal_leave_no_stale_team_members(world):
    from concurrent.futures import ThreadPoolExecutor
    import threading
    from django.db import connection, close_old_connections
    if connection.vendor != 'postgresql':
        pytest.skip('Requires PostgreSQL row locks')
    barrier = threading.Barrier(2)
    membership_pk = world.group.memberships.get(student=world.student).pk
    def run(start):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            c = client(world.teacher)
            if start:
                return c.post(f'/api/groups/{world.group.pk}/games/{world.game.pk}/start/').status_code
            return c.delete(f'/api/groups/{world.group.pk}/members/{membership_pk}/').status_code
        finally:
            close_old_connections()
    with ThreadPoolExecutor(max_workers=2) as pool:
        start = pool.submit(run, True)
        removal = pool.submit(run, False)
        assert start.result(timeout=15) == 200
        assert removal.result(timeout=15) == 204
    assert not GroupMembership.objects.filter(group=world.group, student=world.student).exists()
    assert not Team.objects.filter(game=world.game, members=world.student).exists()


def test_coin_preview_excludes_old_attendance_from_removed_students(world):
    Attendance.objects.create(lesson=world.lesson, student=world.student, present=True)
    withdraw(world)
    response = client(world.teacher).get(f'/api/groups/{world.group.pk}/lessons/{world.lesson.pk}/game/')
    assert response.status_code == 200
    assert response.data['attended_count'] == 0


def test_lesson_delivery_excludes_inactive_parents(world, monkeypatch):
    world.parent.is_active = False
    world.parent.save()
    Notification.objects.all().delete()
    response = client(world.teacher).post(f'/api/groups/{world.group.pk}/lessons/{world.lesson.pk}/end/')
    assert response.status_code == 200
    assert Notification.objects.filter(user=world.student).exists()
    assert not Notification.objects.filter(user=world.parent).exists()


def test_admin_bot_counts_only_current_academy_accounts(world):
    from users.telegram_bot import _admin_stats
    assert _admin_stats(world.admin) == {'teachers': 2, 'students': 2}
    world.student.academy = None
    world.student.save()
    assert _admin_stats(world.admin) == {'teachers': 2, 'students': 1}
