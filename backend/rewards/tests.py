from io import BytesIO

import pytest
from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from academies.models import Academy
from rewards.models import IMAGE_MAX_DIMENSION, Reward

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
def test_rewards_list_visible_to_any_role_and_hides_hidden(academy, admin_user, student_user):
    Reward.objects.create(academy=academy, name='Visible', price=100, status=Reward.Status.AVAILABLE)
    Reward.objects.create(academy=academy, name='Secret', price=100, status=Reward.Status.HIDDEN)

    client = _client_for('rw_student')
    res = client.get('/api/rewards/')
    assert res.status_code == 200
    names = [r['name'] for r in res.data]
    assert 'Visible' in names
    assert 'Secret' not in names


@pytest.mark.django_db
def test_rewards_list_excludes_other_academy(academy, admin_user, student_user):
    other_academy = Academy.objects.create(name='Other Rewards Academy', slug='other-rewards-academy')
    Reward.objects.create(academy=academy, name='Mine', price=100, status=Reward.Status.AVAILABLE)
    Reward.objects.create(academy=other_academy, name='Not Mine', price=100, status=Reward.Status.AVAILABLE)

    res = _client_for('rw_student').get('/api/rewards/')
    assert res.status_code == 200
    names = [r['name'] for r in res.data]
    assert 'Mine' in names
    assert 'Not Mine' not in names


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


@pytest.mark.django_db
def test_only_admin_can_edit_reward(academy, admin_user, student_user):
    reward = Reward.objects.create(academy=academy, name='Editable', price=100, stock=5)

    student_client = _client_for('rw_student')
    res = student_client.patch(f'/api/rewards/{reward.id}/', {'price': 200}, format='json')
    assert res.status_code == 403
    reward.refresh_from_db()
    assert reward.price == 100

    admin_client = _client_for('rw_admin')
    res = admin_client.patch(f'/api/rewards/{reward.id}/', {'price': 200}, format='json')
    assert res.status_code == 200
    reward.refresh_from_db()
    assert reward.price == 200


@pytest.mark.django_db
def test_admin_cannot_edit_other_academys_reward(academy, admin_user):
    other_academy = Academy.objects.create(name='Other Edit Academy', slug='other-edit-academy')
    reward = Reward.objects.create(academy=other_academy, name='Not Yours', price=100, stock=5)

    res = _client_for('rw_admin').patch(f'/api/rewards/{reward.id}/', {'price': 200}, format='json')
    assert res.status_code == 404
    reward.refresh_from_db()
    assert reward.price == 100


@pytest.mark.django_db
def test_only_admin_can_delete_reward(academy, admin_user, student_user):
    reward = Reward.objects.create(academy=academy, name='Deletable', price=100)

    student_client = _client_for('rw_student')
    res = student_client.delete(f'/api/rewards/{reward.id}/')
    assert res.status_code == 403
    assert Reward.objects.filter(id=reward.id).exists()

    admin_client = _client_for('rw_admin')
    res = admin_client.delete(f'/api/rewards/{reward.id}/')
    assert res.status_code == 204
    assert not Reward.objects.filter(id=reward.id).exists()


@pytest.mark.django_db
def test_oversized_image_is_shrunk_and_normalized_to_jpeg(academy):
    buf = BytesIO()
    Image.new('RGB', (1200, 900), color=(200, 50, 50)).save(buf, format='PNG')
    buf.seek(0)
    upload = SimpleUploadedFile('big.png', buf.read(), content_type='image/png')

    reward = Reward.objects.create(academy=academy, name='Big Image Reward', price=10, image=upload)
    reward.refresh_from_db()

    with Image.open(reward.image.path) as img:
        assert img.width <= IMAGE_MAX_DIMENSION
        assert img.height <= IMAGE_MAX_DIMENSION
        assert img.format == 'JPEG'
    assert reward.image.name.startswith('rewards/')
    assert 'rewards/rewards/' not in reward.image.name


@pytest.mark.django_db
def test_coupon_category_accepted(admin_user):
    admin_client = _client_for('rw_admin')
    res = admin_client.post('/api/rewards/', {
        'name': 'Kupon', 'price': 200, 'category': 'coupon', 'status': 'coming_soon',
    }, format='json')
    assert res.status_code == 201
    assert res.data['category'] == 'coupon'


@pytest.mark.django_db
def test_initial_rewards_were_seeded_by_migration():
    seeded_names = {
        'Ichimlik (kichik)', 'Ichimlik / shirinlik', 'Snack + ichimlik seti',
        "Kupon 100 000 so'm", "Kupon 200 000 so'm",
    }
    existing = set(Reward.objects.filter(name__in=seeded_names).values_list('name', flat=True))
    assert existing == seeded_names
