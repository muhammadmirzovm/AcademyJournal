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
