import pytest
from groups.test_access import world, client
from groups.models import Score, GroupMembership
from users.models import Notification

pytestmark = pytest.mark.django_db


def path(w):
    return f'/api/groups/{w.group.pk}/lessons/{w.lesson.pk}/scores/'


def test_clearing_score_preserves_other_students_and_does_not_notify(world):
    w = world
    GroupMembership.objects.create(group=w.group, student=w.outsider)
    Score.objects.create(lesson=w.lesson, student=w.student, value=5)
    Score.objects.create(lesson=w.lesson, student=w.outsider, value=0)
    count = Notification.objects.count()
    response = client(w.teacher).post(path(w), {'records': [{'student': w.student.pk, 'value': None}]}, format='json')
    assert response.status_code == 200
    assert not Score.objects.filter(lesson=w.lesson, student=w.student).exists()
    assert Score.objects.get(lesson=w.lesson, student=w.outsider).value == 0
    assert Notification.objects.count() == count
    # Retrying a deletion is idempotent and does not remove another pupil's zero.
    assert client(w.teacher).post(path(w), {'records': [{'student': w.student.pk, 'value': None}]}, format='json').status_code == 200
    assert Score.objects.get(lesson=w.lesson, student=w.outsider).value == 0


@pytest.mark.parametrize('actor', ['student', 'parent', 'other_teacher', 'foreign_admin'])
def test_clear_score_keeps_existing_staff_permissions(world, actor):
    Score.objects.create(lesson=world.lesson, student=world.student, value=5)
    response = client(getattr(world, actor)).post(path(world), {'records': [{'student': world.student.pk, 'value': None}]}, format='json')
    assert response.status_code in (403, 404)
    assert Score.objects.get(lesson=world.lesson, student=world.student).value == 5


def test_invalid_roster_in_batch_cannot_partially_clear_scores(world):
    Score.objects.create(lesson=world.lesson, student=world.student, value=5)
    response = client(world.teacher).post(path(world), {'records': [
        {'student': world.student.pk, 'value': None}, {'student': world.outsider.pk, 'value': 2},
    ]}, format='json')
    assert response.status_code == 400
    assert Score.objects.get(lesson=world.lesson, student=world.student).value == 5
