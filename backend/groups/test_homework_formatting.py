from unittest.mock import AsyncMock
from types import SimpleNamespace

import pytest
from asgiref.sync import async_to_sync

from groups.homework_formatting import (
    sanitize_homework, homework_plain, homework_telegram, telegram_html_chunks, send_html_message, segments,
)
from groups.test_access import world, client
from groups.test_lesson_reports import reports, publish, endpoint


@pytest.mark.parametrize('html, expected', [
    ('<p><strong>Read</strong> <em>carefully</em> <u>today</u> <s>old</s> <code>x &lt; 2</code></p>', '<b>Read</b> <i>carefully</i> <u>today</u> <s>old</s> <code>x &lt; 2</code>'),
    ('<ul><li><p>First</p></li><li><p><strong>Second</strong></p></li></ul>', '• First\n• <b>Second</b>'),
    ('<ol start="3"><li><p>Third</p></li><li><p>Fourth</p></li></ol>', '3. Third\n4. Fourth'),
])
def test_rich_homework_converts_to_telegram_supported_html(html, expected):
    assert homework_telegram(html, 'html') == expected


def test_legacy_plain_html_and_markdown_stay_literal():
    text = '<strong>Literal</strong> & *stars* _name_'
    assert homework_telegram(text) == '&lt;strong&gt;Literal&lt;/strong&gt; &amp; *stars* _name_'
    assert homework_plain(text) == text


@pytest.mark.parametrize('value', ['<p><br></p>', '<ul><li><p></p></li></ul>', '<p>&nbsp; </p>'])
def test_empty_rich_content_is_empty(value):
    assert sanitize_homework(value) == ''


def test_untrusted_markup_and_attributes_are_removed():
    cleaned = sanitize_homework('<p onclick="alert(1)" style="color:red"><strong>Safe</strong><img src=x onerror=alert(1)><a href="javascript:alert(1)">link</a><script>bad()</script></p>')
    assert '<strong>Safe</strong>' in cleaned
    assert not any(word in cleaned for word in ('onclick', 'style=', '<img', '<script', '<a ', 'javascript:'))
    assert '<b>Safe</b>' in homework_telegram(cleaned, 'html')


def test_long_unicode_chunks_preserve_text_and_balanced_formatting():
    text = '😀<&' * 3000
    from html import escape
    chunks = list(telegram_html_chunks(f'<b><i>{escape(text)}</i></b>'))
    assert len(chunks) > 1
    assert ''.join(''.join(part for part, _ in segments(chunk)) for chunk in chunks) == text
    for chunk in chunks:
        assert chunk.startswith('<b><i>') and chunk.endswith('</i></b>')
        assert len(homework_plain(chunk, 'html').encode('utf-16-le')) // 2 <= 3500
    bot = SimpleNamespace(send_message=AsyncMock())
    async_to_sync(send_html_message)(bot, 99, f'<b>{escape(text)}</b>')
    assert bot.send_message.call_count == len(chunks)
    assert all(call.kwargs['parse_mode'] == 'HTML' for call in bot.send_message.call_args_list)


@pytest.mark.django_db
def test_homework_api_round_trip_sanitizes_and_keeps_legacy_default(world):
    url = f'/api/groups/{world.group.pk}/lessons/{world.lesson.pk}/homework/'
    teacher = client(world.teacher)
    result = teacher.post(url, {'assignment': '<p><strong>Read</strong><img src=x></p>', 'assignment_format': 'html'}, format='json')
    assert result.status_code == 200
    assert result.data == {'assignment': '<p><strong>Read</strong></p>', 'assignment_format': 'html'}
    assert client(world.student).get(url).data['assignment_format'] == 'html'
    legacy = teacher.post(url, {'assignment': '<b>literal</b>'}, format='json')
    assert legacy.data['assignment_format'] == 'plain'
    world.lesson.refresh_from_db()
    assert world.lesson.homework == '<b>literal</b>' and world.lesson.homework_format == 'plain'
    for payload in [{'assignment': []}, {'assignment': 'x', 'assignment_format': 'markdown'}, {'assignment': 'x' * 100001}]:
        assert teacher.post(url, payload, format='json').status_code == 400


@pytest.mark.django_db
def test_lesson_patch_cannot_bypass_sanitization(world):
    url = f'/api/groups/{world.group.pk}/lessons/{world.lesson.pk}/'
    result = client(world.teacher).patch(url, {'homework': '<p onmouseover=x>Read <u>this</u></p>', 'homework_format': 'html'}, format='json')
    assert result.status_code == 200
    assert result.data['homework'] == '<p>Read <u>this</u></p>'
    assert result.data['homework_format'] == 'html'
    assert client(world.teacher).patch(url, {'homework_format': 'plain'}, format='json').status_code == 400


@pytest.mark.django_db
def test_format_only_change_requires_confirmation_and_reaches_students_and_chat(reports):
    w, sent = reports
    w.lesson.homework = '<strong>Read</strong>'
    w.lesson.save()
    publish(w)
    sent.clear()
    w.group.telegram_chat_id = '-10042'
    w.group.save()
    w.lesson.refresh_from_db()
    w.lesson.homework_format = 'html'
    w.lesson.save()
    preview = client(w.teacher).get(endpoint(w)).data
    assert preview['has_changes']
    assert preview['parent_count'] == 0
    assert preview['common_changes']['homework']['old_format'] == 'plain'
    publish(w)
    assert {call[0] for call in sent} == {w.student.telegram_id, w.outsider.telegram_id, -10042}
    assert all('<b>Read</b>' in call[2]['message_html'] for call in sent)
    assert all('&lt;strong&gt;Read&lt;/strong&gt;' in call[2]['message_html'] for call in sent)
    sent.clear()
    publish(w)
    assert sent == []


@pytest.mark.django_db
def test_first_report_homework_dm_and_group_are_formatted(reports, monkeypatch):
    w, sent = reports
    w.lesson.homework = '<ul><li><p><strong>Read</strong> &amp; solve</p></li></ul>'
    w.lesson.homework_format = 'html'
    w.lesson.save()
    w.group.telegram_chat_id = '-10042'
    w.group.save()
    bot = SimpleNamespace(send_message=AsyncMock())
    monkeypatch.setenv('TELEGRAM_BOT_TOKEN', 'fake-token')
    monkeypatch.setattr('telegram.Bot', lambda token: bot)
    publish(w)
    homework_calls = [call for call in sent if call[1] == 'hw_notification']
    assert len(homework_calls) == 2
    assert all(call[2]['homework_format'] == 'html' for call in homework_calls)
    assert bot.send_message.call_args.kwargs['parse_mode'] == 'HTML'
    assert '• <b>Read</b> &amp; solve' in bot.send_message.call_args.kwargs['text']


def test_notification_sender_formats_and_escapes_homework(monkeypatch):
    from users import telegram_bot
    bot = SimpleNamespace(send_message=AsyncMock())
    monkeypatch.setenv('TELEGRAM_BOT_TOKEN', 'fake-token')
    monkeypatch.setattr(telegram_bot, 'Bot', lambda token: bot)
    async_to_sync(telegram_bot.send_notification)(77, 'hw_notification', 'uz', lesson='L<1>', group='A&B', homework='<p><strong>Read</strong></p>', homework_format='html')
    text = bot.send_message.call_args.kwargs['text']
    assert 'L&lt;1&gt;' in text and 'A&amp;B' in text and '<b>Read</b>' in text
    assert bot.send_message.call_args.kwargs['parse_mode'] == 'HTML'


@pytest.mark.django_db
def test_homework_command_uses_same_format(reports, monkeypatch):
    from users import telegram_bot
    w, _ = reports
    w.lesson.homework = '<ol><li><p><u>Review</u></p></li></ol>'
    w.lesson.homework_format = 'html'
    w.lesson.save()
    reply = AsyncMock()
    update = SimpleNamespace(effective_user=SimpleNamespace(id=w.student.telegram_id), message=SimpleNamespace(reply_text=reply))
    async_to_sync(telegram_bot.homework_cmd)(update, None)
    assert reply.call_args.kwargs['parse_mode'] == 'HTML'
    assert '1. <u>Review' in reply.call_args.args[0]


@pytest.mark.django_db
def test_editor_normalization_without_a_visible_change_does_not_resend(reports):
    w, sent = reports
    w.lesson.homework = 'Read carefully'
    w.lesson.save()
    publish(w)
    sent.clear()
    w.lesson.refresh_from_db()
    w.lesson.homework = '<p>Read carefully</p>'
    w.lesson.homework_format = 'html'
    w.lesson.save()
    assert client(w.teacher).get(endpoint(w)).data['has_changes'] is False
    publish(w)
    assert sent == []
