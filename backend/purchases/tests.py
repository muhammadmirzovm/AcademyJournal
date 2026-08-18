import pytest
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from django.utils import timezone
from rest_framework.test import APIClient
from academies.models import Academy
from coins.models import CoinTransaction
from groups.models import Group, GroupMembership
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
def reward(academy):
    return Reward.objects.create(academy=academy, name='Ichimlik', price=10, stock=5, status=Reward.Status.AVAILABLE, category=Reward.Category.SNACK)


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
    reward = Reward.objects.create(academy=student.academy, name='Kupon', price=10, stock=5, status=Reward.Status.COMING_SOON)
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
    coupon = Reward.objects.create(academy=student.academy, name='Kupon', price=1, stock=99, status=Reward.Status.AVAILABLE, category=Reward.Category.COUPON)
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


@pytest.mark.django_db
def test_lookup_finds_purchase_by_code(student, admin_user, reward):
    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    code = res.data['code']

    lookup = _client_for('p_admin').get(f'/api/purchases/lookup/{code}/')
    assert lookup.status_code == 200
    assert lookup.data['code'] == code
    assert lookup.data['student_username'] == 'p_student'
    assert lookup.data['reward_name'] == 'Ichimlik'
    assert lookup.data['status'] == 'active'


@pytest.mark.django_db
def test_lookup_is_case_insensitive(student, admin_user, reward):
    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    code = res.data['code']

    lookup = _client_for('p_admin').get(f'/api/purchases/lookup/{code.lower()}/')
    assert lookup.status_code == 200
    assert lookup.data['code'] == code


@pytest.mark.django_db
def test_lookup_unknown_code_returns_404(admin_user):
    res = _client_for('p_admin').get('/api/purchases/lookup/ZZZZZZ/')
    assert res.status_code == 404


@pytest.mark.django_db
def test_lookup_requires_admin(student, teacher, reward):
    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    code = res.data['code']

    for username in ('p_student', 'p_teacher'):
        lookup = _client_for(username).get(f'/api/purchases/lookup/{code}/')
        assert lookup.status_code == 403


@pytest.mark.django_db
def test_issue_marks_purchase_issued(student, admin_user, reward):
    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    purchase_id = res.data['id']

    issue = _client_for('p_admin').post(f'/api/purchases/{purchase_id}/issue/')
    assert issue.status_code == 200
    assert issue.data['status'] == 'issued'

    purchase = Purchase.objects.get(id=purchase_id)
    assert purchase.status == Purchase.Status.ISSUED
    assert purchase.issued_by == admin_user
    assert purchase.issued_at is not None


@pytest.mark.django_db
def test_issue_rejects_already_issued(student, admin_user, reward):
    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    purchase_id = res.data['id']

    client = _client_for('p_admin')
    first = client.post(f'/api/purchases/{purchase_id}/issue/')
    assert first.status_code == 200

    second = client.post(f'/api/purchases/{purchase_id}/issue/')
    assert second.status_code == 400


@pytest.mark.django_db
def test_issue_rejects_expired_purchase(student, admin_user, reward):
    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    purchase = Purchase.objects.get(id=res.data['id'])
    purchase.status = Purchase.Status.EXPIRED
    purchase.save(update_fields=['status'])

    issue = _client_for('p_admin').post(f'/api/purchases/{purchase.id}/issue/')
    assert issue.status_code == 400


@pytest.mark.django_db
def test_issue_requires_admin(student, teacher, reward):
    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    purchase_id = res.data['id']

    for username in ('p_student', 'p_teacher'):
        issue = _client_for(username).post(f'/api/purchases/{purchase_id}/issue/')
        assert issue.status_code == 403


@pytest.mark.django_db
def test_admin_list_includes_student_groups(student, admin_user, teacher, reward):
    group = Group.objects.create(name='Elementary A', teacher=teacher, class_days=[0, 1, 2])
    GroupMembership.objects.create(group=group, student=student)

    _give_coins(student, 30)
    _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')

    res = _client_for('p_admin').get('/api/purchases/admin-list/')
    assert res.status_code == 200
    assert res.data['total'] == 1
    row = res.data['results'][0]
    assert row['student_groups'] == ['Elementary A']
    assert row['reward_name'] == 'Ichimlik'
    assert row['student_username'] == 'p_student'


@pytest.mark.django_db
def test_admin_list_is_paginated_newest_first(student, admin_user, reward):
    _give_coins(student, 1000)
    client = _client_for('p_student')
    codes = []
    for _ in range(3):
        res = client.post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
        codes.append(res.data['code'])

    res = _client_for('p_admin').get('/api/purchases/admin-list/', {'page_size': 2})
    assert res.status_code == 200
    assert res.data['total'] == 3
    assert res.data['pages'] == 2
    assert len(res.data['results']) == 2
    # Newest first.
    assert res.data['results'][0]['code'] == codes[-1]

    res2 = _client_for('p_admin').get('/api/purchases/admin-list/', {'page_size': 2, 'page': 2})
    assert len(res2.data['results']) == 1
    assert res2.data['results'][0]['code'] == codes[0]


@pytest.mark.django_db
def test_admin_list_requires_admin(student, teacher):
    for username in ('p_student', 'p_teacher'):
        res = _client_for(username).get('/api/purchases/admin-list/')
        assert res.status_code == 403


@pytest.mark.django_db
def test_purchase_rejects_reward_from_other_academy(student):
    other_academy = Academy.objects.create(name='Other Purchases Academy', slug='other-purchases-academy')
    other_reward = Reward.objects.create(academy=other_academy, name='Not Yours', price=5, stock=5, status=Reward.Status.AVAILABLE)
    _give_coins(student, 100)

    res = _client_for('p_student').post(f'/api/rewards/{other_reward.id}/purchase/', {'quantity': 1}, format='json')
    assert res.status_code == 404
    other_reward.refresh_from_db()
    assert other_reward.stock == 5


@pytest.mark.django_db
def test_lookup_excludes_other_academy_purchase(student, reward):
    other_academy = Academy.objects.create(name='Other Lookup Academy', slug='other-lookup-academy')
    other_admin = User.objects.create_user(username='other_p_admin', password='pass1234', role='admin', academy=other_academy)

    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    code = res.data['code']

    lookup = _client_for('other_p_admin').get(f'/api/purchases/lookup/{code}/')
    assert lookup.status_code == 404


@pytest.mark.django_db
def test_issue_rejects_other_academy_purchase(student, reward):
    other_academy = Academy.objects.create(name='Other Issue Academy', slug='other-issue-academy')
    other_admin = User.objects.create_user(username='other_p_admin2', password='pass1234', role='admin', academy=other_academy)

    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    purchase_id = res.data['id']

    issue = _client_for('other_p_admin2').post(f'/api/purchases/{purchase_id}/issue/')
    assert issue.status_code == 404
    purchase = Purchase.objects.get(id=purchase_id)
    assert purchase.status == Purchase.Status.ACTIVE


@pytest.mark.django_db
def test_admin_list_excludes_other_academy(student, admin_user, reward):
    other_academy = Academy.objects.create(name='Other List Academy', slug='other-list-academy')
    other_student = User.objects.create_user(username='other_p_student', password='pass1234', role='student', academy=other_academy)
    other_reward = Reward.objects.create(academy=other_academy, name='Other Snack', price=5, stock=5, status=Reward.Status.AVAILABLE)
    _give_coins(other_student, 100)
    _client_for('other_p_student').post(f'/api/rewards/{other_reward.id}/purchase/', {'quantity': 1}, format='json')

    _give_coins(student, 30)
    _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')

    res = _client_for('p_admin').get('/api/purchases/admin-list/')
    assert res.status_code == 200
    assert res.data['total'] == 1
    assert res.data['results'][0]['student_username'] == 'p_student'


@pytest.mark.django_db
def test_undo_issue_reverts_to_active_without_touching_coins_or_stock(student, admin_user, reward):
    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    purchase_id = res.data['id']
    balance_after_purchase = CoinTransaction.balance_for(student)
    reward.refresh_from_db()
    stock_after_purchase = reward.stock

    client = _client_for('p_admin')
    issue = client.post(f'/api/purchases/{purchase_id}/issue/')
    assert issue.status_code == 200

    undo = client.post(f'/api/purchases/{purchase_id}/undo-issue/')
    assert undo.status_code == 200
    assert undo.data['status'] == 'active'

    purchase = Purchase.objects.get(id=purchase_id)
    assert purchase.status == Purchase.Status.ACTIVE
    assert purchase.issued_by is None
    assert purchase.issued_at is None
    # Coins/stock are untouched by issue or undo — only purchase-time matters.
    assert CoinTransaction.balance_for(student) == balance_after_purchase
    reward.refresh_from_db()
    assert reward.stock == stock_after_purchase


@pytest.mark.django_db
def test_undo_issue_rejects_purchase_not_issued(student, admin_user, reward):
    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    purchase_id = res.data['id']

    undo = _client_for('p_admin').post(f'/api/purchases/{purchase_id}/undo-issue/')
    assert undo.status_code == 400


@pytest.mark.django_db
def test_undo_issue_rejects_after_window_expires(student, admin_user, reward):
    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    purchase = Purchase.objects.get(id=res.data['id'])

    client = _client_for('p_admin')
    issue = client.post(f'/api/purchases/{purchase.id}/issue/')
    assert issue.status_code == 200

    purchase.refresh_from_db()
    purchase.issued_at = timezone.now() - timezone.timedelta(minutes=11)
    purchase.save(update_fields=['issued_at'])

    undo = client.post(f'/api/purchases/{purchase.id}/undo-issue/')
    assert undo.status_code == 400

    purchase.refresh_from_db()
    assert purchase.status == Purchase.Status.ISSUED


@pytest.mark.django_db
def test_undo_issue_requires_admin(student, teacher, admin_user, reward):
    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    purchase_id = res.data['id']
    _client_for('p_admin').post(f'/api/purchases/{purchase_id}/issue/')

    for username in ('p_student', 'p_teacher'):
        undo = _client_for(username).post(f'/api/purchases/{purchase_id}/undo-issue/')
        assert undo.status_code == 403


@pytest.mark.django_db
def test_undo_issue_rejects_other_academy_purchase(student, admin_user, reward):
    other_academy = Academy.objects.create(name='Other Undo Academy', slug='other-undo-academy')
    other_admin = User.objects.create_user(username='other_p_admin3', password='pass1234', role='admin', academy=other_academy)

    _give_coins(student, 30)
    res = _client_for('p_student').post(f'/api/rewards/{reward.id}/purchase/', {'quantity': 1}, format='json')
    purchase_id = res.data['id']
    _client_for('p_admin').post(f'/api/purchases/{purchase_id}/issue/')

    undo = _client_for('other_p_admin3').post(f'/api/purchases/{purchase_id}/undo-issue/')
    assert undo.status_code == 404
    purchase = Purchase.objects.get(id=purchase_id)
    assert purchase.status == Purchase.Status.ISSUED
