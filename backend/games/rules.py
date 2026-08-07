"""Pure coin-math helpers for the games app — kept free of ORM writes so
they're trivial to unit test and to reuse from both the start/close views."""


def is_big_day(date, setting):
    return str(date.weekday()) in setting.big_days.split(',')


def build_applied_rules(setting, big, individual):
    suffix = 'big' if big else 'normal'
    if individual:
        return {'individual': getattr(setting, f'individual_{suffix}'), 'big': big}
    return {
        'p1':         getattr(setting, f'place_1_{suffix}'),
        'p2':         getattr(setting, f'place_2_{suffix}'),
        'p3':         getattr(setting, f'place_3_{suffix}'),
        'effort_min': getattr(setting, f'effort_min_{suffix}'),
        'effort_max': getattr(setting, f'effort_max_{suffix}'),
        'big':        big,
    }


def coins_for_place(rules, place):
    return {1: rules.get('p1', 0), 2: rules.get('p2', 0), 3: rules.get('p3', 0)}.get(place, 0)


def coins_for_effort(rules, effort):
    # effort: 0=None, 1=OK, 2=Good (matches GameResult.Effort)
    if effort >= 2:
        return rules.get('effort_max', 0)
    if effort == 1:
        return rules.get('effort_min', 0)
    return 0


def preview_total(rules, individual, attended_count):
    if individual:
        return rules['individual'] if attended_count > 0 else 0
    if attended_count == 0:
        return 0
    placed = min(attended_count, 3)
    total = sum(coins_for_place(rules, p) for p in range(1, placed + 1))
    rest = max(attended_count - 3, 0)
    total += rest * rules.get('effort_min', 0)
    return total
