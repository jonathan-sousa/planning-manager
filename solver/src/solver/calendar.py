"""Calendar arithmetic on 'YYYY-MM-DD' / 'HH:mm' strings, in Paris time.

Mirror of shared/calendar.ts: the same holidays, day kinds and daylight-saving
rules, so the solver and the TypeScript validator agree on every duration.
"""

from datetime import UTC, date, datetime, timedelta
from functools import cache
from zoneinfo import ZoneInfo

PARIS = ZoneInfo("Europe/Paris")


def add_days(day: str, days: int) -> str:
    return (date.fromisoformat(day) + timedelta(days=days)).isoformat()


def days_between(start: str, end: str) -> int:
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


def day_of_week(day: str) -> int:
    """0 = Sunday … 6 = Saturday, as in JavaScript."""
    return (date.fromisoformat(day).weekday() + 1) % 7


def month_dates(month: str) -> list[str]:
    first = date.fromisoformat(f"{month}-01")
    dates = []
    current = first
    while current.month == first.month:
        dates.append(current.isoformat())
        current += timedelta(days=1)
    return dates


def _easter(year: int) -> date:
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


@cache
def public_holidays(year: int) -> frozenset[str]:
    """French public holidays (mainland France)."""
    easter = _easter(year)
    movable = [easter + timedelta(days=n) for n in (1, 39, 50)]
    fixed = [(1, 1), (5, 1), (5, 8), (7, 14), (8, 15), (11, 1), (11, 11), (12, 25)]
    return frozenset(
        [date(year, m, d).isoformat() for m, d in fixed]
        + [d.isoformat() for d in movable]
    )


def is_public_holiday(day: str) -> bool:
    return day in public_holidays(int(day[:4]))


def day_kind(day: str) -> str:
    weekday = day_of_week(day)
    if weekday == 0 or is_public_holiday(day):
        return "SUNDAY_HOLIDAY"
    return "SATURDAY" if weekday == 6 else "WEEKDAY"


def paris_minute(day: str, time: str) -> int:
    """Absolute minute (since the Unix epoch) of a Paris wall-clock time."""
    local = datetime.fromisoformat(f"{day}T{time}").replace(tzinfo=PARIS)
    return int(local.astimezone(UTC).timestamp()) // 60


def shift_interval(day: str, start: str, end: str) -> tuple[int, int]:
    """Absolute interval of a shift starting on `day`; it ends the next day
    when its end is not after its start."""
    end_day = day if end > start else add_days(day, 1)
    return paris_minute(day, start), paris_minute(end_day, end)


def nominal_minutes(start: str, end: str) -> int:
    def minutes(time: str) -> int:
        return int(time[:2]) * 60 + int(time[3:5])

    span = minutes(end) - minutes(start)
    return span if span > 0 else span + 24 * 60


def counted_on(day: str, shift: dict) -> int:
    """Minutes credited for a shift on a date: a work shift follows DST."""
    if shift["kind"] != "WORK" or not shift["startTime"]:
        return shift["countedMinutes"]
    start, end = shift_interval(day, shift["startTime"], shift["endTime"])
    return shift["countedMinutes"] + (
        end - start - nominal_minutes(shift["startTime"], shift["endTime"])
    )


def fortnight_start(day: str, anchor: str) -> str:
    """First day of the fixed two-week period holding `day`."""
    return add_days(anchor, (days_between(anchor, day) // 14) * 14)
