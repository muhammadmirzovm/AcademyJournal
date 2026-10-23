from datetime import timedelta
from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from academies.models import Academy, InviteToken
from groups.models import Announcement, Attendance, Exam, ExamResult, Group, GroupMembership, Lesson, Score
from quiz.models import Question, Topic, Game as QuizGame
from users.models import ParentStudent

User = get_user_model()
pytestmark = pytest.mark.django_db


@pytest.fixture
def world():
    a = Academy.objects.create(name='A', slug='a')
    b = Academy.objects.create(name='B', slug='b')
    def user(name, role, academy=a):
        return User.objects.create_user(username=name, password='pass1234', role=role, academy=academy)
    admin = user('admin_a', 'admin')
    teacher = user('teacher_a', 'teacher')
    other_teacher = user('teacher_other', 'teacher')
    foreign_admin = user('admin_b', 'admin', b)
    foreign_teacher = user('teacher_b', 'teacher', b)
    student = user('student_a', 'student')
    outsider = user('outsider', 'student')
    foreign_student = user('student_b', 'student', b)
    parent = user('parent_a', 'parent')
    group = Group.objects.create(name='Group A', teacher=teacher)
    foreign_group = Group.objects.create(name='Group B', teacher=foreign_teacher)
    GroupMembership.objects.create(group=group, student=student, joined_at=timezone.now()-timedelta(days=10))
    GroupMembership.objects.create(group=foreign_group, student=foreign_student)
    ParentStudent.objects.create(parent=parent, student=student)
    lesson = Lesson.objects.create(group=group, title='Lesson A', date=timezone.localdate())
    exam = Exam.objects.create(group=group, name='Exam A', question_count=1)
    topic = Topic.objects.create(name='Topic B', created_by=foreign_teacher)
    question = Question.objects.create(topic=topic, created_by=foreign_teacher, text='Private?', correct_answer='Yes')
    game = QuizGame.objects.create(group=group, created_by=teacher, name='Quiz A')
    ann = Announcement.objects.create(author=teacher, academy=a, title='A only')
    return SimpleNamespace(**locals())


def client(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


READ_PATHS = [
    'groups/{group}/', 'groups/{group}/members/', 'groups/{group}/lessons/',
    'groups/{group}/day-off/', 'groups/{group}/lessons/{lesson}/',
    'groups/{group}/lessons/{lesson}/attendance/', 'groups/{group}/lessons/{lesson}/scores/',
    'groups/{group}/lessons/{lesson}/journal/', 'groups/{group}/lessons/{lesson}/homework/',
    'groups/{group}/lessons/{lesson}/game/', 'groups/{group}/game-history/',
    'groups/{group}/games/', 'groups/{group}/games/{game}/',
    'groups/{group}/exams/', 'groups/{group}/exams/{exam}/', 'groups/{group}/announcements/',
    'groups/{group}/export/excel/', 'groups/{group}/exams/{exam}/export-excel/',
]


def path(world, template):
    return '/api/' + template.format(group=world.group.pk, lesson=world.lesson.pk, exam=world.exam.pk, game=world.game.pk)


@pytest.mark.parametrize('actor', ['foreign_admin', 'foreign_student', 'outsider', 'other_teacher'])
@pytest.mark.parametrize('endpoint', READ_PATHS)
def test_group_resources_deny_unrelated_users(world, actor, endpoint):
    assert client(getattr(world, actor)).get(path(world, endpoint)).status_code in (403, 404)


@pytest.mark.parametrize('method,endpoint,body', [
    ('patch', 'groups/{group}/', {'name':'Stolen'}),
    ('delete', 'groups/{group}/', {}),
    ('post', 'groups/{group}/lessons/', {'title':'Bad','date':'2026-10-20'}),
    ('post', 'groups/{group}/status/', {'status':'closed'}),
    ('post', 'groups/{group}/graduate/', {}),
    ('post', 'groups/{group}/exam-ready/', {}),
    ('post', 'groups/{group}/members/add/', {}),
    ('patch', 'groups/{group}/exams/{exam}/', {'status':'finished'}),
    ('post', 'groups/{group}/lessons/{lesson}/attendance/', {'records':[]}),
    ('post', 'groups/{group}/lessons/{lesson}/scores/', {'records':[]}),
    ('post', 'groups/{group}/lessons/{lesson}/game/start/', {}),
    ('post', 'groups/{group}/games/{game}/start/', {}),
])
def test_foreign_admin_cannot_mutate_group(world, method, endpoint, body):
    assert getattr(client(world.foreign_admin), method)(path(world, endpoint), body, format='json').status_code in (403,404)
    world.group.refresh_from_db()
    assert world.group.name == 'Group A'


def test_authorized_members_read_and_keys_are_private(world):
    for actor in [world.student, world.parent, world.teacher, world.admin]:
        response = client(actor).get(path(world, 'groups/{group}/'))
        assert response.status_code == 200
        assert ('join_key' in response.data) == (actor.role in ('admin','teacher'))
    assert client(world.foreign_student).post('/api/groups/join/', {'join_key':world.group.join_key}).status_code == 403


@pytest.mark.parametrize('kind,value', [('attendance', True), ('scores',4)])
def test_bulk_writes_reject_unenrolled_student_without_partial_changes(world, kind, value):
    key = 'present' if kind == 'attendance' else 'value'
    response = client(world.teacher).post(path(world,'groups/{group}/lessons/{lesson}/')+kind+'/', {
        'records':[{'student':world.student.pk,key:value},{'student':world.foreign_student.pk,key:value}],
    }, format='json')
    assert response.status_code == 400
    assert not Attendance.objects.filter(lesson=world.lesson).exists()
    assert not Score.objects.filter(lesson=world.lesson).exists()


@pytest.mark.parametrize('bad', ['bad', None, {}, 3.5])
def test_invalid_grade_returns_400(world, bad):
    res = client(world.teacher).post(path(world,'groups/{group}/lessons/{lesson}/scores/'),
        {'records':[{'student':world.student.pk,'value':bad}]},format='json')
    assert res.status_code == 400


def test_exam_bulk_validates_entire_request_and_limits_student_results(world):
    GroupMembership.objects.create(group=world.group, student=world.outsider)
    ExamResult.objects.create(exam=world.exam, student=world.student, scores=[5])
    ExamResult.objects.create(exam=world.exam, student=world.outsider, scores=[2])
    for actor in (world.student,world.parent):
        res=client(actor).get(path(world,'groups/{group}/exams/{exam}/'))
        assert [r['student'] for r in res.data['results']] == [world.student.pk]
    res=client(world.teacher).post(path(world,'groups/{group}/exams/{exam}/')+'submit/',{
        'results':[{'student':world.student.pk,'scores':[1]},{'student':world.foreign_student.pk,'scores':[5]}],
    },format='json')
    assert res.status_code == 400
    assert ExamResult.objects.get(exam=world.exam,student=world.student).scores == [5]


def test_quiz_content_and_owner_filter_are_tenant_scoped(world):
    for endpoint in ['quiz/questions/', f'quiz/questions/?owner={world.foreign_teacher.pk}', f'quiz/topics/?owner={world.foreign_teacher.pk}']:
        assert client(world.teacher).get('/api/'+endpoint).data == []
    for endpoint in [f'quiz/questions/{world.question.pk}/', f'quiz/topics/{world.topic.pk}/']:
        assert client(world.admin).patch('/api/'+endpoint, {'name':'Stolen'}, format='json').status_code == 404
    assert client(world.teacher).post('/api/quiz/questions/', {'topic':world.topic.pk,'text':'Bad'},format='json').status_code == 400
    assert client(world.teacher).post(path(world,'groups/{group}/games/'),{
        'name':'Bad quiz','topic_difficulty_counts':{str(world.topic.pk):{'easy':1}},
    },format='json').status_code == 404
    assert not QuizGame.objects.filter(name='Bad quiz').exists()


def test_invites_require_managed_group_and_parent_student(world):
    c=client(world.other_teacher)
    for group in [world.group,world.foreign_group]:
        res=c.post('/api/invites/create/',{'group':group.pk},format='json')
        assert res.status_code in (403,404)
    assert c.post('/api/invites/create/',{'role':'parent','student':world.student.pk},format='json').status_code == 404


def test_accept_rejects_legacy_cross_tenant_invite(world):
    invite=InviteToken.objects.create(academy=world.a, created_by=world.teacher, group=world.foreign_group,
        role='student', expires_at=timezone.now()+timedelta(days=1))
    assert client(world.outsider).post(f'/api/invites/{invite.token}/accept/').status_code == 400
    assert not world.foreign_group.memberships.filter(student=world.outsider).exists()


def test_removal_revokes_access_and_requires_teacher_reassignment(world):
    c=client(world.admin)
    assert c.delete(f'/api/academy/members/{world.teacher.pk}/').status_code == 409
    assert c.delete(f'/api/academy/members/{world.student.pk}/').status_code == 204
    world.student.refresh_from_db()
    assert world.student.academy_id is None
    assert not GroupMembership.objects.filter(student=world.student).exists()
    assert not ParentStudent.objects.filter(student=world.student).exists()
    assert client(world.student).get(path(world,'groups/{group}/')).status_code == 404
    world.teacher.academy=None
    world.teacher.save(update_fields=['academy'])
    world.group.refresh_from_db()
    assert world.group.academy_id == world.a.pk


@pytest.mark.parametrize('endpoint', ['','stats/','groups/','notify/'])
def test_foreign_staff_cannot_read_student_data(world,endpoint):
    assert client(world.foreign_admin).get(f'/api/auth/users/{world.student.pk}/{endpoint}').status_code in (403,404)


def test_foreign_parent_cannot_be_notification_recipient(world, monkeypatch):
    from users.models import Notification
    res=client(world.teacher).post(f'/api/auth/users/{world.student.pk}/notify/',{
        'message':'Hello','recipients':['student', world.foreign_admin.pk],
    },format='json')
    assert res.status_code == 400
    assert not Notification.objects.filter(body='Hello').exists()


def test_academy_announcements_do_not_leak(world):
    assert client(world.foreign_admin).get('/api/announcements/').data == []
    assert client(world.foreign_admin).delete(f'/api/announcements/{world.ann.pk}/').status_code == 404


@pytest.mark.parametrize('endpoint', ['academy/members/','invites/','groups/{group}/lessons/','groups/{group}/exams/'])
def test_invalid_pagination_is_400(world, endpoint):
    assert client(world.admin).get(path(world,endpoint),{'page':'oops'}).status_code == 400


def test_roster_query_count_does_not_grow_per_student(world):
    c=client(world.teacher)
    with CaptureQueriesContext(connection) as before:
        assert c.get(path(world,'groups/{group}/members/')).status_code == 200
    for i in range(20):
        student=User.objects.create_user(username=f'roster{i}',role='student',academy=world.a)
        GroupMembership.objects.create(group=world.group,student=student)
    with CaptureQueriesContext(connection) as after:
        assert c.get(path(world,'groups/{group}/members/')).status_code == 200
    assert len(after) <= len(before)+1


def test_weekly_report_uses_academy_ledger_once_and_respects_join_date(world):
    from coins.models import CoinTransaction
    from users.management.commands.send_weekly_report import _build_message
    CoinTransaction.objects.create(student=world.student, amount=7, type='game_place', reason='Test')
    message = _build_message(world.parent, timezone.localdate()-timedelta(days=6), timezone.localdate())
    assert 'Group A' in message
    assert message.count('+7') == 1


def test_academy_transfer_keeps_old_coins_and_purchases_private(world):
    from coins.models import CoinTransaction
    CoinTransaction.objects.create(student=world.student, amount=50, type='game_place', reason='A coins')
    assert CoinTransaction.balance_for(world.student) == 50
    world.student.academy = world.b
    world.student.save(update_fields=['academy'])
    assert CoinTransaction.balance_for(world.student) == 0
    assert CoinTransaction.objects.get(student=world.student).academy_id == world.a.pk
    CoinTransaction.objects.create(student=world.student, amount=3, type='game_place', reason='B coins')
    assert CoinTransaction.balance_for(world.student) == 3
    assert CoinTransaction.balances_for([world.student])[world.student.pk] == 3


@pytest.mark.parametrize('payload', [{'first':'oops'}, {'first':1,'second':1}, {'efforts':{'1':'oops'}}])
def test_game_close_invalid_payload_does_not_award_coins(world, payload):
    from games.models import Game
    from coins.models import CoinTransaction
    Attendance.objects.create(lesson=world.lesson, student=world.student, present=True)
    c=client(world.teacher)
    assert c.post(path(world,'groups/{group}/lessons/{lesson}/game/start/')).status_code == 201
    res=c.post(path(world,'groups/{group}/lessons/{lesson}/game/close/'),payload,format='json')
    assert res.status_code == 400
    assert not CoinTransaction.objects.exists()
    assert Game.objects.get(lesson=world.lesson).status == Game.Status.IN_PROGRESS


def test_password_change_revokes_old_access_and_refresh_tokens(world):
    c=APIClient()
    tokens=c.post('/api/auth/login/',{'username':world.student.username,'password':'pass1234'}).data
    c.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')
    assert c.get('/api/auth/me/').status_code == 200
    assert c.post('/api/auth/change-password/',{'old_password':'pass1234','new_password':'NewPassword123!'}).status_code == 200
    assert c.get('/api/auth/me/').status_code == 401
    c.credentials()
    assert c.post('/api/auth/token/refresh/',{'refresh':tokens['refresh']}).status_code == 401


def test_deleted_user_refresh_returns_401_instead_of_500(world):
    c=APIClient()
    tokens=c.post('/api/auth/login/',{'username':world.outsider.username,'password':'pass1234'}).data
    world.outsider.delete()
    assert c.post('/api/auth/token/refresh/',{'refresh':tokens['refresh']}).status_code == 401


def test_topic_ownership_does_not_move_when_creator_changes_academy(world):
    world.foreign_teacher.academy=world.a
    world.foreign_teacher.save(update_fields=['academy'])
    world.topic.refresh_from_db()
    assert world.topic.academy_id == world.b.pk
    assert client(world.foreign_teacher).get('/api/quiz/questions/').data == []
    assert client(world.foreign_teacher).patch(f'/api/quiz/questions/{world.question.pk}/',{'text':'Moved'},format='json').status_code == 404
    assert client(world.foreign_admin).get('/api/quiz/questions/').data[0]['id'] == world.question.pk


def test_health_checks_database_and_reports_failure(world, monkeypatch):
    from django.db import DatabaseError
    c=APIClient()
    assert c.get('/api/health/').json() == {'status':'ok'}
    def unavailable(*args,**kwargs):
        raise DatabaseError('Unavailable')
    monkeypatch.setattr(connection,'cursor',unavailable)
    assert c.get('/api/health/').status_code == 503


def test_refreshing_schedules_preserves_unchanged_job(world, monkeypatch):
    from datetime import time
    from apscheduler.schedulers.background import BackgroundScheduler
    from users import scheduler
    fake=BackgroundScheduler(timezone='UTC')
    monkeypatch.setattr(scheduler,'_scheduler',fake)
    world.a.report_time=time(15,0)
    scheduler.reschedule(world.a)
    job=fake.get_job(f'daily_report_{world.a.pk}')
    scheduler.reschedule(world.a)
    assert fake.get_job(job.id) is job
    world.a.report_time=None
    scheduler.reschedule(world.a)
    assert fake.get_job(job.id) is None


@pytest.mark.django_db(transaction=True)
def test_concurrent_invite_acceptance_obeys_use_limit():
    if connection.vendor != 'postgresql':
        pytest.skip('Requires PostgreSQL row locking')
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from django.db import close_old_connections
    academy=Academy.objects.create(name='Race',slug='race')
    teacher=User.objects.create_user(username='race_t',role='teacher',academy=academy)
    students=[User.objects.create_user(username=f'race_s{i}',role='student') for i in range(2)]
    invite=InviteToken.objects.create(academy=academy,created_by=teacher,role='student',max_uses=1,
        expires_at=timezone.now()+timedelta(days=1))
    barrier=Barrier(2)
    def accept(pk):
        close_old_connections()
        try:
            c=client(User.objects.get(pk=pk))
            barrier.wait(timeout=10)
            return c.post(f'/api/invites/{invite.token}/accept/').status_code
        finally:
            close_old_connections()
    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses=list(executor.map(accept,[s.pk for s in students]))
    assert sorted(statuses) == [200,400]
    invite.refresh_from_db()
    assert invite.use_count == 1
    assert invite.used_by.count() == 1
    assert User.objects.filter(pk__in=[s.pk for s in students],academy=academy).count() == 1


def test_teacher_cannot_list_another_staff_members_privileged_invites(world):
    token=InviteToken.objects.create(academy=world.a,created_by=world.admin,role='admin',
        expires_at=timezone.now()+timedelta(days=1))
    response=client(world.teacher).get('/api/invites/')
    assert response.status_code == 200
    assert response.data['total'] == 0
    assert str(token.token) not in str(response.data)


def test_students_cannot_read_telegram_group_configuration(world):
    assert client(world.student).get('/api/academy/telegram-groups/').status_code == 403


def test_parent_can_read_linked_child_groups(world):
    response=client(world.parent).get(f'/api/auth/users/{world.student.pk}/groups/')
    assert response.status_code == 200
    assert [g['id'] for g in response.data] == [world.group.pk]


def test_raw_admin_is_unavailable_to_tenant_staff_even_with_model_permissions(world):
    from django.contrib.auth.models import Permission
    world.admin.is_staff=True
    world.admin.save(update_fields=['is_staff'])
    world.admin.user_permissions.set(Permission.objects.all())
    c=APIClient()
    c.force_login(world.admin)
    response=c.get('/admin/groups/group/')
    assert response.status_code == 302
    assert '/admin/login/' in response.url
    response=c.post('/admin/groups/group/add/',{'name':'Unauthorized','teacher':world.foreign_teacher.pk})
    assert response.status_code == 302
    assert not Group.objects.filter(name='Unauthorized').exists()
    world.admin.is_superuser=True
    world.admin.save(update_fields=['is_superuser'])
    assert c.get('/admin/groups/group/').status_code == 200


def test_authenticated_caller_cannot_bypass_password_reset_throttle(world, monkeypatch):
    from backend.throttles import PasswordResetRateThrottle
    from django.core.cache import cache
    cache.clear()
    monkeypatch.setattr(PasswordResetRateThrottle, 'get_rate', lambda self: '2/minute')
    c=client(world.admin)
    assert c.post('/api/auth/password-reset/confirm/',{}).status_code == 400
    assert c.post('/api/auth/password-reset/confirm/',{}).status_code == 400
    assert c.post('/api/auth/password-reset/confirm/',{}).status_code == 429
    cache.clear()


def test_rate_limit_identity_ignores_spoofed_forwarded_prefix(settings):
    from backend.throttles import LoginRateThrottle
    from rest_framework.test import APIRequestFactory
    settings.REST_FRAMEWORK={**settings.REST_FRAMEWORK,'NUM_PROXIES':2}
    factory=APIRequestFactory()
    throttle=LoginRateThrottle()
    for prefix in ('203.0.113.11','203.0.113.22'):
        request=factory.post('/api/auth/login/',{},HTTP_X_FORWARDED_FOR=f'{prefix}, 198.51.100.1, 172.18.0.3')
        assert throttle.get_ident(request) == '198.51.100.1'


@pytest.mark.parametrize('endpoint',['groups/','quiz/topics/'])
def test_list_query_count_does_not_grow_per_item(world,endpoint):
    c=client(world.teacher)
    with CaptureQueriesContext(connection) as before:
        assert c.get('/api/'+endpoint).status_code == 200
    for i in range(20):
        if endpoint=='groups/':
            Group.objects.create(name=f'Group {i}',teacher=world.teacher)
        else:
            topic=Topic.objects.create(name=f'Topic {i}',created_by=world.teacher)
            Question.objects.create(topic=topic,created_by=world.teacher,text='Question')
    with CaptureQueriesContext(connection) as after:
        response=c.get('/api/'+endpoint)
        assert response.status_code == 200
    assert len(after)<=len(before)+1


def test_academyless_admin_cannot_create_or_manage_tenant_groups(world):
    actor=User.objects.create_user(username='no_academy_admin',role='admin')
    c=client(actor)
    assert c.post('/api/groups/',{'name':'Invisible group'},format='json').status_code == 403
    assert c.patch(path(world,'groups/{group}/'),{'name':'Stolen'},format='json').status_code == 404


def test_scheduler_lease_rejects_duplicate_process_and_releases(settings, tmp_path):
    from django.core.management.base import CommandError
    from users.scheduler_lock import scheduler_lease
    settings.SCHEDULER_LOCK_FILE=tmp_path/'scheduler.lock'
    with scheduler_lease() as verify:
        verify()
        with pytest.raises(CommandError, match='already running'):
            with scheduler_lease():
                pytest.fail('Second scheduler must not acquire the lease')
    with scheduler_lease() as verify:
        verify()


def test_teacher_cannot_remove_shared_student_or_parent(world):
    other_group=Group.objects.create(name='Other class',teacher=world.other_teacher)
    GroupMembership.objects.create(group=other_group,student=world.student)
    c=client(world.teacher)
    for member in (world.student,world.parent):
        assert c.delete(f'/api/academy/members/{member.pk}/').status_code == 403
        member.refresh_from_db()
        assert member.academy_id == world.a.pk
    assert GroupMembership.objects.filter(student=world.student).count() == 2
    assert ParentStudent.objects.filter(parent=world.parent,student=world.student).exists()


def test_deleting_group_reverses_unspent_game_coins(world):
    from coins.models import CoinTransaction
    from games.models import Game, GameResult
    game=Game.objects.create(group=world.group,lesson=world.lesson,teacher=world.teacher,
        date=world.lesson.date,status=Game.Status.CLOSED)
    GameResult.objects.create(game=game,student=world.student,coins=10)
    CoinTransaction.objects.create(student=world.student,amount=10,type='game_place',reason='Game')
    assert client(world.teacher).delete(path(world,'groups/{group}/')).status_code == 204
    assert CoinTransaction.balance_for(world.student) == 0
    assert CoinTransaction.objects.filter(student=world.student,type='adjustment').count() == 1


def test_tenant_audit_is_read_only_and_reports_invalid_links(world):
    import io
    import json
    from django.core.management import call_command
    from django.core.management.base import CommandError
    output=io.StringIO()
    call_command('audit_tenant_data',strict=True,stdout=output)
    assert not any(json.loads(output.getvalue()).values())
    membership=GroupMembership.objects.create(group=world.foreign_group,student=world.student)
    output=io.StringIO()
    with pytest.raises(CommandError,match='no data was changed'):
        call_command('audit_tenant_data',strict=True,stdout=output)
    assert json.loads(output.getvalue())['invalid_group_memberships'] == 1
    assert GroupMembership.objects.filter(pk=membership.pk).exists()


@pytest.mark.django_db(transaction=True)
def test_ownership_migrations_backfill_existing_data_without_loss():
    from django.db.migrations.executor import MigrationExecutor
    executor=MigrationExecutor(connection)
    latest=executor.loader.graph.leaf_nodes()
    previous=[node for node in latest if node[0] not in ('groups','quiz','coins')]+[
        ('groups','0024_group_status'),('quiz','0002_question_hint'),('coins','0006_coinsetting_academy_notnull'),
    ]
    try:
        executor.migrate(previous)
        old=executor.loader.project_state(previous).apps
        AcademyOld=old.get_model('academies','Academy')
        UserOld=old.get_model('users','User')
        academy=AcademyOld.objects.create(name='Migration academy',slug='migration-academy')
        teacher=UserOld.objects.create(username='migration_teacher',role='teacher',academy_id=academy.pk)
        student=UserOld.objects.create(username='migration_student',role='student',academy_id=academy.pk)
        group=old.get_model('groups','Group').objects.create(name='Migration group',teacher_id=teacher.pk,join_key='MIGRATE1')
        announcement=old.get_model('groups','Announcement').objects.create(author_id=teacher.pk,group_id=group.pk,title='Preserved')
        topic=old.get_model('quiz','Topic').objects.create(created_by_id=teacher.pk,name='Preserved topic')
        txn=old.get_model('coins','CoinTransaction').objects.create(student_id=student.pk,amount=17,type='adjustment',reason='Preserved')
        executor=MigrationExecutor(connection)
        executor.migrate(latest)
        new=executor.loader.project_state(latest).apps
        for app,model,pk in [('groups','Group',group.pk),('groups','Announcement',announcement.pk),
                             ('quiz','Topic',topic.pk),('coins','CoinTransaction',txn.pk)]:
            assert new.get_model(app,model).objects.get(pk=pk).academy_id == academy.pk
        assert new.get_model('coins','CoinTransaction').objects.get(pk=txn.pk).amount == 17
    finally:
        MigrationExecutor(connection).migrate(latest)
