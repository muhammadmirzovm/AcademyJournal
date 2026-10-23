"""Isolated tests: never read the local production .env or use its services."""
import os

os.environ.update({
    'SKIP_DOTENV': 'true',
    'SECRET_KEY': 'isolated-tests-only-secret-key-not-for-production',
    'DEBUG': 'true',
    'DATABASE_URL': os.environ.get('TEST_DATABASE_URL', 'sqlite:///:memory:'),
    'TELEGRAM_BOT_TOKEN': '',
    'VAPID_PRIVATE_KEY': '',
})
from .settings import *  # noqa: E402,F403

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
