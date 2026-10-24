"""A small, shared rich-text vocabulary for homework and Telegram delivery."""
from html import escape, unescape
from html.parser import HTMLParser

import bleach

TAGS = {'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code', 'ul', 'ol', 'li'}
MARKS = {'strong': 'b', 'b': 'b', 'em': 'i', 'i': 'i', 'u': 'u', 's': 's', 'strike': 's', 'code': 'code'}


class RichTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.segments = []
        self.marks = []
        self.lists = []
        self.item_start = False

    def text(self, value):
        if value:
            marks = ('code',) if 'code' in self.marks else tuple(dict.fromkeys(self.marks))
            self.segments.append((value, marks))

    def newline(self):
        if self.segments and not self.segments[-1][0].endswith('\n'):
            self.text('\n')

    def handle_starttag(self, tag, attrs):
        if tag in MARKS:
            self.marks.append(MARKS[tag])
        elif tag == 'br':
            self.text('\n')
        elif tag in ('ul', 'ol'):
            self.newline()
            start = dict(attrs).get('start', '1')
            self.lists.append([tag, int(start) if str(start).isdigit() and len(str(start)) < 6 else 1])
        elif tag == 'li':
            self.newline()
            current = self.lists[-1] if self.lists else ['ul', 1]
            prefix = f'{current[1]}. ' if current[0] == 'ol' else '• '
            self.text('  ' * max(0, len(self.lists) - 1) + prefix)
            current[1] += 1
            self.item_start = True
        elif tag == 'p':
            if not self.item_start:
                self.newline()
            self.item_start = False

    def handle_endtag(self, tag):
        if tag in MARKS:
            mark = MARKS[tag]
            if mark in self.marks:
                self.marks.pop(len(self.marks) - 1 - self.marks[::-1].index(mark))
        elif tag == 'p':
            self.text('\n')
            self.item_start = False
        elif tag == 'li':
            self.newline()
            self.item_start = False
        elif tag in ('ul', 'ol'):
            self.newline()
            if self.lists:
                self.lists.pop()

    def handle_data(self, value):
        self.text(value)
        if value.strip():
            self.item_start = False


def segments(value):
    parser = RichTextParser()
    parser.feed(value)
    parser.close()
    return parser.segments


def sanitize_homework(value):
    cleaned = bleach.clean(value, tags=TAGS, attributes={'ol': ['start']}, strip=True)
    if not unescape(bleach.clean(cleaned, tags=set(), strip=True)).strip():
        return ''
    return cleaned.strip()


def homework_plain(value, format='plain'):
    if format != 'html':
        return value
    return ''.join(text for text, _ in segments(sanitize_homework(value))).strip()


def homework_telegram(value, format='plain'):
    if format != 'html':
        return escape(value, quote=False)
    parts = []
    active = ()
    for text, marks in segments(sanitize_homework(value)):
        if marks != active:
            parts.extend(f'</{mark}>' for mark in reversed(active))
            parts.extend(f'<{mark}>' for mark in marks)
            active = marks
        parts.append(escape(text, quote=False))
    parts.extend(f'</{mark}>' for mark in reversed(active))
    return ''.join(parts).strip()


def telegram_html_chunks(value, limit=3500):
    """Close/reopen marks across chunks; never cut an entity or a Unicode character.

    Count UTF-16 units conservatively for emoji, staying below Telegram's limit.
    """
    parts, active, units = [], (), 0
    for text, marks in segments(value):
        for char in text:
            width = 2 if ord(char) > 0xFFFF else 1
            if units + width > limit:
                yield ''.join(parts) + ''.join(f'</{mark}>' for mark in reversed(active))
                parts = [f'<{mark}>' for mark in active]
                units = 0
            if marks != active:
                parts.extend(f'</{mark}>' for mark in reversed(active))
                parts.extend(f'<{mark}>' for mark in marks)
                active = marks
            parts.append(escape(char, quote=False))
            units += width
    if units:
        yield ''.join(parts) + ''.join(f'</{mark}>' for mark in reversed(active))


async def send_html_message(bot, chat_id, text):
    for chunk in telegram_html_chunks(text):
        await bot.send_message(chat_id=chat_id, text=chunk, parse_mode='HTML')
