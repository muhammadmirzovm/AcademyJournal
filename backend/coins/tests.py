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
def test_coin_setting_is_singleton_per_academy(academy):
    other_academy = Academy.objects.create(name='Other Academy', slug='other-academy')

    s1 = CoinSetting.get(academy)
    s2 = CoinSetting.get(academy)
    assert s1.pk == s2.pk

    s3 = CoinSetting.get(other_academy)
    assert s3.pk != s1.pk
    assert CoinSetting.objects.count() == 2


@pytest.mark.django_db
def test_coin_setting_defaults_match_spec(academy):
    s = CoinSetting.get(academy)
    assert (s.place_1_normal, s.place_2_normal, s.place_3_normal) == (5, 4, 3)
    assert (s.place_1_big, s.place_2_big, s.place_3_big) == (10, 8, 6)
    assert s.big_days == '4,5'


@pytest.mark.django_db
def test_report_requires_admin(student, teacher):
    for username in ('coin_student', 'coin_teacher'):
        res = _client_for(username).get('/api/coins/report/')
        assert res.status_code == 403


@pytest.mark.django_db
def test_report_outstanding_balance(admin_user, student):
    CoinTransaction.objects.create(student=student, amount=10, type=CoinTransaction.Type.GAME_PLACE, reason="1-o'rin")
    CoinTransaction.objects.create(student=student, amount=-4, type=CoinTransaction.Type.PURCHASE, reason='Ichimlik')

    res = _client_for('coin_admin').get('/api/coins/report/')
    assert res.status_code == 200
    assert res.data['outstanding_balance'] == 6


@pytest.mark.django_db
def test_report_spend_by_category_excludes_expired_purchases(academy, admin_user, student):
    snack = Reward.objects.create(academy=academy, name='Ichimlik', price=10, stock=5, status=Reward.Status.AVAILABLE, category=Reward.Category.SNACK)
    coupon = Reward.objects.create(academy=academy, name='Kupon', price=150, stock=5, status=Reward.Status.AVAILABLE, category=Reward.Category.COUPON)

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


@pytest.mark.django_db
def test_report_excludes_other_academy_data(academy, admin_user, student):
    other_academy = Academy.objects.create(name='Other Academy 2', slug='other-academy-2')
    other_student = User.objects.create_user(username='other_academy_student', password='pass1234', role='student', academy=other_academy)

    CoinTransaction.objects.create(student=student, amount=10, type=CoinTransaction.Type.GAME_PLACE, reason="1-o'rin")
    CoinTransaction.objects.create(student=other_student, amount=999, type=CoinTransaction.Type.GAME_PLACE, reason="boshqa akademiya")

    res = _client_for('coin_admin').get('/api/coins/report/')
    assert res.status_code == 200
    assert res.data['outstanding_balance'] == 10  # not 1009 — other academy excluded


@pytest.fixture
def student2(academy):
    return User.objects.create_user(username='coin_student2', password='pass1234', role='student', academy=academy)


@pytest.mark.django_db
def test_adjust_adds_coins_to_multiple_students(admin_user, student, student2):
    res = _client_for('coin_admin').post('/api/coins/adjust/', {
        'student_ids': [student.id, student2.id], 'amount': 10, 'reason': 'Bayram bonusi',
    }, format='json')
    assert res.status_code == 200
    assert res.data['affected'] == 2
    assert CoinTransaction.balance_for(student) == 10
    assert CoinTransaction.balance_for(student2) == 10
    txn = CoinTransaction.objects.get(student=student)
    assert txn.type == CoinTransaction.Type.ADJUSTMENT
    assert txn.reason == 'Bayram bonusi'
    assert txn.created_by == admin_user


@pytest.mark.django_db
def test_adjust_can_subtract_coins(admin_user, student):
    CoinTransaction.objects.create(student=student, amount=30, type=CoinTransaction.Type.GAME_PLACE, reason='seed')
    res = _client_for('coin_admin').post('/api/coins/adjust/', {
        'student_ids': [student.id], 'amount': -10, 'reason': 'Tuzatish',
    }, format='json')
    assert res.status_code == 200
    assert CoinTransaction.balance_for(student) == 20


@pytest.mark.django_db
def test_adjust_requires_admin(teacher, student):
    res = _client_for('coin_teacher').post('/api/coins/adjust/', {
        'student_ids': [student.id], 'amount': 10, 'reason': 'x',
    }, format='json')
    assert res.status_code == 403
    assert CoinTransaction.balance_for(student) == 0


@pytest.mark.django_db
def test_adjust_requires_reason(admin_user, student):
    res = _client_for('coin_admin').post('/api/coins/adjust/', {
        'student_ids': [student.id], 'amount': 10, 'reason': '',
    }, format='json')
    assert res.status_code == 400
    assert CoinTransaction.balance_for(student) == 0


@pytest.mark.django_db
def test_adjust_rejects_zero_amount(admin_user, student):
    res = _client_for('coin_admin').post('/api/coins/adjust/', {
        'student_ids': [student.id], 'amount': 0, 'reason': 'x',
    }, format='json')
    assert res.status_code == 400


@pytest.mark.django_db
def test_adjust_requires_student_ids(admin_user):
    res = _client_for('coin_admin').post('/api/coins/adjust/', {
        'student_ids': [], 'amount': 10, 'reason': 'x',
    }, format='json')
    assert res.status_code == 400


@pytest.mark.django_db
def test_adjust_ignores_other_academy_students(admin_user, student):
    other_academy = Academy.objects.create(name='Other Adjust Academy', slug='other-adjust-academy')
    other_student = User.objects.create_user(username='other_adjust_student', password='pass1234', role='student', academy=other_academy)

    res = _client_for('coin_admin').post('/api/coins/adjust/', {
        'student_ids': [student.id, other_student.id], 'amount': 10, 'reason': 'x',
    }, format='json')
    assert res.status_code == 200
    assert res.data['affected'] == 1  # only the same-academy student
    assert CoinTransaction.balance_for(student) == 10
    assert CoinTransaction.balance_for(other_student) == 0


@pytest.mark.django_db
def test_adjust_ignores_non_student_ids(admin_user, teacher):
    res = _client_for('coin_admin').post('/api/coins/adjust/', {
        'student_ids': [teacher.id], 'amount': 10, 'reason': 'x',
    }, format='json')
    assert res.status_code == 400  # no valid students resolved


@pytest.mark.django_db
def test_get_settings_returns_defaults(admin_user):
    res = _client_for('coin_admin').get('/api/coins/settings/')
    assert res.status_code == 200
    assert res.data['place_1_normal'] == 5
    assert res.data['place_1_big'] == 10
    assert res.data['big_days'] == '4,5'


@pytest.mark.django_db
def test_get_settings_requires_admin(teacher):
    res = _client_for('coin_teacher').get('/api/coins/settings/')
    assert res.status_code == 403


@pytest.mark.django_db
def test_patch_settings_updates_values(admin_user, academy):
    res = _client_for('coin_admin').patch('/api/coins/settings/', {
        'place_1_normal': 7, 'effort_min_normal': 2, 'effort_max_normal': 3,
    }, format='json')
    assert res.status_code == 200
    assert res.data['place_1_normal'] == 7

    setting = CoinSetting.objects.get(academy=academy)
    assert setting.place_1_normal == 7
    assert setting.effort_min_normal == 2
    assert setting.effort_max_normal == 3
    # Untouched fields keep their defaults (partial update).
    assert setting.place_2_normal == 4


@pytest.mark.django_db
def test_patch_settings_requires_admin(teacher):
    res = _client_for('coin_teacher').patch('/api/coins/settings/', {'place_1_normal': 7}, format='json')
    assert res.status_code == 403


@pytest.mark.django_db
def test_patch_settings_rejects_effort_min_above_max(admin_user):
    res = _client_for('coin_admin').patch('/api/coins/settings/', {
        'effort_min_normal': 5, 'effort_max_normal': 2,
    }, format='json')
    assert res.status_code == 400


@pytest.mark.django_db
def test_patch_settings_validates_big_days(admin_user):
    res = _client_for('coin_admin').patch('/api/coins/settings/', {'big_days': '3,9'}, format='json')
    assert res.status_code == 400


@pytest.mark.django_db
def test_patch_settings_normalizes_big_days(admin_user, academy):
    res = _client_for('coin_admin').patch('/api/coins/settings/', {'big_days': '5, 3, 3, 1'}, format='json')
    assert res.status_code == 200
    assert res.data['big_days'] == '1,3,5'


@pytest.mark.django_db
def test_patch_settings_scoped_to_own_academy(admin_user, academy):
    other_academy = Academy.objects.create(name='Other Settings Academy', slug='other-settings-academy')
    other_admin = User.objects.create_user(username='other_settings_admin', password='pass1234', role='admin', academy=other_academy)

    _client_for('coin_admin').patch('/api/coins/settings/', {'place_1_normal': 99}, format='json')

    other_setting = CoinSetting.get(other_academy)
    assert other_setting.place_1_normal == 5  # untouched default, not 99


@pytest.mark.django_db
def test_coin_leaderboard_ranks_top_10_by_earned(academy, admin_user):
    students = [
        User.objects.create_user(username=f'lb_s{i}', password='pass1234', role='student', academy=academy)
        for i in range(12)
    ]
    for i, s in enumerate(students):
        CoinTransaction.objects.create(student=s, amount=(i + 1) * 5, type=CoinTransaction.Type.GAME_PLACE, reason='x')

    res = _client_for('coin_admin').get('/api/coins/leaderboard/')
    assert res.status_code == 200
    assert len(res.data) == 10
    earned = [row['earned'] for row in res.data]
    assert earned == sorted(earned, reverse=True)
    assert res.data[0]['earned'] == 60  # student 11 (index 11): (11+1)*5
    assert res.data[0]['username'] == 'lb_s11'


@pytest.mark.django_db
def test_coin_leaderboard_excludes_purchases_and_refunds_from_earned_total(academy, admin_user, student):
    CoinTransaction.objects.create(student=student, amount=50, type=CoinTransaction.Type.GAME_PLACE, reason='x')
    CoinTransaction.objects.create(student=student, amount=-20, type=CoinTransaction.Type.PURCHASE, reason='y')
    CoinTransaction.objects.create(student=student, amount=20, type=CoinTransaction.Type.REFUND, reason='z')

    res = _client_for('coin_admin').get('/api/coins/leaderboard/')
    assert res.status_code == 200
    # Wallet balance would be 50 (50-20+20), but redeeming a reward (and it
    # later expiring/refunding) must not move the lifetime-earned ranking.
    assert res.data[0]['earned'] == 50


@pytest.mark.django_db
def test_coin_leaderboard_adjustment_corrections_reduce_earned_total(academy, admin_user, student):
    CoinTransaction.objects.create(student=student, amount=50, type=CoinTransaction.Type.GAME_PLACE, reason='x')
    CoinTransaction.objects.create(student=student, amount=-10, type=CoinTransaction.Type.ADJUSTMENT, reason='mistake correction')

    res = _client_for('coin_admin').get('/api/coins/leaderboard/')
    assert res.status_code == 200
    assert res.data[0]['earned'] == 40


@pytest.mark.django_db
def test_coin_leaderboard_excludes_non_students(academy, admin_user, teacher):
    CoinTransaction.objects.create(student=teacher, amount=100, type=CoinTransaction.Type.ADJUSTMENT, reason='x')

    res = _client_for('coin_admin').get('/api/coins/leaderboard/')
    assert res.status_code == 200
    assert res.data == []


@pytest.mark.django_db
def test_coin_leaderboard_excludes_deactivated_students(academy, admin_user, student):
    CoinTransaction.objects.create(student=student, amount=100, type=CoinTransaction.Type.GAME_PLACE, reason='x')
    student.is_active = False
    student.save()

    res = _client_for('coin_admin').get('/api/coins/leaderboard/')
    assert res.status_code == 200
    assert res.data == []


@pytest.mark.django_db
def test_coin_leaderboard_scoped_to_own_academy(academy, admin_user, student):
    other_academy = Academy.objects.create(name='Other Leaderboard Academy', slug='other-leaderboard-academy')
    other_student = User.objects.create_user(username='other_lb_student', password='pass1234', role='student', academy=other_academy)

    CoinTransaction.objects.create(student=student, amount=10, type=CoinTransaction.Type.GAME_PLACE, reason='x')
    CoinTransaction.objects.create(student=other_student, amount=999, type=CoinTransaction.Type.GAME_PLACE, reason='x')

    res = _client_for('coin_admin').get('/api/coins/leaderboard/')
    assert res.status_code == 200
    assert len(res.data) == 1
    assert res.data[0]['username'] == 'coin_student'
