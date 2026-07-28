import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from academies.models import Academy
from groups.models import Group, Lesson, Attendance

User = get_user_model()


@pytest.fixture
def academy(db):
    return Academy.objects.create(name='Test Academy', slug='test-academy')


@pytest.fixture
def teacher(academy):
    return User.objects.create_user(
        username='teacher1', password='pass1234', role='teacher', academy=academy,
    )


@pytest.fixture
def student(academy):
    return User.objects.create_user(
        username='student1', password='pass1234', role='student', academy=academy,
    )


@pytest.fixture
def teacher_client(teacher):
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': 'teacher1', 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    return client


@pytest.fixture
def group(teacher):
    return Group.objects.create(name='Math', teacher=teacher, class_days=[0, 2, 4])


@pytest.mark.django_db
def test_create_group(teacher_client):
    res = teacher_client.post('/api/groups/', {
        'name': 'Physics', 'class_days': [1, 3],
    })
    assert res.status_code == 201
    assert Group.objects.filter(name='Physics').exists()


@pytest.mark.django_db
def test_list_groups(teacher_client, group):
    res = teacher_client.get('/api/groups/')
    assert res.status_code == 200
    assert any(g['name'] == 'Math' for g in res.data)


@pytest.mark.django_db
def test_create_lesson(teacher_client, group):
    res = teacher_client.post(f'/api/groups/{group.id}/lessons/', {
        'title': 'Lesson 1', 'date': '2026-05-25', 'homework': '',
    })
    assert res.status_code == 201
    assert Lesson.objects.filter(title='Lesson 1').exists()


@pytest.mark.django_db
def test_attendance_saved(teacher_client, group, student):
    from groups.models import GroupMembership
    GroupMembership.objects.create(group=group, student=student)
    lesson = Lesson.objects.create(group=group, title='L1', date='2026-05-25')
    Attendance.objects.create(lesson=lesson, student=student, present=False)

    res = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/attendance/', {
        'records': [{'student': student.id, 'present': True}]
    }, format='json')
    assert res.status_code == 200
    assert Attendance.objects.get(lesson=lesson, student=student).present is True


@pytest.mark.django_db
def test_daily_report_skips_day_off_groups(academy, teacher, monkeypatch):
    import datetime
    from groups.models import GroupDayOff
    from users.management.commands import send_daily_report as report_mod

    fixed_date = datetime.date(2026, 8, 3)  # Monday
    assert fixed_date.weekday() == 0
    monkeypatch.setattr(report_mod.timezone, 'localdate', lambda: fixed_date)
    monkeypatch.setenv('TELEGRAM_BOT_TOKEN', 'test-token')

    sent = []
    monkeypatch.setattr(report_mod, '_send', lambda token, chat_id, text: sent.append((chat_id, text)))

    g_forgot = Group.objects.create(name='Forgot', teacher=teacher, class_days=[0])
    g_dayoff = Group.objects.create(name='DayOff', teacher=teacher, class_days=[0])
    GroupDayOff.objects.create(group=g_dayoff, date=fixed_date, reason='sick', created_by=teacher)

    teacher.telegram_id = 555
    teacher.save()

    report_mod.run_report_for_academy(academy)

    reminder_texts = [text for chat_id, text in sent if chat_id == teacher.telegram_id]
    assert len(reminder_texts) == 1
    assert 'Forgot' in reminder_texts[0]
    assert 'DayOff' not in reminder_texts[0]


@pytest.mark.django_db
def test_student_cannot_create_group(student):
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': 'student1', 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    res = client.post('/api/groups/', {'name': 'Hack', 'class_days': []})
    assert res.status_code == 403
