import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from academies.models import Academy
from groups.models import Attendance, Group, GroupMembership, Lesson
from coins.models import CoinSetting, CoinTransaction
from games.models import Game
from rewards.models import Reward
from purchases.models import Purchase

User = get_user_model()


@pytest.fixture
def academy(db):
    return Academy.objects.create(name='Games Test Academy', slug='games-test-academy')


@pytest.fixture
def teacher(academy):
    return User.objects.create_user(username='g_teacher', password='pass1234', role='teacher', academy=academy)


@pytest.fixture
def teacher_client(teacher):
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': 'g_teacher', 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    return client


@pytest.fixture
def group(teacher):
    return Group.objects.create(name='Games Group', teacher=teacher, class_days=[0, 1, 2, 3, 4, 5, 6])


@pytest.fixture
def students(academy, group):
    users = []
    for i in range(5):
        u = User.objects.create_user(username=f'g_student{i}', password='pass1234', role='student', academy=academy)
        GroupMembership.objects.create(group=group, student=u)
        users.append(u)
    return users


@pytest.fixture
def lesson(group):
    return Lesson.objects.create(group=group, title='Test Lesson', date='2026-08-03')  # Monday — normal day


def _mark_present(lesson, students):
    for s in students:
        Attendance.objects.create(lesson=lesson, student=s, present=True)


@pytest.mark.django_db
def test_start_creates_snapshot_and_in_progress(teacher_client, lesson, group, students):
    _mark_present(lesson, students)
    res = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    assert res.status_code == 201
    assert res.data['status'] == 'in_progress'
    game = Game.objects.get(lesson=lesson)
    assert game.applied_rules == {'p1': 5, 'p2': 4, 'p3': 3, 'effort_min': 1, 'effort_max': 2, 'big': False}


@pytest.mark.django_db
def test_big_day_uses_big_rates(teacher_client, group, students):
    lesson = Lesson.objects.create(group=group, title='Big Day', date='2026-08-07')  # Friday — big day
    _mark_present(lesson, students)
    res = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    assert res.data['is_big_day'] is True
    assert res.data['applied_rules']['p1'] == 10


@pytest.mark.django_db
def test_one_game_per_day_per_group(teacher_client, lesson, group, students):
    _mark_present(lesson, students)
    res1 = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    assert res1.status_code == 201
    res2 = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    assert res2.status_code == 400


@pytest.mark.django_db
def test_weekly_game_limit(teacher_client, group, students):
    # default max_games_per_week=3; Mon–Thu of the same week
    dates = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06']
    for i, d in enumerate(dates):
        lesson = Lesson.objects.create(group=group, title=f'L{i}', date=d)
        _mark_present(lesson, students)
        res = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
        if i < 3:
            assert res.status_code == 201, f'game {i} should have been allowed to start'
        else:
            assert res.status_code == 400


@pytest.mark.django_db
def test_close_is_idempotent(teacher_client, lesson, group, students):
    _mark_present(lesson, students)
    teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    payload = {'first': students[0].id, 'second': students[1].id, 'efforts': {}}

    res1 = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/close/', payload, format='json')
    assert res1.status_code == 200
    balance_after_first = CoinTransaction.balance_for(students[0])

    res2 = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/close/', payload, format='json')
    assert res2.status_code == 200
    assert CoinTransaction.balance_for(students[0]) == balance_after_first  # not doubled


@pytest.mark.django_db
def test_place_and_effort_coin_math(teacher_client, lesson, group, students):
    _mark_present(lesson, students)
    teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    payload = {
        'first': students[0].id, 'second': students[1].id, 'third': students[2].id,
        'efforts': {str(students[3].id): 2, str(students[4].id): 0},
    }
    res = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/close/', payload, format='json')
    assert res.status_code == 200
    assert CoinTransaction.balance_for(students[0]) == 5   # place 1, normal day
    assert CoinTransaction.balance_for(students[1]) == 4   # place 2
    assert CoinTransaction.balance_for(students[2]) == 3   # place 3
    assert CoinTransaction.balance_for(students[3]) == 2   # effort GOOD -> effort_max
    assert CoinTransaction.balance_for(students[4]) == 0   # effort NONE


@pytest.mark.django_db
def test_absent_student_cannot_be_placed(teacher_client, lesson, group, students):
    _mark_present(lesson, students[:3])  # students[3] and [4] stay absent
    teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    payload = {'first': students[3].id, 'efforts': {}}
    res = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/close/', payload, format='json')
    assert res.status_code == 400


@pytest.mark.django_db
def test_applied_rules_snapshot_immune_to_later_setting_changes(teacher_client, lesson, group, students):
    _mark_present(lesson, students)
    teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    game = Game.objects.get(lesson=lesson)
    assert game.applied_rules['p1'] == 5

    setting = CoinSetting.get()
    setting.place_1_normal = 999
    setting.save()

    game.refresh_from_db()
    assert game.applied_rules['p1'] == 5  # snapshot unaffected by the later setting change

    payload = {'first': students[0].id, 'efforts': {}}
    teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/close/', payload, format='json')
    assert CoinTransaction.balance_for(students[0]) == 5  # used the snapshot, not the new 999


@pytest.mark.django_db
def test_cancel_deletes_game_without_awarding_coins(teacher_client, lesson, group, students):
    _mark_present(lesson, students)
    teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    res = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/cancel/')
    assert res.status_code == 204
    assert not Game.objects.filter(lesson=lesson).exists()
    assert CoinTransaction.balance_for(students[0]) == 0

    res2 = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    assert res2.status_code == 201  # cancelling frees up the daily slot again


@pytest.mark.django_db
def test_individual_lesson_flow(teacher_client, academy, teacher):
    ind_group = Group.objects.create(name='Individual Group', teacher=teacher, is_individual=True, class_days=[0])
    student = User.objects.create_user(username='ind_student', password='pass1234', role='student', academy=academy)
    GroupMembership.objects.create(group=ind_group, student=student)
    lesson = Lesson.objects.create(group=ind_group, title='Ind Lesson', date='2026-08-03')
    Attendance.objects.create(lesson=lesson, student=student, present=True)

    res = teacher_client.post(f'/api/groups/{ind_group.id}/lessons/{lesson.id}/game/start/')
    assert res.status_code == 201
    assert res.data['applied_rules'] == {'individual': 3, 'big': False}

    res2 = teacher_client.post(
        f'/api/groups/{ind_group.id}/lessons/{lesson.id}/game/close/', {'completed': True}, format='json',
    )
    assert res2.status_code == 200
    assert CoinTransaction.balance_for(student) == 3


@pytest.mark.django_db
def test_can_pick_third_flag_respects_min_group_size(teacher_client, teacher, academy):
    small_group = Group.objects.create(name='Small', teacher=teacher, class_days=[0])
    for i in range(2):  # below default min_group_for_3rd=6
        s = User.objects.create_user(username=f'small{i}', password='pass1234', role='student', academy=academy)
        GroupMembership.objects.create(group=small_group, student=s)
    lesson = Lesson.objects.create(group=small_group, title='Small Lesson', date='2026-08-03')

    res = teacher_client.get(f'/api/groups/{small_group.id}/lessons/{lesson.id}/game/')
    assert res.status_code == 200
    assert res.data['can_pick_third'] is False


@pytest.mark.django_db
def test_start_response_includes_can_pick_third(teacher_client, lesson, group, students):
    # Regression: the start response used to omit this flag, so the 3rd-place
    # picker stayed hidden in the same session until the page was reloaded.
    _mark_present(lesson, students)  # 5 present, but group has 5 members total < default min of 6
    res = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    assert res.status_code == 201
    assert res.data['can_pick_third'] is False

    sixth = User.objects.create_user(username='g_student5', password='pass1234', role='student', academy=group.teacher.academy)
    GroupMembership.objects.create(group=group, student=sixth)
    lesson2 = Lesson.objects.create(group=group, title='Second Lesson', date='2026-08-04')
    res2 = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson2.id}/game/start/')
    assert res2.status_code == 201
    assert res2.data['can_pick_third'] is True


@pytest.mark.django_db
def test_group_game_history_visible_to_any_authenticated_user(teacher_client, lesson, group, students):
    _mark_present(lesson, students)
    teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    teacher_client.post(
        f'/api/groups/{group.id}/lessons/{lesson.id}/game/close/', {'first': students[0].id, 'efforts': {}}, format='json',
    )

    student_client = APIClient()
    res = student_client.post('/api/auth/login/', {'username': students[0].username, 'password': 'pass1234'})
    student_client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')

    res2 = student_client.get(f'/api/groups/{group.id}/game-history/')
    assert res2.status_code == 200
    assert len(res2.data) == 1
    assert res2.data[0]['status'] == 'closed'


@pytest.mark.django_db
def test_deleting_lesson_reverses_awarded_coins(teacher_client, lesson, group, students):
    _mark_present(lesson, students)
    teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    teacher_client.post(
        f'/api/groups/{group.id}/lessons/{lesson.id}/game/close/',
        {'first': students[0].id, 'second': students[1].id, 'efforts': {}}, format='json',
    )
    assert CoinTransaction.balance_for(students[0]) == 5
    assert CoinTransaction.balance_for(students[1]) == 4

    res = teacher_client.delete(f'/api/groups/{group.id}/lessons/{lesson.id}/')
    assert res.status_code == 204

    assert CoinTransaction.balance_for(students[0]) == 0
    assert CoinTransaction.balance_for(students[1]) == 0
    assert not Game.objects.filter(lesson_id=lesson.id).exists()


@pytest.mark.django_db
def test_deleting_lesson_with_unclosed_game_awards_nothing_to_reverse(teacher_client, lesson, group, students):
    _mark_present(lesson, students)
    teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')

    res = teacher_client.delete(f'/api/groups/{group.id}/lessons/{lesson.id}/')
    assert res.status_code == 204
    assert CoinTransaction.balance_for(students[0]) == 0


@pytest.mark.django_db
def test_deleting_lesson_reversal_floors_at_zero_if_coins_already_spent(teacher_client, lesson, group, students):
    # Student places 1st (+5), then spends most of it on a reward before the
    # teacher deletes the lesson — the reversal must not push them negative.
    _mark_present(lesson, students)
    teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/game/start/')
    teacher_client.post(
        f'/api/groups/{group.id}/lessons/{lesson.id}/game/close/',
        {'first': students[0].id, 'efforts': {}}, format='json',
    )
    assert CoinTransaction.balance_for(students[0]) == 5

    reward = Reward.objects.create(name='Snack', price=3, stock=5, status=Reward.Status.AVAILABLE, category=Reward.Category.SNACK)
    Purchase.objects.create(
        student=students[0], reward=reward, quantity=1, price_at_order=3, total_price=3,
        code='ABC123', expires_at=timezone.now() + timezone.timedelta(days=14),
    )
    CoinTransaction.objects.create(student=students[0], amount=-3, type=CoinTransaction.Type.PURCHASE, reason='Snack')
    assert CoinTransaction.balance_for(students[0]) == 2

    res = teacher_client.delete(f'/api/groups/{group.id}/lessons/{lesson.id}/')
    assert res.status_code == 204

    # Floored at 0, not -3 — the 3 already-spent coins aren't clawed back.
    assert CoinTransaction.balance_for(students[0]) == 0
