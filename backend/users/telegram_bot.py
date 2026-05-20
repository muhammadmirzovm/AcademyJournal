"""
Telegram bot for AcademyJournal — webhook mode.
Flows:
  1. /start          → ask language → show welcome
  2. /start <token>  → ask language → link Telegram account
  3. send_otp()      → send OTP code in user's saved language
"""

import os
import logging
from asgiref.sync import sync_to_async
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, Bot
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler, ContextTypes

logger = logging.getLogger(__name__)

# ── Translations ───────────────────────────────────────────────────────────────

MSG = {
    'uz': {
        'choose_lang': "Tilni tanlang / Выберите язык:",
        'welcome': (
            "Salom, {name}! 👋\n\n"
            "Bu bot AcademyJournal uchun ishlatiladi:\n"
            "• Telegram hisobingizni ulash\n"
            "• Parolni tiklash uchun OTP kodi yuborish\n\n"
            "Hisobingizni ulash uchun AcademyJournal-dagi Profilingizga o'ting "
            "va «Telegramni ulash» tugmasini bosing."
        ),
        'invalid_link': "❌ Bu havola yaroqsiz yoki allaqachon ishlatilgan.",
        'expired_link': "❌ Bu havolaning muddati tugagan. Profilingizdan yangi havola oling.",
        'already_taken': "❌ Bu Telegram hisobi boshqa foydalanuvchiga bog'langan.",
        'success': (
            "✅ Muvaffaqiyatli! Telegramingiz @{username} hisobiga ulandi.\n\n"
            "Endi Login sahifasidagi «Parolni unutdim?» tugmasidan foydalanishingiz mumkin."
        ),
        'otp': (
            "🔐 AcademyJournal — parolni tiklash\n\n"
            "Sizning OTP kodingiz: *{code}*\n\n"
            "Kod 5 daqiqa ichida amal qiladi. Uni hech kimga bermang."
        ),
    },
    'ru': {
        'choose_lang': "Tilni tanlang / Выберите язык:",
        'welcome': (
            "Привет, {name}! 👋\n\n"
            "Этот бот используется AcademyJournal для:\n"
            "• Привязки аккаунта Telegram\n"
            "• Отправки OTP-кода для сброса пароля\n\n"
            "Чтобы привязать аккаунт, перейдите в свой Профиль в AcademyJournal "
            "и нажмите «Подключить Telegram»."
        ),
        'invalid_link': "❌ Эта ссылка недействительна или уже была использована.",
        'expired_link': "❌ Срок действия ссылки истёк. Получите новую ссылку в Профиле.",
        'already_taken': "❌ Этот Telegram уже привязан к другому аккаунту.",
        'success': (
            "✅ Успешно! Ваш Telegram привязан к @{username}.\n\n"
            "Теперь вы можете использовать «Забыли пароль?» на странице входа."
        ),
        'otp': (
            "🔐 AcademyJournal — сброс пароля\n\n"
            "Ваш OTP-код: *{code}*\n\n"
            "Код действителен 5 минут. Не передавайте его никому."
        ),
    },
}

LANG_KEYBOARD = InlineKeyboardMarkup([
    [
        InlineKeyboardButton("🇺🇿 O'zbek", callback_data='lang_uz'),
        InlineKeyboardButton("🇷🇺 Русский", callback_data='lang_ru'),
    ]
])


# ── Handlers ───────────────────────────────────────────────────────────────────

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if args:
        context.user_data['pending_token'] = args[0]

    telegram_id = update.effective_user.id
    from users.models import User
    try:
        user = await sync_to_async(User.objects.get)(telegram_id=telegram_id)
        if user.telegram_lang:
            context.user_data['lang'] = user.telegram_lang
    except User.DoesNotExist:
        pass

    await update.message.reply_text(
        MSG['uz']['choose_lang'],
        reply_markup=LANG_KEYBOARD,
    )


async def language_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    lang = query.data.split('_')[1]
    context.user_data['lang'] = lang
    telegram_id = query.from_user.id
    first_name = query.from_user.first_name or ''

    from users.models import User
    try:
        user = await sync_to_async(User.objects.get)(telegram_id=telegram_id)
        user.telegram_lang = lang
        await sync_to_async(user.save)(update_fields=['telegram_lang'])
    except User.DoesNotExist:
        pass

    pending_token = context.user_data.pop('pending_token', None)

    if pending_token:
        await _process_connect(query, telegram_id, lang, pending_token)
    else:
        await query.edit_message_text(MSG[lang]['welcome'].format(name=first_name))


async def _process_connect(query, telegram_id: int, lang: str, token_str: str):
    from users.models import TelegramConnectToken, User

    try:
        token_obj = await sync_to_async(
            TelegramConnectToken.objects.select_related('user').get
        )(token=token_str)
    except TelegramConnectToken.DoesNotExist:
        await query.edit_message_text(MSG[lang]['invalid_link'])
        return

    if token_obj.is_expired():
        await sync_to_async(token_obj.delete)()
        await query.edit_message_text(MSG[lang]['expired_link'])
        return

    user = token_obj.user

    already_taken = await sync_to_async(
        User.objects.filter(telegram_id=telegram_id).exclude(pk=user.pk).exists
    )()
    if already_taken:
        await query.edit_message_text(MSG[lang]['already_taken'])
        return

    user.telegram_id = telegram_id
    user.telegram_lang = lang
    await sync_to_async(user.save)(update_fields=['telegram_id', 'telegram_lang'])
    await sync_to_async(token_obj.delete)()

    await query.edit_message_text(MSG[lang]['success'].format(username=user.username))


# ── OTP sender (called from views) ────────────────────────────────────────────

async def send_otp(telegram_id: int, code: str, lang: str = 'uz'):
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        raise RuntimeError('TELEGRAM_BOT_TOKEN is not set')

    bot = Bot(token=bot_token)
    await bot.send_message(
        chat_id=telegram_id,
        text=MSG.get(lang, MSG['uz'])['otp'].format(code=code),
        parse_mode='Markdown',
    )


# ── Notification sender (called from signals) ─────────────────────────────────

NOTIF_MSG = {
    'uz': {
        'score':            "📊 *{lesson}* darsida *{score}/5* ball oldingiz ({group})",
        'absent':           "⚠️ *{lesson}* darsida qatnashmagansiz ({group})",
        'score_parent':     "📊 *{name}*: *{lesson}* darsida *{score}/5* ball oldi ({group})",
        'absent_parent':    "⚠️ *{name}*: *{lesson}* darsida qatnashmadi ({group})",
        'lesson_end':       "📋 *{lesson}* darsi yakunlandi ({group})\n👤 Davomat: {attendance}\n⭐ Ball: {score}",
        'lesson_end_parent':"📋 *{name}* — *{lesson}* darsi yakunlandi ({group})\n👤 Davomat: {attendance}\n⭐ Ball: {score}",
    },
    'ru': {
        'score':            "📊 Вы получили *{score}/5* в уроке «{lesson}» ({group})",
        'absent':           "⚠️ Вы отсутствовали на уроке «{lesson}» ({group})",
        'score_parent':     "📊 *{name}*: получил(а) *{score}/5* в уроке «{lesson}» ({group})",
        'absent_parent':    "⚠️ *{name}*: отсутствовал(а) на уроке «{lesson}» ({group})",
        'lesson_end':       "📋 Урок *{lesson}* завершён ({group})\n👤 Посещаемость: {attendance}\n⭐ Оценка: {score}",
        'lesson_end_parent':"📋 *{name}* — урок *{lesson}* завершён ({group})\n👤 Посещаемость: {attendance}\n⭐ Оценка: {score}",
    },
}


async def send_notification(telegram_id: int, msg_key: str, lang: str = 'uz', **kwargs):
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        return
    msgs = NOTIF_MSG.get(lang, NOTIF_MSG['uz'])
    text = msgs.get(msg_key, '').format(**kwargs)
    if not text:
        return
    bot = Bot(token=bot_token)
    try:
        await bot.send_message(chat_id=telegram_id, text=text, parse_mode='Markdown')
    except Exception as e:
        logger.error('Telegram notification error: %s', e)


# ── Application singleton (used by webhook view) ───────────────────────────────

_application = None


def get_application():
    global _application
    if _application is not None:
        return _application

    from django.conf import settings
    from asgiref.sync import async_to_sync

    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        raise RuntimeError('TELEGRAM_BOT_TOKEN is not set')

    app = ApplicationBuilder().token(bot_token).build()
    app.add_handler(CommandHandler('start', start))
    app.add_handler(CallbackQueryHandler(language_callback, pattern=r'^lang_(uz|ru)$'))
    async_to_sync(app.initialize)()

    _application = app
    return _application
