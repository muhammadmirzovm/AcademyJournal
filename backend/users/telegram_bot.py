"""
Telegram bot for AcademyJournal — webhook mode.
Commands: /start, /mystats, /homework, /help
"""

import os
import logging
from asgiref.sync import sync_to_async
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, Bot, BotCommand
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler, ContextTypes

logger = logging.getLogger(__name__)

# ── Translations ───────────────────────────────────────────────────────────────

MSG = {
    'uz': {
        'choose_lang': "Tilni tanlang / Выберите язык:",

        'welcome_unlinked': (
            "Salom, {name}! 👋\n\n"
            "Bu bot AcademyJournal uchun.\n"
            "Hisobingizni ulash uchun AcademyJournal Profilingizga o'ting "
            "va «Telegramni ulash» tugmasini bosing.\n\n"
            "📌 Buyruqlar:\n"
            "/help — yordam"
        ),
        'welcome_student': (
            "Salom, {name}! 👋  Hisobingiz ulangan ✅\n\n"
            "📌 Buyruqlar:\n"
            "/mystats — ballar va davomatni ko'rish\n"
            "/homework — uy vazifalarini ko'rish\n"
            "/help — barcha buyruqlar"
        ),
        'welcome_parent': (
            "Salom, {name}! 👋  Hisobingiz ulangan ✅\n\n"
            "📌 Buyruqlar:\n"
            "/mystats — farzandlaringiz statistikasi\n"
            "/help — barcha buyruqlar"
        ),
        'welcome_other': (
            "Salom, {name}! 👋  Hisobingiz ulangan ✅\n\n"
            "📌 Buyruqlar:\n"
            "/help — barcha buyruqlar"
        ),
        'success': (
            "✅ Muvaffaqiyatli! Telegramingiz @{username} hisobiga ulandi.\n\n"
            "Endi «Parolni unutdim?» tugmasidan foydalanishingiz mumkin.\n\n"
            "📌 Buyruqlar:\n"
            "/mystats — statistikani ko'rish\n"
            "/homework — uy vazifalarini ko'rish\n"
            "/help — barcha buyruqlar"
        ),
        'invalid_link':  "❌ Bu havola yaroqsiz yoki allaqachon ishlatilgan.",
        'expired_link':  "❌ Bu havolaning muddati tugagan. Profilingizdan yangi havola oling.",
        'already_taken': "❌ Bu Telegram hisobi boshqa foydalanuvchiga bog'langan.",
        'not_linked':    "❌ Hisobingiz ulanmagan. AcademyJournal Profilingizga o'ting va Telegramni ulang.",
        'no_data':       "📭 Hozircha ma'lumot yo'q.",
        'otp': (
            "🔐 AcademyJournal — parolni tiklash\n\n"
            "Sizning OTP kodingiz: *{code}*\n\n"
            "Kod 5 daqiqa ichida amal qiladi. Uni hech kimga bermang."
        ),

        'help_student': (
            "📚 *AcademyJournal Bot*\n\n"
            "/mystats — ballar va davomatni ko'rish\n"
            "/homework — barcha uy vazifalarini ko'rish\n"
            "/help — shu ro'yxat"
        ),
        'help_parent': (
            "📚 *AcademyJournal Bot*\n\n"
            "/mystats — farzandlaringiz statistikasi\n"
            "/help — shu ro'yxat"
        ),
        'help_other': (
            "📚 *AcademyJournal Bot*\n\n"
            "/help — shu ro'yxat\n\n"
            "Hisobingizni ulash uchun AcademyJournal Profilingizga o'ting."
        ),

        'stats_header_student': "📊 *Sizning statistikangiz:*\n",
        'stats_header_parent':  "📊 *Farzandlaringiz statistikasi:*\n",
        'stats_child':          "\n👤 *{name}*",
        'stats_group':          "\n📚 {group}\n• Davomat: {attendance}%\n• Ball: {score}%",
        'stats_no_groups':      "\nGuruhlar topilmadi.",

        'homework_header': "📝 *Uy vazifalari:*\n",
        'homework_item':   "\n📚 *{group}* — {lesson}\n{homework}",
        'homework_none':   "📭 Hozircha uy vazifasi yo'q.",

        'hw_notification': "📝 *{lesson}* darsi uchun uy vazifasi ({group}):\n\n{homework}",
    },
    'ru': {
        'choose_lang': "Tilni tanlang / Выберите язык:",

        'welcome_unlinked': (
            "Привет, {name}! 👋\n\n"
            "Этот бот используется AcademyJournal.\n"
            "Чтобы привязать аккаунт, перейдите в Профиль в AcademyJournal "
            "и нажмите «Подключить Telegram».\n\n"
            "📌 Команды:\n"
            "/help — помощь"
        ),
        'welcome_student': (
            "Привет, {name}! 👋  Аккаунт привязан ✅\n\n"
            "📌 Команды:\n"
            "/mystats — оценки и посещаемость\n"
            "/homework — домашние задания\n"
            "/help — все команды"
        ),
        'welcome_parent': (
            "Привет, {name}! 👋  Аккаунт привязан ✅\n\n"
            "📌 Команды:\n"
            "/mystats — статистика детей\n"
            "/help — все команды"
        ),
        'welcome_other': (
            "Привет, {name}! 👋  Аккаунт привязан ✅\n\n"
            "📌 Команды:\n"
            "/help — все команды"
        ),
        'success': (
            "✅ Успешно! Ваш Telegram привязан к @{username}.\n\n"
            "Теперь вы можете использовать «Забыли пароль?».\n\n"
            "📌 Команды:\n"
            "/mystats — статистика\n"
            "/homework — домашние задания\n"
            "/help — все команды"
        ),
        'invalid_link':  "❌ Эта ссылка недействительна или уже была использована.",
        'expired_link':  "❌ Срок действия ссылки истёк. Получите новую ссылку в Профиле.",
        'already_taken': "❌ Этот Telegram уже привязан к другому аккаунту.",
        'not_linked':    "❌ Аккаунт не привязан. Перейдите в Профиль AcademyJournal и привяжите Telegram.",
        'no_data':       "📭 Данных пока нет.",
        'otp': (
            "🔐 AcademyJournal — сброс пароля\n\n"
            "Ваш OTP-код: *{code}*\n\n"
            "Код действителен 5 минут. Не передавайте его никому."
        ),

        'help_student': (
            "📚 *AcademyJournal Bot*\n\n"
            "/mystats — оценки и посещаемость\n"
            "/homework — домашние задания\n"
            "/help — этот список"
        ),
        'help_parent': (
            "📚 *AcademyJournal Bot*\n\n"
            "/mystats — статистика детей\n"
            "/help — этот список"
        ),
        'help_other': (
            "📚 *AcademyJournal Bot*\n\n"
            "/help — этот список\n\n"
            "Привяжите аккаунт в Профиле AcademyJournal."
        ),

        'stats_header_student': "📊 *Ваша статистика:*\n",
        'stats_header_parent':  "📊 *Статистика детей:*\n",
        'stats_child':          "\n👤 *{name}*",
        'stats_group':          "\n📚 {group}\n• Посещаемость: {attendance}%\n• Оценки: {score}%",
        'stats_no_groups':      "\nГрупп не найдено.",

        'homework_header': "📝 *Домашние задания:*\n",
        'homework_item':   "\n📚 *{group}* — {lesson}\n{homework}",
        'homework_none':   "📭 Домашних заданий пока нет.",

        'hw_notification': "📝 Домашнее задание по уроку *{lesson}* ({group}):\n\n{homework}",
    },
}

LANG_KEYBOARD = InlineKeyboardMarkup([
    [
        InlineKeyboardButton("🇺🇿 O'zbek", callback_data='lang_uz'),
        InlineKeyboardButton("🇷🇺 Русский", callback_data='lang_ru'),
    ]
])


# ── DB helpers (sync, called via sync_to_async) ────────────────────────────────

def _get_user(telegram_id):
    from users.models import User
    try:
        return User.objects.get(telegram_id=telegram_id)
    except User.DoesNotExist:
        return None


def _student_stats(user):
    from groups.models import GroupMembership, Score, Attendance
    from django.db.models import Sum, Count
    memberships = list(GroupMembership.objects.filter(student=user).select_related('group'))
    rows = []
    for m in memberships:
        join_date    = m.joined_at.date()
        lessons_qs   = m.group.lessons.filter(date__gte=join_date)
        lesson_count = lessons_qs.count()
        if lesson_count == 0:
            continue
        score_sum = Score.objects.filter(
            lesson__in=lessons_qs, student=user
        ).aggregate(total=Sum('value'))['total'] or 0
        present = Attendance.objects.filter(
            lesson__in=lessons_qs, student=user, present=True
        ).count()
        rows.append({
            'group':      m.group.name,
            'score':      round(score_sum / (lesson_count * 5) * 100),
            'attendance': round(present / lesson_count * 100),
        })
    return rows


def _parent_stats(user):
    rows = []
    for ps in user.children.select_related('student').all():
        child = ps.student
        name  = f'{child.first_name} {child.last_name}'.strip() or child.username
        rows.append({'name': name, 'stats': _student_stats(child)})
    return rows


def _student_homework(user):
    from groups.models import GroupMembership
    memberships = list(GroupMembership.objects.filter(student=user).select_related('group'))
    items = []
    for m in memberships:
        lessons = list(
            m.group.lessons.filter(homework__gt='').order_by('-date')[:3]
        )
        for lesson in lessons:
            items.append({
                'group':    m.group.name,
                'lesson':   lesson.title,
                'homework': lesson.homework,
            })
    return items


# ── Handlers ───────────────────────────────────────────────────────────────────

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if context.args:
        context.user_data['pending_token'] = context.args[0]
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    if user and user.telegram_lang:
        context.user_data['lang'] = user.telegram_lang
    await update.message.reply_text(MSG['uz']['choose_lang'], reply_markup=LANG_KEYBOARD)


async def language_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    lang        = query.data.split('_')[1]
    context.user_data['lang'] = lang
    telegram_id = query.from_user.id
    first_name  = query.from_user.first_name or ''

    user = await sync_to_async(_get_user)(telegram_id)
    if user:
        user.telegram_lang = lang
        await sync_to_async(user.save)(update_fields=['telegram_lang'])

    pending_token = context.user_data.pop('pending_token', None)
    if pending_token:
        await _process_connect(query, telegram_id, lang, pending_token)
        return

    m = MSG[lang]
    if not user:
        text = m['welcome_unlinked'].format(name=first_name)
    elif user.role == 'student':
        text = m['welcome_student'].format(name=first_name)
    elif user.role == 'parent':
        text = m['welcome_parent'].format(name=first_name)
    else:
        text = m['welcome_other'].format(name=first_name)
    await query.edit_message_text(text)


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

    user.telegram_id   = telegram_id
    user.telegram_lang = lang
    await sync_to_async(user.save)(update_fields=['telegram_id', 'telegram_lang'])
    await sync_to_async(token_obj.delete)()
    await query.edit_message_text(MSG[lang]['success'].format(username=user.username))


async def mystats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return

    if user.role == 'student':
        rows = await sync_to_async(_student_stats)(user)
        if not rows:
            await update.message.reply_text(m['no_data'])
            return
        text = m['stats_header_student']
        for r in rows:
            text += m['stats_group'].format(
                group=r['group'], attendance=r['attendance'], score=r['score']
            )

    elif user.role == 'parent':
        children = await sync_to_async(_parent_stats)(user)
        if not children:
            await update.message.reply_text(m['no_data'])
            return
        text = m['stats_header_parent']
        for c in children:
            text += m['stats_child'].format(name=c['name'])
            if c['stats']:
                for r in c['stats']:
                    text += m['stats_group'].format(
                        group=r['group'], attendance=r['attendance'], score=r['score']
                    )
            else:
                text += m['stats_no_groups']
    else:
        await update.message.reply_text(m['no_data'])
        return

    await update.message.reply_text(text, parse_mode='Markdown')


async def homework_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return

    if user.role != 'student':
        await update.message.reply_text(m['no_data'])
        return

    items = await sync_to_async(_student_homework)(user)
    if not items:
        await update.message.reply_text(m['homework_none'])
        return

    text = m['homework_header']
    for item in items:
        text += m['homework_item'].format(
            group=item['group'], lesson=item['lesson'], homework=item['homework']
        )
    await update.message.reply_text(text, parse_mode='Markdown')


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        key = 'help_other'
    elif user.role == 'student':
        key = 'help_student'
    elif user.role == 'parent':
        key = 'help_parent'
    else:
        key = 'help_other'

    await update.message.reply_text(m[key], parse_mode='Markdown')


# ── OTP sender ────────────────────────────────────────────────────────────────

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


# ── Notification sender ───────────────────────────────────────────────────────

NOTIF_MSG = {
    'uz': {
        'score':                   "📊 *{lesson}* darsida *{score}/5* ball oldingiz ({group})",
        'absent':                  "⚠️ *{lesson}* darsida qatnashmagansiz ({group})",
        'score_parent':            "📊 *{name}*: *{lesson}* darsida *{score}/5* ball oldi ({group})",
        'absent_parent':           "⚠️ *{name}*: *{lesson}* darsida qatnashmadi ({group})",
        'student_present_scored':  "✅ *{lesson}* darsida qatnashdingiz.\n⭐ Balingiz: *{score}/5* | {group}",
        'student_present_unscored':"✅ *{lesson}* darsida qatnashdingiz. | {group}",
        'student_absent_scored':   "⚠️ *{lesson}* darsiga kelmadingiz.\n⭐ Balingiz: *{score}/5* | {group}",
        'student_absent_unscored': "⚠️ *{lesson}* darsiga kelmadingiz. | {group}",
        'parent_present_scored':   "✅ *{name}* *{lesson}* darsida qatnashdi.\n⭐ Ball: *{score}/5* | {group}",
        'parent_present_unscored': "✅ *{name}* *{lesson}* darsida qatnashdi. | {group}",
        'parent_absent_scored':    "⚠️ *{name}* *{lesson}* darsiga kelmadi.\n⭐ Ball: *{score}/5* | {group}",
        'parent_absent_unscored':  "⚠️ *{name}* *{lesson}* darsiga kelmadi. | {group}",
        'hw_notification':         "📝 *{lesson}* darsi uchun uy vazifasi ({group}):\n\n{homework}",
        'direct_message':          "📢 *{sender}* sizga xabar yubordi:\n\n{message}",
        'direct_message_parent':   "📢 *{sender}* ({student} haqida) xabar yubordi:\n\n{message}",
    },
    'ru': {
        'score':                   "📊 Вы получили *{score}/5* в уроке «{lesson}» ({group})",
        'absent':                  "⚠️ Вы отсутствовали на уроке «{lesson}» ({group})",
        'score_parent':            "📊 *{name}*: получил(а) *{score}/5* в уроке «{lesson}» ({group})",
        'absent_parent':           "⚠️ *{name}*: отсутствовал(а) на уроке «{lesson}» ({group})",
        'student_present_scored':  "✅ Вы посетили урок *{lesson}*.\n⭐ Ваша оценка: *{score}/5* | {group}",
        'student_present_unscored':"✅ Вы посетили урок *{lesson}*. | {group}",
        'student_absent_scored':   "⚠️ Вы пропустили урок *{lesson}*.\n⭐ Ваша оценка: *{score}/5* | {group}",
        'student_absent_unscored': "⚠️ Вы пропустили урок *{lesson}*. | {group}",
        'parent_present_scored':   "✅ *{name}* посетил(а) урок *{lesson}*.\n⭐ Оценка: *{score}/5* | {group}",
        'parent_present_unscored': "✅ *{name}* посетил(а) урок *{lesson}*. | {group}",
        'parent_absent_scored':    "⚠️ *{name}* пропустил(а) урок *{lesson}*.\n⭐ Оценка: *{score}/5* | {group}",
        'parent_absent_unscored':  "⚠️ *{name}* пропустил(а) урок *{lesson}*. | {group}",
        'hw_notification':         "📝 Домашнее задание по уроку *{lesson}* ({group}):\n\n{homework}",
        'direct_message':          "📢 *{sender}* отправил(а) вам сообщение:\n\n{message}",
        'direct_message_parent':   "📢 *{sender}* (о {student}) отправил(а) сообщение:\n\n{message}",
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


# ── Application singleton ─────────────────────────────────────────────────────

_application = None


def get_application():
    global _application
    if _application is not None:
        return _application

    from asgiref.sync import async_to_sync

    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        raise RuntimeError('TELEGRAM_BOT_TOKEN is not set')

    app = ApplicationBuilder().token(bot_token).build()
    app.add_handler(CommandHandler('start',    start))
    app.add_handler(CommandHandler('mystats',  mystats))
    app.add_handler(CommandHandler('homework', homework_cmd))
    app.add_handler(CommandHandler('help',     help_cmd))
    app.add_handler(CallbackQueryHandler(language_callback, pattern=r'^lang_(uz|ru)$'))
    async_to_sync(app.initialize)()

    # Register bot command menu (shows up when user taps /)
    async def _set_commands():
        await app.bot.set_my_commands([
            BotCommand('mystats',  'Ballar va davomat / Оценки и посещаемость'),
            BotCommand('homework', 'Uy vazifalari / Домашние задания'),
            BotCommand('help',     'Yordam / Помощь'),
        ])
    try:
        async_to_sync(_set_commands)()
    except Exception as e:
        logger.warning('Could not set bot commands: %s', e)

    _application = app
    return _application
