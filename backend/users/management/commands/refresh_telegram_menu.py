import json
import logging
import os
import urllib.error
import urllib.request

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


def _post(token, method, payload):
    url = f'https://api.telegram.org/bot{token}/{method}'
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            if not result.get('ok'):
                logger.warning('%s failed: %s', method, result)
            return result
    except urllib.error.URLError as exc:
        logger.error('%s error: %s', method, exc)
        return None


class Command(BaseCommand):
    help = (
        "Re-sends the reply-keyboard menu and refreshes the '/' command list "
        "for every already-linked Telegram user. Run this after changing "
        "MENU_BUTTONS or ROLE_COMMANDS in users/telegram_bot.py, since Telegram "
        "clients otherwise keep showing the stale menu from when the user last "
        "ran /start."
    )

    def handle(self, *args, **options):
        from users.models import User
        from users.telegram_bot import MENU_BUTTONS, ROLE_COMMANDS

        token = os.environ.get('TELEGRAM_BOT_TOKEN')
        if not token:
            self.stderr.write('TELEGRAM_BOT_TOKEN not set')
            return

        users = User.objects.filter(telegram_id__isnull=False)
        refreshed = 0
        for user in users:
            role_commands = ROLE_COMMANDS.get(user.role)
            if role_commands is None:
                continue

            lang = user.telegram_lang if user.telegram_lang in ('uz', 'ru') else 'uz'

            commands = [{'command': cmd, 'description': desc} for cmd, desc in role_commands]
            commands += [
                {'command': 'username', 'description': "Usernameni ko'rish / Мой логин"},
                {'command': 'help',     'description': 'Yordam / Помощь'},
            ]
            _post(token, 'setMyCommands', {
                'commands': commands,
                'scope': {'type': 'chat', 'chat_id': user.telegram_id},
            })

            rows = MENU_BUTTONS.get(lang, MENU_BUTTONS['uz']).get(user.role)
            if rows:
                menu_label = '👇 Menyu:' if lang == 'uz' else '👇 Меню:'
                _post(token, 'sendMessage', {
                    'chat_id': user.telegram_id,
                    'text': menu_label,
                    'reply_markup': {
                        'keyboard': [[{'text': btn} for btn in row] for row in rows],
                        'resize_keyboard': True,
                    },
                })

            refreshed += 1

        self.stdout.write(f'Refreshed menu for {refreshed} linked user(s).')
