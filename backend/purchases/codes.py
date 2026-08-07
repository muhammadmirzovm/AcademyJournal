import random

# Excludes visually confusable characters: O/0, I/1, S/5, B/8, Z/2 — an
# admin typing a code in by hand should never have to guess which one it was.
ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY34679'
CODE_LENGTH = 6


def generate_unique_code():
    from .models import Purchase
    while True:
        code = ''.join(random.choice(ALPHABET) for _ in range(CODE_LENGTH))
        if not Purchase.objects.filter(code=code).exists():
            return code
