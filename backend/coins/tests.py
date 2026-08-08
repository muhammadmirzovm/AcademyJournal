import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient
from academies.models import Academy
from coins.models import CoinSetting, CoinTransaction
from rewards.models import Reward
from purchases.models import Purchase

User = get_user_model()


@pytest.fixture
def academy(db):
    return Academy.objects.create(name='Coin Test Academy', slug='coin-test-academy')


@pytest.fixture
def student(academy):
    return User.objects.create_user(username='coin_student', password='pass1234', role='student', academy=academy)


@pytest.fixture
def admin_user(academy):
    return User.objects.create_user(username='coin_admin', password='pass1234', role='admin', academy=academy)


@pytest.fixture
def teacher(academy):
    return User.objects.create_user(username='coin_teacher', password='pass1234', role='teacher', academy=academy)


def _client_for(username):
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': username, 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    return client


@pytest.mark.django_db
def test_balance_is_sum_of_transactions(student):
    CoinTransaction.objects.create(student=student, amount=10, type=CoinTransaction.Type.GAME_PLACE, reason="1-o'rin")
    CoinTransaction.objects.create(student=student, amount=2, type=CoinTransaction.Type.GAME_EFFORT, reason='Harakat')
    CoinTransaction.objects.create(student=student, amount=-4, type=CoinTransaction.Type.PURCHASE, reason='Ichimlik')
    assert CoinTransaction.balance_for(student) == 8


@pytest.mark.django_db
def test_balance_for_student_with_no_transactions_is_zero(student):
    assert CoinTransaction.balance_for(student) == 0


@pytest.mark.django_db
def test_transaction_cannot_be_edited(student):
    txn = CoinTransaction.objects.create(student=student, amount=10, type=CoinTransaction.Type.GAME_PLACE, reason="1-o'rin")
    txn.amount = 999
    with pytest.raises(ValidationError):
        txn.save()
    txn.refresh_from_db()
    assert txn.amount == 10


@pytest.mark.django_db
def test_transaction_cannot_be_deleted(student):
    txn = CoinTransaction.objects.create(student=student, amount=10, type=CoinTransaction.Type.GAME_PLACE, reason="1-o'rin")
    with pytest.raises(ValidationError):
        txn.delete()
    assert CoinTransaction.objects.filter(pk=txn.pk).exists()


@pytest.mark.django_db
def test_mistake_is_corrected_with_reversing_entry_not_edit(student):
    CoinTransaction.objects.create(student=student, amount=10, type=CoinTransaction.Type.GAME_PLACE, reason="Xato: 1-o'rin")
    CoinTransaction.objects.create(student=student, amount=-10, type=CoinTransaction.Type.ADJUSTMENT, reason='Tuzatish: xato yozuv')
    assert CoinTransaction.balance_for(student) == 0
    assert CoinTransaction.objects.filter(student=student).count() == 2  # original kept, not deleted


@pytest.mark.django_db
def test_coin_setting_is_singleton():
    s1 = CoinSetting.get()
    s2 = CoinSetting.get()
    assert s1.pk == s2.pk
    assert CoinSetting.objects.count() == 1


@pytest.mark.django_db
def test_coin_setting_defaults_match_spec():
    s = CoinSetting.get()
    assert (s.place_1_normal, s.place_2_normal, s.place_3_normal) == (5, 4, 3)
    assert (s.place_1_big, s.place_2_big, s.place_3_big) == (10, 8, 6)
    assert s.big_days == '4,5'


@pytest.mark.django_db
def test_report_requires_admin(student, teacher):
    for username in ('coin_student', 'coin_teacher'):
        res = _client_for(username).get('/api/coins/report/')
        assert res.status_code == 403


@pytest.mark.django_db
def test_report_outstanding_balance_and_estimated_liability(admin_user, student):
    setting = CoinSetting.get()
    setting.coin_value_som = 1500
    setting.save()

    CoinTransaction.objects.create(student=student, amount=10, type=CoinTransaction.Type.GAME_PLACE, reason="1-o'rin")
    CoinTransaction.objects.create(student=student, amount=-4, type=CoinTransaction.Type.PURCHASE, reason='Ichimlik')

    res = _client_for('coin_admin').get('/api/coins/report/')
    assert res.status_code == 200
    assert res.data['coin_value_som'] == 1500
    assert res.data['outstanding_balance'] == 6
    assert res.data['estimated_liability_som'] == 9000


@pytest.mark.django_db
def test_report_spend_by_category_excludes_expired_purchases(admin_user, student):
    snack = Reward.objects.create(name='Ichimlik', price=10, stock=5, status=Reward.Status.AVAILABLE, category=Reward.Category.SNACK)
    coupon = Reward.objects.create(name='Kupon', price=150, stock=5, status=Reward.Status.AVAILABLE, category=Reward.Category.COUPON)

    expires_at = timezone.now() + timezone.timedelta(days=14)
    Purchase.objects.create(student=student, reward=snack, quantity=1, price_at_order=10, total_price=10, code='AAA111', status=Purchase.Status.ACTIVE, expires_at=expires_at)
    Purchase.objects.create(student=student, reward=snack, quantity=1, price_at_order=10, total_price=10, code='AAA222', status=Purchase.Status.ISSUED, expires_at=expires_at)
    Purchase.objects.create(student=student, reward=coupon, quantity=1, price_at_order=150, total_price=150, code='BBB111', status=Purchase.Status.EXPIRED, expires_at=expires_at)

    res = _client_for('coin_admin').get('/api/coins/report/')
    assert res.status_code == 200
    by_category = {row['category']: row for row in res.data['spend_by_category']}
    assert by_category['snack']['coins'] == 20
    assert by_category['snack']['purchase_count'] == 2
    assert 'coupon' not in by_category  # the only coupon purchase was expired
