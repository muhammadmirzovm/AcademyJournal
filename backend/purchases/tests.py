import pytest
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from rest_framework.test import APIClient
from academies.models import Academy
from coins.models import CoinTransaction
from rewards.models import Reward
from purchases.admin import PurchaseAdmin
from purchases.codes import ALPHABET, CODE_LENGTH, generate_unique_code
from purchases.models import Purchase

User = get_user_model()


@pytest.fixture
def academy(db):
    return Academy.objects.create(name='Purchases Test Academy', slug='purchases-test-academy')


@pytest.fixture
def student(academy):
    return User.objects.create_user(username='p_student', password='pass1234', role='student', academy=academy)


@pytest.fixture
def teacher(academy):
    return User.objects.create_user(username='p_teacher', password='pass1234', role='teacher', academy=academy)


@pytest.fixture
def admin_user(academy):
    return User.objects.create_user(username='p_admin', password='pass1234', role='admin', academy=academy)


def _client_for(username):
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': username, 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    return client


@pytest.fixture
def reward():
    return Reward.objects.create(name='Ichimlik', price=10, stock=5, status=Reward.Status.AVAILABLE, category=Reward.Category.SNACK)


def _give_coins(student, amount):
    CoinTransaction.objects.create(student=student, amount=amount, type=CoinTransaction.Type.GAME_PLACE, reason='test grant')


@pytest.mark.django_db
def test_successful_purchase_deducts_coins_and_stock(student, reward):
    _give_coins(student, 30)
    client = _client_for('p_student')

    res = client.post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 2}, format='json')
    assert res.status_code == 201
    assert res.data['total_price'] == 20
    assert len(res.data['code']) == CODE_LENGTH
    assert res.data['status'] == 'active'

    assert CoinTransaction.balance_for(student) == 10  # 30 - 20
    reward.refresh_from_db()
    assert reward.stock == 3  # 5 - 2


@pytest.mark.django_db
def test_insufficient_balance_is_rejected(student, reward):
    _give_coins(student, 5)  # reward costs 10
    client = _client_for('p_student')
    res = client.post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    assert res.status_code == 400
    assert CoinTransaction.balance_for(student) == 5  # untouched
    reward.refresh_from_db()
    assert reward.stock == 5  # untouched


@pytest.mark.django_db
def test_insufficient_stock_is_rejected(student, reward):
    _give_coins(student, 1000)
    client = _client_for('p_student')
    res = client.post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 99}, format='json')
    assert res.status_code == 400
    assert not Purchase.objects.filter(student=student).exists()


@pytest.mark.django_db
def test_unavailable_reward_cannot_be_purchased(student):
    reward = Reward.objects.create(name='Kupon', price=10, stock=5, status=Reward.Status.COMING_SOON)
    _give_coins(student, 100)
    client = _client_for('p_student')
    res = client.post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    assert res.status_code == 400


@pytest.mark.django_db
def test_only_student_can_purchase(teacher, admin_user, reward):
    for username in ('p_teacher', 'p_admin'):
        client = _client_for(username)
        res = client.post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
        assert res.status_code == 403


@pytest.mark.django_db
def test_coupon_max_per_student_limit(student):
    coupon = Reward.objects.create(name='Kupon', price=1, stock=99, status=Reward.Status.AVAILABLE, category=Reward.Category.COUPON)
    _give_coins(student, 1000)
    client = _client_for('p_student')

    res1 = client.post(f'/api/rewards/{coupon.id}/purchase/', {'quantity': 2}, format='json')
    assert res1.status_code == 201  # exactly at the limit (2)

    res2 = client.post(f'/api/rewards/{coupon.id}/purchase/', {'quantity': 1}, format='json')
    assert res2.status_code == 400  # would exceed the limit


@pytest.mark.django_db
def test_my_purchases_only_returns_own(student, reward):
    other = User.objects.create_user(username='p_other', password='pass1234', role='student', academy=student.academy)
    _give_coins(student, 100)
    _give_coins(other, 100)
    _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')

    other_client = APIClient()
    res = other_client.post('/api/auth/login/', {'username': 'p_other', 'password': 'pass1234'})
    other_client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')

    mine = _client_for('p_student').get('/api/purchases/mine/')
    assert len(mine.data) == 1

    others_view = other_client.get('/api/purchases/mine/')
    assert len(others_view.data) == 0


@pytest.mark.django_db
def test_code_generator_uses_safe_alphabet_and_is_unique():
    codes = {generate_unique_code() for _ in range(50)}
    assert len(codes) == 50  # no collisions across 50 generations
    for code in codes:
        assert len(code) == CODE_LENGTH
        assert all(ch in ALPHABET for ch in code)
        assert code == code.upper()


@pytest.mark.django_db
def test_admin_expire_and_refund_action(student, admin_user, reward):
    _give_coins(student, 30)
    client = _client_for('p_student')
    res = client.post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 2}, format='json')
    purchase = Purchase.objects.get(id=res.data['id'])
    balance_after_purchase = CoinTransaction.balance_for(student)
    reward.refresh_from_db()
    stock_after_purchase = reward.stock

    request = RequestFactory().post('/admin/purchases/purchase/')
    request.user = admin_user
    admin_instance = PurchaseAdmin(Purchase, None)
    admin_instance.expire_and_refund(request, Purchase.objects.filter(id=purchase.id))

    purchase.refresh_from_db()
    reward.refresh_from_db()
    assert purchase.status == Purchase.Status.EXPIRED
    assert CoinTransaction.balance_for(student) == balance_after_purchase + purchase.total_price
    assert reward.stock == stock_after_purchase + purchase.quantity
