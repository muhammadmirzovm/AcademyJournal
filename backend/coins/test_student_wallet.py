import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from academies.models import Academy
from coins.models import CoinTransaction

pytestmark = pytest.mark.django_db
User = get_user_model()

@pytest.fixture
def world():
    academy = Academy.objects.create(name='Wallet', slug='wallet')
    admin = User.objects.create_user(username='admin-wallet', role='admin', academy=academy)
    student = User.objects.create_user(username='student-wallet', role='student', academy=academy, is_active=False)
    original = CoinTransaction.objects.create(student=student, amount=25, type='game_place', reason='Original')
    client = APIClient()
    client.force_authenticate(admin)
    return client, admin, student, original

def url(student):
    return f'/api/coins/students/{student.pk}/'

def act(client, student, **changes):
    return client.post(url(student), {'action': 'add', 'amount': 5, 'expected_balance': 25, 'reason': 'Correction', **changes}, format='json')

def test_actions_preserve_history_and_actor(world):
    client, admin, student, original = world
    assert act(client, student).data['balance'] == 30
    assert act(client, student, action='subtract', amount=10, expected_balance=30).data['balance'] == 20
    assert act(client, student, action='reset', expected_balance=20).data['balance'] == 0
    original.refresh_from_db()
    assert original.amount == 25
    entries = CoinTransaction.objects.filter(student=student, type='adjustment')
    assert list(entries.order_by('id').values_list('amount', flat=True)) == [5, -10, -20]
    assert all(entry.created_by_id == admin.pk and entry.reason == 'Correction' for entry in entries)
    data = client.get(url(student)).data
    assert data['balance'] == 0 and data['count'] == 4
    assert data['results'][0]['created_by_name'] == admin.username

@pytest.mark.parametrize('role', ['teacher', 'student', 'parent'])
def test_wallet_is_admin_only(world, role):
    client, admin, student, original = world
    actor = User.objects.create_user(username=role, role=role, academy=admin.academy)
    client.force_authenticate(actor)
    assert client.get(url(student)).status_code == 403
    assert act(client, student).status_code == 403
    assert CoinTransaction.objects.count() == 1

def test_cross_academy_and_non_student_denied(world):
    client, admin, student, original = world
    other = Academy.objects.create(name='Other', slug='other-wallet')
    outsider = User.objects.create_user(username='outsider', role='student', academy=other)
    for target in [outsider, admin]:
        assert client.get(url(target)).status_code == 404
        assert act(client, target).status_code == 404

def test_replay_or_stale_balance_is_rejected(world):
    client, admin, student, original = world
    assert act(client, student).status_code == 200
    assert act(client, student).status_code == 409
    assert CoinTransaction.balance_for(student) == 30
    assert act(client, student, action='reset').status_code == 409
    assert CoinTransaction.objects.count() == 2

@pytest.mark.parametrize('changes', [
    {'reason': ''}, {'reason': '   '}, {'reason': 'x' * 201},
    {'action': 'delete'}, {'amount': 0}, {'amount': -5}, {'amount': 1.5},
    {'amount': 2147483648}, {'expected_balance': None},
    {'action': 'subtract', 'amount': 26},
])
def test_invalid_actions_do_not_write(world, changes):
    client, admin, student, original = world
    assert act(client, student, **changes).status_code == 400
    assert CoinTransaction.objects.count() == 1

def test_empty_reset_is_noop_and_history_is_paginated(world):
    client, admin, student, original = world
    assert act(client, student, action='reset').status_code == 200
    assert act(client, student, action='reset', expected_balance=0).status_code == 200
    assert CoinTransaction.objects.count() == 2
    CoinTransaction.objects.bulk_create([CoinTransaction(student=student, academy=admin.academy, amount=1, type='adjustment', reason=str(i)) for i in range(21)])
    first = client.get(url(student)).data
    second = client.get(url(student), {'page': 2}).data
    assert first['count'] == 23 and len(first['results']) == 20 and len(second['results']) == 3
    assert not {x['id'] for x in first['results']} & {x['id'] for x in second['results']}
    assert client.get(url(student), {'page': 'bad'}).status_code == 400


@pytest.mark.django_db(transaction=True)
def test_simultaneous_confirmations_write_only_once():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from django.db import close_old_connections, connection
    if connection.vendor != 'postgresql':
        pytest.skip('Requires PostgreSQL row locks')
    academy = Academy.objects.create(name='Parallel wallet', slug='parallel-wallet')
    admin = User.objects.create_user(username='parallel-admin', role='admin', academy=academy)
    student = User.objects.create_user(username='parallel-student', role='student', academy=academy)
    CoinTransaction.objects.create(student=student, amount=25, type='game_place', reason='Original')
    barrier = Barrier(2)
    def confirm():
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=admin.pk))
            barrier.wait(timeout=10)
            return act(client, student).status_code
        finally:
            close_old_connections()
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: confirm(), range(2)))
    assert sorted(results) == [200, 409]
    assert CoinTransaction.balance_for(student) == 30
    assert CoinTransaction.objects.filter(student=student).count() == 2
