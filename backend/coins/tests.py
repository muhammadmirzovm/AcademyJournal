import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from academies.models import Academy
from coins.models import CoinSetting, CoinTransaction

User = get_user_model()


@pytest.fixture
def academy(db):
    return Academy.objects.create(name='Coin Test Academy', slug='coin-test-academy')


@pytest.fixture
def student(academy):
    return User.objects.create_user(username='coin_student', password='pass1234', role='student', academy=academy)


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
