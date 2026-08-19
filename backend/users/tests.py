import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    from academies.models import Academy
    academy = Academy.objects.create(name='Test Academy', slug='test-academy')
    user = User.objects.create_user(
        username='admin1', password='pass1234',
        role='admin', academy=academy,
    )
    return user


@pytest.fixture
def auth_client(admin_user):
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': 'admin1', 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    return client


@pytest.mark.django_db
def test_register(client):
    res = client.post('/api/auth/register/', {
        'username': 'newuser', 'password': 'pass1234', 'email': 'new@test.com',
    })
    assert res.status_code == 201
    assert User.objects.filter(username='newuser').exists()


@pytest.mark.django_db
def test_login(client, admin_user):
    res = client.post('/api/auth/login/', {'username': 'admin1', 'password': 'pass1234'})
    assert res.status_code == 200
    assert 'access' in res.data


@pytest.mark.django_db
def test_login_wrong_password(client, admin_user):
    res = client.post('/api/auth/login/', {'username': 'admin1', 'password': 'wrong'})
    assert res.status_code == 401


@pytest.mark.django_db
def test_me(auth_client):
    res = auth_client.get('/api/auth/me/')
    assert res.status_code == 200
    assert res.data['username'] == 'admin1'


@pytest.mark.django_db
def test_me_unauthenticated(client):
    res = client.get('/api/auth/me/')
    assert res.status_code == 401


@pytest.mark.django_db
def test_change_password(auth_client):
    res = auth_client.post('/api/auth/change-password/', {
        'old_password': 'pass1234',
        'new_password': 'newpass5678',
    })
    assert res.status_code == 200


# ── Teacher leaderboard (rewritten to bulk-fetch instead of N+1 querying) ──

def _teacher_client(username):
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': username, 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    return client


@pytest.mark.django_db
def test_teacher_leaderboard_forbidden_for_non_teacher(auth_client):
    res = auth_client.get('/api/auth/teacher/leaderboard/')
    assert res.status_code == 403


@pytest.mark.django_db
def test_teacher_leaderboard_computes_score_and_attendance():
    from datetime import date, timedelta
    from django.utils import timezone
    from academies.models import Academy
    from groups.models import Group, GroupMembership, Lesson, Score, Attendance

    academy = Academy.objects.create(name='Leaderboard Academy', slug='leaderboard-academy')
    teacher = User.objects.create_user(username='lb_teacher', password='pass1234', role='teacher', academy=academy)
    student_a = User.objects.create_user(username='lb_student_a', password='pass1234', role='student', academy=academy)
    student_b = User.objects.create_user(username='lb_student_b', password='pass1234', role='student', academy=academy)

    group = Group.objects.create(name='Group X', teacher=teacher, class_days=[0, 2, 4])
    join_date = timezone.now() - timedelta(days=30)
    GroupMembership.objects.create(group=group, student=student_a, joined_at=join_date)
    GroupMembership.objects.create(group=group, student=student_b, joined_at=join_date)

    lesson1 = Lesson.objects.create(group=group, title='Lesson 1', date=date.today() - timedelta(days=10))
    lesson2 = Lesson.objects.create(group=group, title='Lesson 2', date=date.today() - timedelta(days=5))

    Attendance.objects.create(lesson=lesson1, student=student_a, present=True)
    Attendance.objects.create(lesson=lesson2, student=student_a, present=True)
    Score.objects.create(lesson=lesson1, student=student_a, value=4)
    Score.objects.create(lesson=lesson2, student=student_a, value=5)

    Attendance.objects.create(lesson=lesson1, student=student_b, present=True)
    Attendance.objects.create(lesson=lesson2, student=student_b, present=False)
    Score.objects.create(lesson=lesson1, student=student_b, value=3)

    res = _teacher_client('lb_teacher').get('/api/auth/teacher/leaderboard/')
    assert res.status_code == 200
    by_username = {r['username']: r for r in res.data}

    a = by_username['lb_student_a']
    assert a['avg_score'] == 90  # 9/10 * 100
    assert a['attendance'] == 100
    assert a['groups'] == ['Group X']

    b = by_username['lb_student_b']
    assert b['avg_score'] == 30  # 3/10 * 100
    assert b['attendance'] == 50  # 1 present / 2 attendance rows


@pytest.mark.django_db
def test_teacher_leaderboard_excludes_lessons_before_join_date():
    from datetime import date, timedelta
    from django.utils import timezone
    from academies.models import Academy
    from groups.models import Group, GroupMembership, Lesson, Score, Attendance

    academy = Academy.objects.create(name='Join Date Academy', slug='join-date-academy')
    teacher = User.objects.create_user(username='jd_teacher', password='pass1234', role='teacher', academy=academy)
    student = User.objects.create_user(username='jd_student', password='pass1234', role='student', academy=academy)

    group = Group.objects.create(name='Group Y', teacher=teacher, class_days=[0, 2, 4])
    old_lesson = Lesson.objects.create(group=group, title='Old', date=date.today() - timedelta(days=20))
    GroupMembership.objects.create(group=group, student=student, joined_at=timezone.now() - timedelta(days=5))
    new_lesson = Lesson.objects.create(group=group, title='New', date=date.today())

    Attendance.objects.create(lesson=old_lesson, student=student, present=True)
    Score.objects.create(lesson=old_lesson, student=student, value=5)
    Attendance.objects.create(lesson=new_lesson, student=student, present=True)
    Score.objects.create(lesson=new_lesson, student=student, value=2)

    res = _teacher_client('jd_teacher').get('/api/auth/teacher/leaderboard/')
    assert res.status_code == 200
    entry = res.data[0]
    # Only "new" (on/after join date) should count — "old" predates the membership.
    assert entry['avg_score'] == 40  # 2/5 * 100
    assert entry['attendance'] == 100


@pytest.mark.django_db
def test_teacher_leaderboard_aggregates_across_multiple_groups():
    from datetime import date, timedelta
    from django.utils import timezone
    from academies.models import Academy
    from groups.models import Group, GroupMembership, Lesson, Score, Attendance

    academy = Academy.objects.create(name='Multi Group Academy', slug='multi-group-academy')
    teacher = User.objects.create_user(username='mg_teacher', password='pass1234', role='teacher', academy=academy)
    student = User.objects.create_user(username='mg_student', password='pass1234', role='student', academy=academy)

    group1 = Group.objects.create(name='Group Alpha', teacher=teacher, class_days=[0, 2])
    group2 = Group.objects.create(name='Group Beta', teacher=teacher, class_days=[1, 3])
    join_date = timezone.now() - timedelta(days=30)
    GroupMembership.objects.create(group=group1, student=student, joined_at=join_date)
    GroupMembership.objects.create(group=group2, student=student, joined_at=join_date)

    l1 = Lesson.objects.create(group=group1, title='A1', date=date.today() - timedelta(days=10))
    l2 = Lesson.objects.create(group=group2, title='B1', date=date.today() - timedelta(days=8))
    Attendance.objects.create(lesson=l1, student=student, present=True)
    Score.objects.create(lesson=l1, student=student, value=5)
    Attendance.objects.create(lesson=l2, student=student, present=True)
    Score.objects.create(lesson=l2, student=student, value=5)

    res = _teacher_client('mg_teacher').get('/api/auth/teacher/leaderboard/')
    assert res.status_code == 200
    assert len(res.data) == 1
    entry = res.data[0]
    assert entry['groups'] == ['Group Alpha', 'Group Beta']
    assert entry['avg_score'] == 100
    assert entry['attendance'] == 100


@pytest.mark.django_db
def test_teacher_leaderboard_query_count_independent_of_membership_count(django_assert_max_num_queries):
    """Guards against re-introducing the N+1: query count should stay flat
    whether there are 2 memberships or 20, since everything is bulk-fetched."""
    from datetime import date, timedelta
    from django.utils import timezone
    from academies.models import Academy
    from groups.models import Group, GroupMembership, Lesson, Score, Attendance

    academy = Academy.objects.create(name='Query Count Academy', slug='query-count-academy')
    teacher = User.objects.create_user(username='qc_teacher', password='pass1234', role='teacher', academy=academy)
    join_date = timezone.now() - timedelta(days=30)

    for i in range(20):
        student = User.objects.create_user(username=f'qc_student_{i}', password='pass1234', role='student', academy=academy)
        group = Group.objects.create(name=f'Group {i}', teacher=teacher, class_days=[0, 2])
        GroupMembership.objects.create(group=group, student=student, joined_at=join_date)
        lesson = Lesson.objects.create(group=group, title='L', date=date.today() - timedelta(days=1))
        Attendance.objects.create(lesson=lesson, student=student, present=True)
        Score.objects.create(lesson=lesson, student=student, value=5)

    with django_assert_max_num_queries(10):
        res = _teacher_client('qc_teacher').get('/api/auth/teacher/leaderboard/')
    assert res.status_code == 200
    assert len(res.data) == 20


# ── reset_coin_balance admin action (rewritten to bulk-fetch balances) ────

def _admin_request(admin_user, post_data):
    from django.test import RequestFactory
    from django.contrib.sessions.middleware import SessionMiddleware
    from django.contrib.messages.storage.fallback import FallbackStorage

    request = RequestFactory().post('/admin/users/user/', data=post_data)
    request.user = admin_user
    SessionMiddleware(lambda r: None).process_request(request)
    request.session.save()
    request._messages = FallbackStorage(request)
    return request


@pytest.mark.django_db
def test_reset_coin_balance_bulk_resets_students():
    from academies.models import Academy
    from coins.models import CoinTransaction
    from users.admin import reset_coin_balance, CustomUserAdmin
    from django.contrib import admin as django_admin

    academy = Academy.objects.create(name='Reset Action Academy', slug='reset-action-academy')
    admin = User.objects.create_user(username='reset_admin', password='pass1234', role='admin', academy=academy, is_staff=True, is_superuser=True)
    s1 = User.objects.create_user(username='reset_s1', password='pass1234', role='student', academy=academy)
    s2 = User.objects.create_user(username='reset_s2', password='pass1234', role='student', academy=academy)

    CoinTransaction.objects.create(student=s1, amount=15, type=CoinTransaction.Type.GAME_PLACE, reason='x')
    CoinTransaction.objects.create(student=s1, amount=-5, type=CoinTransaction.Type.PURCHASE, reason='y')
    # s2 has zero balance already (no transactions)

    request = _admin_request(admin, {'apply': 'yes'})
    modeladmin = CustomUserAdmin(User, django_admin.site)
    reset_coin_balance(modeladmin, request, User.objects.filter(id__in=[s1.id, s2.id]))

    assert CoinTransaction.balance_for(s1) == 0
    assert CoinTransaction.balance_for(s2) == 0


@pytest.mark.django_db
def test_reset_coin_balance_confirm_page_shows_correct_totals():
    from academies.models import Academy
    from coins.models import CoinTransaction
    from users.admin import reset_coin_balance, CustomUserAdmin
    from django.contrib import admin as django_admin

    academy = Academy.objects.create(name='Confirm Page Academy', slug='confirm-page-academy')
    admin = User.objects.create_user(username='confirm_admin', password='pass1234', role='admin', academy=academy, is_staff=True, is_superuser=True)
    s1 = User.objects.create_user(username='confirm_s1', password='pass1234', role='student', academy=academy)
    CoinTransaction.objects.create(student=s1, amount=42, type=CoinTransaction.Type.GAME_PLACE, reason='x')

    request = _admin_request(admin, {})  # no 'apply' -> confirm page, no changes made
    modeladmin = CustomUserAdmin(User, django_admin.site)
    response = reset_coin_balance(modeladmin, request, User.objects.filter(id=s1.id))
    response.render()

    assert response.status_code == 200
    assert b'42' in response.content
    assert CoinTransaction.balance_for(s1) == 42  # untouched


@pytest.mark.django_db
def test_reset_coin_balance_scoped_to_own_academy_for_non_superuser():
    from academies.models import Academy
    from coins.models import CoinTransaction
    from users.admin import reset_coin_balance, CustomUserAdmin
    from django.contrib import admin as django_admin

    academy = Academy.objects.create(name='Scoped Academy', slug='scoped-academy')
    other_academy = Academy.objects.create(name='Other Scoped Academy', slug='other-scoped-academy')
    admin = User.objects.create_user(username='scoped_admin', password='pass1234', role='admin', academy=academy, is_staff=True)
    own_student = User.objects.create_user(username='scoped_own', password='pass1234', role='student', academy=academy)
    other_student = User.objects.create_user(username='scoped_other', password='pass1234', role='student', academy=other_academy)

    CoinTransaction.objects.create(student=own_student, amount=10, type=CoinTransaction.Type.GAME_PLACE, reason='x')
    CoinTransaction.objects.create(student=other_student, amount=10, type=CoinTransaction.Type.GAME_PLACE, reason='x')

    request = _admin_request(admin, {'apply': 'yes'})
    modeladmin = CustomUserAdmin(User, django_admin.site)
    reset_coin_balance(modeladmin, request, User.objects.filter(id__in=[own_student.id, other_student.id]))

    assert CoinTransaction.balance_for(own_student) == 0
    assert CoinTransaction.balance_for(other_student) == 10  # untouched — different academy
