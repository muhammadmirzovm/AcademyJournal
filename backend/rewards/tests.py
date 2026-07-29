import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from academies.models import Academy
from rewards.models import Reward

User = get_user_model()


@pytest.fixture
def academy(db):
    return Academy.objects.create(name='Test Academy', slug='test-academy-rewards')


@pytest.fixture
def admin_user(academy):
    return User.objects.create_user(username='rw_admin', password='pass1234', role='admin', academy=academy)


@pytest.fixture
def student_user(academy):
    return User.objects.create_user(username='rw_student', password='pass1234', role='student', academy=academy)


def _client_for(username):
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': username, 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    return client


@pytest.mark.django_db
def test_rewards_list_visible_to_any_role_and_hides_hidden(admin_user, student_user):
    Reward.objects.create(name='Visible', price=100, status=Reward.Status.AVAILABLE)
    Reward.objects.create(name='Secret', price=100, status=Reward.Status.HIDDEN)

    client = _client_for('rw_student')
    res = client.get('/api/rewards/')
    assert res.status_code == 200
    names = [r['name'] for r in res.data]
    assert 'Visible' in names
    assert 'Secret' not in names


@pytest.mark.django_db
def test_only_admin_can_create_reward(admin_user, student_user):
    payload = {'name': 'New Reward', 'price': 50, 'stock': 5, 'category': 'other', 'status': 'coming_soon'}

    student_client = _client_for('rw_student')
    res = student_client.post('/api/rewards/', payload, format='json')
    assert res.status_code == 403
    assert not Reward.objects.filter(name='New Reward').exists()

    admin_client = _client_for('rw_admin')
    res = admin_client.post('/api/rewards/', payload, format='json')
    assert res.status_code == 201
    assert Reward.objects.filter(name='New Reward').exists()
