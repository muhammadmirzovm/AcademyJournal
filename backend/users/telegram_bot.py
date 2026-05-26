"""
Telegram bot for AcademyJournal — webhook mode.
"""

import os
import logging
from asgiref.sync import sync_to_async
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, Bot, BotCommand
from telegram.ext import (
    ApplicationBuilder, CommandHandler, CallbackQueryHandler,
    ContextTypes, ConversationHandler, MessageHandler, filters,
)

logger = logging.getLogger(__name__)

# ── Conversation states ────────────────────────────────────────────────────────
NOTIFY_CHOOSE = 0
NOTIFY_MSG    = 1

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
            "/myrank — reytingdagi o'rningiz\n"
            "/homework — uy vazifalarini ko'rish\n"
            "/help — barcha buyruqlar"
        ),
        'welcome_teacher': (
            "Salom, {name}! 👋  Hisobingiz ulangan ✅\n\n"
            "📌 Buyruqlar:\n"
            "/mygroups — guruhlaringiz statistikasi\n"
            "/struggling — qiynalayotgan o'quvchilar\n"
            "/notify — guruhga xabar yuborish\n"
            "/help — barcha buyruqlar"
        ),
        'welcome_admin': (
            "Salom, {name}! 👋  Hisobingiz ulangan ✅\n\n"
            "📌 Buyruqlar:\n"
            "/academy — akademiya statistikasi\n"
            "/help — barcha buyruqlar"
        ),
        'welcome_parent': (
            "Salom, {name}! 👋  Hisobingiz ulangan ✅\n\n"
            "📌 Buyruqlar:\n"
            "/mystats — farzandlaringiz statistikasi\n"
            "/lessons — so'nggi darslar\n"
            "/help — barcha buyruqlar"
        ),
        'welcome_other': (
            "Salom, {name}! 👋  Hisobingiz ulangan ✅\n\n"
            "📌 Buyruqlar:\n"
            "/help — barcha buyruqlar"
        ),
        'success': (
            "✅ Muvaffaqiyatli! Telegramingiz @{username} hisobiga ulandi.\n\n"
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

        # ── Help messages ──────────────────────────────────────────────────
        'help_student': (
            "📚 *AcademyJournal Bot*\n\n"
            "/mystats — ballar va davomatni ko'rish\n"
            "/myrank — reytingdagi o'rningiz\n"
            "/homework — barcha uy vazifalarini ko'rish\n"
            "/help — shu ro'yxat"
        ),
        'help_teacher': (
            "📚 *AcademyJournal Bot*\n\n"
            "/mygroups — guruhlaringiz statistikasi\n"
            "/struggling — qiynalayotgan o'quvchilar\n"
            "/notify — guruhga xabar yuborish\n"
            "/help — shu ro'yxat"
        ),
        'help_admin': (
            "📚 *AcademyJournal Bot*\n\n"
            "/academy — akademiya statistikasi\n"
            "/help — shu ro'yxat"
        ),
        'help_parent': (
            "📚 *AcademyJournal Bot*\n\n"
            "/mystats — farzandlaringiz statistikasi\n"
            "/lessons — so'nggi darslar\n"
            "/help — shu ro'yxat"
        ),
        'help_other': (
            "📚 *AcademyJournal Bot*\n\n"
            "/help — shu ro'yxat\n\n"
            "Hisobingizni ulash uchun AcademyJournal Profilingizga o'ting."
        ),

        # ── Student stats ──────────────────────────────────────────────────
        'stats_header_student': "📊 *Sizning statistikangiz:*\n",
        'stats_header_parent':  "📊 *Farzandlaringiz statistikasi:*\n",
        'stats_child':          "\n👤 *{name}*",
        'stats_group':          "\n📚 {group}\n• Davomat: {attendance}%\n• Ball: {score}%",
        'stats_no_groups':      "\nGuruhlar topilmadi.",

        # ── Student rank ───────────────────────────────────────────────────
        'rank_header':   "🏆 *Reytingdagi o'rningiz:*\n",
        'rank_item':     "\n📚 {group}: *{rank}/{total}* o'rin",
        'rank_no_data':  "📭 Reyting hali aniqlanmagan.",

        # ── Homework ───────────────────────────────────────────────────────
        'homework_header': "📝 *Uy vazifalari:*\n",
        'homework_item':   "\n📚 *{group}* — {lesson}\n{homework}",
        'homework_none':   "📭 Hozircha uy vazifasi yo'q.",
        'hw_notification': "📝 *{lesson}* darsi uchun uy vazifasi ({group}):\n\n{homework}",

        # ── Teacher: groups ────────────────────────────────────────────────
        'groups_header': "👥 *Guruhlaringiz:*\n",
        'groups_item':   "\n📚 *{name}*\n• O'quvchilar: {count}\n• Ball: {score}% | Davomat: {att}%",
        'groups_none':   "📭 Hozircha guruh yo'q.",

        # ── Teacher: struggling ────────────────────────────────────────────
        'struggling_header': "⚠️ *Qiynalayotgan o'quvchilar:*\n",
        'struggling_item':   "\n👤 {name} ({group})\n• Ball: {score}% | Davomat: {att}%",
        'struggling_none':   "✅ Hamma yaxshi o'qiyapti!",

        # ── Teacher: notify ────────────────────────────────────────────────
        'notify_choose': "📢 Qaysi guruhga xabar yuborasiz?",
        'notify_type':   "✏️ Xabar matnini yozing (bekor qilish uchun /cancel):",
        'notify_sent':   "✅ Xabar {count} ta o'quvchiga yuborildi.",
        'notify_no_tg':  "📭 Bu guruhda ulangan Telegram foydalanuvchi yo'q.",
        'notify_cancel': "❌ Bekor qilindi.",

        # ── Parent: recent lessons ─────────────────────────────────────────
        'lessons_header': "📅 *So'nggi darslar:*\n",
        'lessons_child':  "\n👤 *{name}*",
        'lessons_item':   "\n• {lesson}: {status} {score}",
        'lessons_none':   "\nDarslar topilmadi.",

        # ── Admin ──────────────────────────────────────────────────────────
        'academy_stats': (
            "🏫 *Akademiya statistikasi:*\n\n"
            "👨‍🏫 O'qituvchilar: *{teachers}*\n"
            "🎓 O'quvchilar: *{students}*"
        ),
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
            "/myrank — ваше место в рейтинге\n"
            "/homework — домашние задания\n"
            "/help — все команды"
        ),
        'welcome_teacher': (
            "Привет, {name}! 👋  Аккаунт привязан ✅\n\n"
            "📌 Команды:\n"
            "/mygroups — статистика групп\n"
            "/struggling — отстающие ученики\n"
            "/notify — отправить сообщение группе\n"
            "/help — все команды"
        ),
        'welcome_admin': (
            "Привет, {name}! 👋  Аккаунт привязан ✅\n\n"
            "📌 Команды:\n"
            "/academy — статистика академии\n"
            "/help — все команды"
        ),
        'welcome_parent': (
            "Привет, {name}! 👋  Аккаунт привязан ✅\n\n"
            "📌 Команды:\n"
            "/mystats — статистика детей\n"
            "/lessons — последние уроки\n"
            "/help — все команды"
        ),
        'welcome_other': (
            "Привет, {name}! 👋  Аккаунт привязан ✅\n\n"
            "📌 Команды:\n"
            "/help — все команды"
        ),
        'success': (
            "✅ Успешно! Ваш Telegram привязан к @{username}.\n\n"
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

        # ── Help messages ──────────────────────────────────────────────────
        'help_student': (
            "📚 *AcademyJournal Bot*\n\n"
            "/mystats — оценки и посещаемость\n"
            "/myrank — ваше место в рейтинге\n"
            "/homework — домашние задания\n"
            "/help — этот список"
        ),
        'help_teacher': (
            "📚 *AcademyJournal Bot*\n\n"
            "/mygroups — статистика групп\n"
            "/struggling — отстающие ученики\n"
            "/notify — отправить сообщение группе\n"
            "/help — этот список"
        ),
        'help_admin': (
            "📚 *AcademyJournal Bot*\n\n"
            "/academy — статистика академии\n"
            "/help — этот список"
        ),
        'help_parent': (
            "📚 *AcademyJournal Bot*\n\n"
            "/mystats — статистика детей\n"
            "/lessons — последние уроки\n"
            "/help — этот список"
        ),
        'help_other': (
            "📚 *AcademyJournal Bot*\n\n"
            "/help — этот список\n\n"
            "Привяжите аккаунт в Профиле AcademyJournal."
        ),

        # ── Student stats ──────────────────────────────────────────────────
        'stats_header_student': "📊 *Ваша статистика:*\n",
        'stats_header_parent':  "📊 *Статистика детей:*\n",
        'stats_child':          "\n👤 *{name}*",
        'stats_group':          "\n📚 {group}\n• Посещаемость: {attendance}%\n• Оценки: {score}%",
        'stats_no_groups':      "\nГрупп не найдено.",

        # ── Student rank ───────────────────────────────────────────────────
        'rank_header':  "🏆 *Ваше место в рейтинге:*\n",
        'rank_item':    "\n📚 {group}: *{rank}/{total}* место",
        'rank_no_data': "📭 Рейтинг ещё не определён.",

        # ── Homework ───────────────────────────────────────────────────────
        'homework_header': "📝 *Домашние задания:*\n",
        'homework_item':   "\n📚 *{group}* — {lesson}\n{homework}",
        'homework_none':   "📭 Домашних заданий пока нет.",
        'hw_notification': "📝 Домашнее задание по уроку *{lesson}* ({group}):\n\n{homework}",

        # ── Teacher: groups ────────────────────────────────────────────────
        'groups_header': "👥 *Ваши группы:*\n",
        'groups_item':   "\n📚 *{name}*\n• Учеников: {count}\n• Оценки: {score}% | Посещаемость: {att}%",
        'groups_none':   "📭 Групп пока нет.",

        # ── Teacher: struggling ────────────────────────────────────────────
        'struggling_header': "⚠️ *Отстающие ученики:*\n",
        'struggling_item':   "\n👤 {name} ({group})\n• Оценки: {score}% | Посещаемость: {att}%",
        'struggling_none':   "✅ Все учатся хорошо!",

        # ── Teacher: notify ────────────────────────────────────────────────
        'notify_choose': "📢 В какую группу отправить сообщение?",
        'notify_type':   "✏️ Напишите текст сообщения (отмена: /cancel):",
        'notify_sent':   "✅ Сообщение отправлено {count} ученикам.",
        'notify_no_tg':  "📭 В этой группе нет учеников с привязанным Telegram.",
        'notify_cancel': "❌ Отменено.",

        # ── Parent: recent lessons ─────────────────────────────────────────
        'lessons_header': "📅 *Последние уроки:*\n",
        'lessons_child':  "\n👤 *{name}*",
        'lessons_item':   "\n• {lesson}: {status} {score}",
        'lessons_none':   "\nУроков не найдено.",

        # ── Admin ──────────────────────────────────────────────────────────
        'academy_stats': (
            "🏫 *Статистика академии:*\n\n"
            "👨‍🏫 Учителей: *{teachers}*\n"
            "🎓 Учеников: *{students}*"
        ),
    },
}

LANG_KEYBOARD = InlineKeyboardMarkup([
    [
        InlineKeyboardButton("🇺🇿 O'zbek", callback_data='lang_uz'),
        InlineKeyboardButton("🇷🇺 Русский", callback_data='lang_ru'),
    ]
])


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _get_user(telegram_id):
    from users.models import User
    try:
        return User.objects.get(telegram_id=telegram_id)
    except User.DoesNotExist:
        return None


def _student_stats(user):
    from groups.models import GroupMembership, Score, Attendance
    from django.db.models import Sum
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


def _student_rank(user):
    from groups.models import GroupMembership, Score
    from django.db.models import Sum
    memberships = list(GroupMembership.objects.filter(student=user).select_related('group'))
    rows = []
    for m in memberships:
        group    = m.group
        lessons  = group.lessons.filter(date__gte=m.joined_at.date())
        if not lessons.exists():
            continue
        all_members = list(GroupMembership.objects.filter(group=group).select_related('student'))
        scores = {}
        for am in all_members:
            s = Score.objects.filter(lesson__in=lessons, student=am.student).aggregate(t=Sum('value'))['t'] or 0
            scores[am.student_id] = s
        sorted_ids = sorted(scores, key=lambda x: scores[x], reverse=True)
        rank = sorted_ids.index(user.id) + 1 if user.id in sorted_ids else len(sorted_ids)
        rows.append({'group': group.name, 'rank': rank, 'total': len(sorted_ids)})
    return rows


def _student_homework(user):
    from groups.models import GroupMembership
    memberships = list(GroupMembership.objects.filter(student=user).select_related('group'))
    items = []
    for m in memberships:
        lessons = list(m.group.lessons.filter(homework__gt='').order_by('-date')[:3])
        for lesson in lessons:
            items.append({
                'group':    m.group.name,
                'lesson':   lesson.title,
                'homework': lesson.homework,
            })
    return items


def _parent_stats(user):
    rows = []
    for ps in user.children.select_related('student').all():
        child = ps.student
        name  = f'{child.first_name} {child.last_name}'.strip() or child.username
        rows.append({'name': name, 'stats': _student_stats(child)})
    return rows


def _parent_recent_lessons(user):
    from groups.models import GroupMembership, Score, Attendance
    children_data = []
    for ps in user.children.select_related('student').all():
        child = ps.student
        name  = f'{child.first_name} {child.last_name}'.strip() or child.username
        memberships = list(GroupMembership.objects.filter(student=child).select_related('group'))
        lessons_list = []
        for m in memberships:
            recent = list(m.group.lessons.order_by('-date')[:3])
            for lesson in recent:
                score_obj = Score.objects.filter(lesson=lesson, student=child).first()
                att_obj   = Attendance.objects.filter(lesson=lesson, student=child).first()
                score     = f'{score_obj.value}/5' if score_obj else '—'
                status    = '✅' if (att_obj and att_obj.present) else '❌'
                lessons_list.append({'lesson': lesson.title, 'score': score, 'status': status})
        children_data.append({'name': name, 'lessons': lessons_list[:3]})
    return children_data


def _teacher_groups(user):
    from groups.models import Group, GroupMembership, Score, Attendance
    from django.db.models import Sum
    groups = list(Group.objects.filter(teacher=user))
    rows = []
    for group in groups:
        lessons      = group.lessons.all()
        lesson_count = lessons.count()
        student_count = GroupMembership.objects.filter(group=group).count()
        if lesson_count == 0 or student_count == 0:
            rows.append({'name': group.name, 'count': student_count, 'score': 0, 'att': 0})
            continue
        total_score   = Score.objects.filter(lesson__in=lessons).aggregate(t=Sum('value'))['t'] or 0
        total_present = Attendance.objects.filter(lesson__in=lessons, present=True).count()
        max_score     = lesson_count * student_count * 5
        max_att       = lesson_count * student_count
        rows.append({
            'name':  group.name,
            'count': student_count,
            'score': round(total_score / max_score * 100),
            'att':   round(total_present / max_att * 100),
        })
    return rows


def _teacher_struggling(user):
    from groups.models import Group, GroupMembership, Score, Attendance
    from django.db.models import Sum
    groups = list(Group.objects.filter(teacher=user))
    struggling = []
    for group in groups:
        lessons      = group.lessons.all()
        lesson_count = lessons.count()
        if lesson_count == 0:
            continue
        for m in GroupMembership.objects.filter(group=group).select_related('student'):
            student   = m.student
            score_sum = Score.objects.filter(lesson__in=lessons, student=student).aggregate(t=Sum('value'))['t'] or 0
            present   = Attendance.objects.filter(lesson__in=lessons, student=student, present=True).count()
            score_pct = round(score_sum / (lesson_count * 5) * 100)
            att_pct   = round(present / lesson_count * 100)
            if score_pct < 50 or att_pct < 60:
                name = f'{student.first_name} {student.last_name}'.strip() or student.username
                struggling.append({'name': name, 'group': group.name, 'score': score_pct, 'att': att_pct})
    return struggling


def _teacher_group_list(user):
    from groups.models import Group
    return list(Group.objects.filter(teacher=user).values('id', 'name'))


def _group_students_with_tg(group_id):
    from groups.models import Group, GroupMembership
    group   = Group.objects.get(id=group_id)
    members = GroupMembership.objects.filter(
        group=group, student__telegram_id__isnull=False
    ).select_related('student')
    return [(m.student.telegram_id, m.student.telegram_lang or 'uz') for m in members], group.name


def _admin_stats():
    from users.models import User
    return {
        'teachers': User.objects.filter(role='teacher').count(),
        'students': User.objects.filter(role='student').count(),
    }


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
    elif user.role == 'teacher':
        text = m['welcome_teacher'].format(name=first_name)
    elif user.role == 'admin':
        text = m['welcome_admin'].format(name=first_name)
    elif user.role == 'parent':
        text = m['welcome_parent'].format(name=first_name)
    else:
        text = m['welcome_other'].format(name=first_name)
    await query.edit_message_text(text)
    if user:
        await _set_user_commands(query.get_bot(), telegram_id, user.role)


async def _set_user_commands(bot, telegram_id: int, role: str):
    from telegram import BotCommandScopeChat
    if role == 'student':
        commands = [
            BotCommand('mystats',  'Statistika / Статистика'),
            BotCommand('myrank',   'Reyting / Рейтинг'),
            BotCommand('homework', 'Uy vazifalari / Домашние задания'),
            BotCommand('help',     'Yordam / Помощь'),
        ]
    elif role == 'teacher':
        commands = [
            BotCommand('mygroups',   'Guruhlar / Группы'),
            BotCommand('struggling', "Qiynalayotganlar / Отстающие"),
            BotCommand('notify',     'Guruhga xabar / Сообщение группе'),
            BotCommand('help',       'Yordam / Помощь'),
        ]
    elif role == 'admin':
        commands = [
            BotCommand('academy', 'Akademiya / Академия'),
            BotCommand('help',    'Yordam / Помощь'),
        ]
    elif role == 'parent':
        commands = [
            BotCommand('mystats', 'Statistika / Статистика'),
            BotCommand('lessons', "So'nggi darslar / Последние уроки"),
            BotCommand('help',    'Yordam / Помощь'),
        ]
    else:
        commands = [BotCommand('help', 'Yordam / Помощь')]
    try:
        await bot.set_my_commands(commands, scope=BotCommandScopeChat(chat_id=telegram_id))
    except Exception as e:
        logger.warning('Could not set user commands for %s: %s', telegram_id, e)


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

    first_name = query.from_user.first_name or ''
    m = MSG[lang]
    if user.role == 'student':
        text = m['welcome_student'].format(name=first_name)
    elif user.role == 'teacher':
        text = m['welcome_teacher'].format(name=first_name)
    elif user.role == 'admin':
        text = m['welcome_admin'].format(name=first_name)
    elif user.role == 'parent':
        text = m['welcome_parent'].format(name=first_name)
    else:
        text = m['welcome_other'].format(name=first_name)

    await query.edit_message_text(text)
    await _set_user_commands(query.get_bot(), telegram_id, user.role)


# ── /mystats ───────────────────────────────────────────────────────────────────

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


# ── /myrank ────────────────────────────────────────────────────────────────────

async def myrank(update: Update, context: ContextTypes.DEFAULT_TYPE):
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

    rows = await sync_to_async(_student_rank)(user)
    if not rows:
        await update.message.reply_text(m['rank_no_data'])
        return

    text = m['rank_header']
    for r in rows:
        text += m['rank_item'].format(**r)
    await update.message.reply_text(text, parse_mode='Markdown')


# ── /homework ──────────────────────────────────────────────────────────────────

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


# ── /mygroups (teacher) ────────────────────────────────────────────────────────

async def mygroups(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return
    if user.role not in ('teacher', 'admin'):
        await update.message.reply_text(m['no_data'])
        return

    rows = await sync_to_async(_teacher_groups)(user)
    if not rows:
        await update.message.reply_text(m['groups_none'])
        return

    text = m['groups_header']
    for r in rows:
        text += m['groups_item'].format(**r)
    await update.message.reply_text(text, parse_mode='Markdown')


# ── /struggling (teacher) ──────────────────────────────────────────────────────

async def struggling(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return
    if user.role not in ('teacher', 'admin'):
        await update.message.reply_text(m['no_data'])
        return

    rows = await sync_to_async(_teacher_struggling)(user)
    if not rows:
        await update.message.reply_text(m['struggling_none'])
        return

    text = m['struggling_header']
    for r in rows:
        text += m['struggling_item'].format(**r)
    await update.message.reply_text(text, parse_mode='Markdown')


# ── /notify conversation (teacher) ────────────────────────────────────────────

async def notify_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user or user.role not in ('teacher', 'admin'):
        await update.message.reply_text(m['not_linked'])
        return ConversationHandler.END

    context.user_data['notify_lang'] = lang
    groups = await sync_to_async(_teacher_group_list)(user)
    if not groups:
        await update.message.reply_text(m['groups_none'])
        return ConversationHandler.END

    keyboard = [[InlineKeyboardButton(g['name'], callback_data=f'notifyg_{g["id"]}')] for g in groups]
    await update.message.reply_text(m['notify_choose'], reply_markup=InlineKeyboardMarkup(keyboard))
    return NOTIFY_CHOOSE


async def notify_group_chosen(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    group_id = int(query.data.split('_')[1])
    context.user_data['notify_group_id'] = group_id
    lang = context.user_data.get('notify_lang', 'uz')
    await query.edit_message_text(MSG[lang]['notify_type'])
    return NOTIFY_MSG


async def notify_send_msg(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message_text = update.message.text
    group_id     = context.user_data.get('notify_group_id')
    lang         = context.user_data.get('notify_lang', 'uz')
    m            = MSG[lang]

    students, group_name = await sync_to_async(_group_students_with_tg)(group_id)
    if not students:
        await update.message.reply_text(m['notify_no_tg'])
        return ConversationHandler.END

    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    bot       = Bot(token=bot_token)
    sender    = (
        f'@{update.effective_user.username}'
        if update.effective_user.username
        else update.effective_user.first_name
    )

    count = 0
    for tg_id, student_lang in students:
        try:
            msg_text = NOTIF_MSG.get(student_lang, NOTIF_MSG['uz'])['direct_message'].format(
                sender=sender, message=message_text
            )
            await bot.send_message(chat_id=tg_id, text=msg_text, parse_mode='Markdown')
            count += 1
        except Exception as e:
            logger.error('Notify send error to %s: %s', tg_id, e)

    await update.message.reply_text(m['notify_sent'].format(count=count))
    return ConversationHandler.END


async def notify_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    lang = context.user_data.get('notify_lang', 'uz')
    await update.message.reply_text(MSG[lang]['notify_cancel'])
    return ConversationHandler.END


# ── /lessons (parent) ─────────────────────────────────────────────────────────

async def lessons_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return
    if user.role != 'parent':
        await update.message.reply_text(m['no_data'])
        return

    children_data = await sync_to_async(_parent_recent_lessons)(user)
    if not children_data:
        await update.message.reply_text(m['no_data'])
        return

    text = m['lessons_header']
    for child in children_data:
        text += m['lessons_child'].format(name=child['name'])
        if child['lessons']:
            for l in child['lessons']:
                text += m['lessons_item'].format(**l)
        else:
            text += m['lessons_none']
    await update.message.reply_text(text, parse_mode='Markdown')


# ── /academy (admin) ──────────────────────────────────────────────────────────

async def academy_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return
    if user.role != 'admin':
        await update.message.reply_text(m['no_data'])
        return

    stats = await sync_to_async(_admin_stats)()
    await update.message.reply_text(m['academy_stats'].format(**stats), parse_mode='Markdown')


# ── /help ─────────────────────────────────────────────────────────────────────

async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        key = 'help_other'
    elif user.role == 'student':
        key = 'help_student'
    elif user.role == 'teacher':
        key = 'help_teacher'
    elif user.role == 'admin':
        key = 'help_admin'
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
        'score':                    "📊 *{lesson}* darsida *{score}/5* ball oldingiz ({group})",
        'absent':                   "⚠️ *{lesson}* darsida qatnashmagansiz ({group})",
        'score_parent':             "📊 *{name}*: *{lesson}* darsida *{score}/5* ball oldi ({group})",
        'absent_parent':            "⚠️ *{name}*: *{lesson}* darsida qatnashmadi ({group})",
        'student_present_scored':   "✅ *{lesson}* darsida qatnashdingiz.\n⭐ Balingiz: *{score}/5* | {group}",
        'student_present_unscored': "✅ *{lesson}* darsida qatnashdingiz. | {group}",
        'student_absent_scored':    "⚠️ *{lesson}* darsiga kelmadingiz.\n⭐ Balingiz: *{score}/5* | {group}",
        'student_absent_unscored':  "⚠️ *{lesson}* darsiga kelmadingiz. | {group}",
        'parent_present_scored':    "✅ *{name}* *{lesson}* darsida qatnashdi.\n⭐ Ball: *{score}/5* | {group}",
        'parent_present_unscored':  "✅ *{name}* *{lesson}* darsida qatnashdi. | {group}",
        'parent_absent_scored':     "⚠️ *{name}* *{lesson}* darsiga kelmadi.\n⭐ Ball: *{score}/5* | {group}",
        'parent_absent_unscored':   "⚠️ *{name}* *{lesson}* darsiga kelmadi. | {group}",
        'hw_notification':          "📝 *{lesson}* darsi uchun uy vazifasi ({group}):\n\n{homework}",
        'direct_message':           "📢 *{sender}* sizga xabar yubordi:\n\n{message}",
        'direct_message_parent':    "📢 *{sender}* ({student} haqida) xabar yubordi:\n\n{message}",
        'announcement':             "📌 *E'lon:* {title}\n\n{body}",
        'announcement_group':       "📌 *E'lon ({group}):* {title}\n\n{body}",
    },
    'ru': {
        'score':                    "📊 Вы получили *{score}/5* в уроке «{lesson}» ({group})",
        'absent':                   "⚠️ Вы отсутствовали на уроке «{lesson}» ({group})",
        'score_parent':             "📊 *{name}*: получил(а) *{score}/5* в уроке «{lesson}» ({group})",
        'absent_parent':            "⚠️ *{name}*: отсутствовал(а) на уроке «{lesson}» ({group})",
        'student_present_scored':   "✅ Вы посетили урок *{lesson}*.\n⭐ Ваша оценка: *{score}/5* | {group}",
        'student_present_unscored': "✅ Вы посетили урок *{lesson}*. | {group}",
        'student_absent_scored':    "⚠️ Вы пропустили урок *{lesson}*.\n⭐ Ваша оценка: *{score}/5* | {group}",
        'student_absent_unscored':  "⚠️ Вы пропустили урок *{lesson}*. | {group}",
        'parent_present_scored':    "✅ *{name}* посетил(а) урок *{lesson}*.\n⭐ Оценка: *{score}/5* | {group}",
        'parent_present_unscored':  "✅ *{name}* посетил(а) урок *{lesson}*. | {group}",
        'parent_absent_scored':     "⚠️ *{name}* пропустил(а) урок *{lesson}*.\n⭐ Оценка: *{score}/5* | {group}",
        'parent_absent_unscored':   "⚠️ *{name}* пропустил(а) урок *{lesson}*. | {group}",
        'hw_notification':          "📝 Домашнее задание по уроку *{lesson}* ({group}):\n\n{homework}",
        'direct_message':           "📢 *{sender}* отправил(а) вам сообщение:\n\n{message}",
        'direct_message_parent':    "📢 *{sender}* (о {student}) отправил(а) сообщение:\n\n{message}",
        'announcement':             "📌 *Объявление:* {title}\n\n{body}",
        'announcement_group':       "📌 *Объявление ({group}):* {title}\n\n{body}",
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

async def chatid_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    if chat.type == 'private':
        await update.message.reply_text(
            "Bu buyruq faqat guruhlarda ishlaydi.\n"
            "Botni guruhga qo'shing va o'sha guruhda /chatid yuboring."
        )
        return
    await update.message.reply_text(
        f"Bu guruhning Chat ID si:\n`{chat.id}`\n\n"
        "AcademyJournal Settings → Telegram guruhlar bo'limiga shu raqamni kiriting.",
        parse_mode='Markdown',
    )


async def dailyreport_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    if chat.type == 'private':
        await update.message.reply_text(
            "Bu buyruq faqat guruhlarda ishlaydi.\n"
            "Akademiya guruhiga qo'shing va o'sha yerda /dailyreport yuboring."
        )
        return

    from academies.models import AcademyTelegramGroup
    tg = AcademyTelegramGroup.objects.filter(chat_id=chat.id).select_related('academy').first()
    if not tg:
        await update.message.reply_text(
            "Bu guruh hech qaysi akademiyaga bog'lanmagan.\n"
            "AcademyJournal → Settings → Telegram guruhlar bo'limida shu guruhni qo'shing."
        )
        return

    try:
        from .management.commands.send_daily_report import run_report_for_academy
        run_report_for_academy(tg.academy)
        await update.message.reply_text("✅ Kunlik hisobot yuborildi.")
    except Exception as e:
        logger.error('dailyreport_cmd error: %s', e)
        await update.message.reply_text("❌ Hisobotni yuborishda xatolik yuz berdi.")


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

    # Notify conversation handler (must be registered before generic handlers)
    notify_handler = ConversationHandler(
        entry_points=[CommandHandler('notify', notify_start)],
        states={
            NOTIFY_CHOOSE: [CallbackQueryHandler(notify_group_chosen, pattern=r'^notifyg_\d+$')],
            NOTIFY_MSG:    [MessageHandler(filters.TEXT & ~filters.COMMAND, notify_send_msg)],
        },
        fallbacks=[CommandHandler('cancel', notify_cancel)],
    )

    app.add_handler(notify_handler)
    app.add_handler(CommandHandler('start',      start))
    app.add_handler(CommandHandler('mystats',    mystats))
    app.add_handler(CommandHandler('myrank',     myrank))
    app.add_handler(CommandHandler('homework',   homework_cmd))
    app.add_handler(CommandHandler('mygroups',   mygroups))
    app.add_handler(CommandHandler('struggling', struggling))
    app.add_handler(CommandHandler('lessons',    lessons_cmd))
    app.add_handler(CommandHandler('academy',    academy_cmd))
    app.add_handler(CommandHandler('help',       help_cmd))
    app.add_handler(CommandHandler('chatid',      chatid_cmd))
    app.add_handler(CommandHandler('dailyreport', dailyreport_cmd))
    app.add_handler(CallbackQueryHandler(language_callback, pattern=r'^lang_(uz|ru)$'))

    async_to_sync(app.initialize)()

    async def _set_commands():
        from telegram import BotCommandScopeAllGroupChats
        await app.bot.set_my_commands([
            BotCommand('mystats',    'Statistika / Статистика'),
            BotCommand('myrank',     'Reyting / Рейтинг'),
            BotCommand('homework',   'Uy vazifalari / Домашние задания'),
            BotCommand('mygroups',   'Guruhlar / Группы'),
            BotCommand('struggling', "Qiynalayotganlar / Отстающие"),
            BotCommand('notify',     'Guruhga xabar / Сообщение группе'),
            BotCommand('lessons',    "So'nggi darslar / Последние уроки"),
            BotCommand('academy',    'Akademiya / Академия'),
            BotCommand('help',       'Yordam / Помощь'),
        ])
        # Group-only commands
        await app.bot.set_my_commands([
            BotCommand('dailyreport', "Kunlik hisobot / Ежедневный отчёт"),
        ], scope=BotCommandScopeAllGroupChats())
    try:
        async_to_sync(_set_commands)()
    except Exception as e:
        logger.warning('Could not set bot commands: %s', e)

    _application = app
    return _application
