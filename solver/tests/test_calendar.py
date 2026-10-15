import json
from pathlib import Path

from solver.calendar import (
    add_days,
    day_kind,
    day_of_week,
    is_public_holiday,
    month_dates,
    nominal_minutes,
    paris_minute,
    public_holidays,
    shift_interval,
)


def length(day, start, end):
    begin, finish = shift_interval(day, start, end)
    return finish - begin


def test_walks_dates_and_months():
    assert add_days("2026-12-31", 1) == "2027-01-01"
    assert add_days("2028-03-01", -1) == "2028-02-29"
    assert len(month_dates("2026-02")) == 28
    assert day_of_week("2026-11-01") == 0


def test_french_public_holidays():
    holidays = public_holidays(2026)
    assert len(holidays) == 11
    assert {"2026-04-06", "2026-05-14", "2026-05-25"} <= holidays


def test_day_kinds():
    assert day_kind("2026-10-14") == "WEEKDAY"
    assert day_kind("2026-10-17") == "SATURDAY"
    assert day_kind("2026-10-18") == "SUNDAY_HOLIDAY"
    assert day_kind("2026-11-11") == "SUNDAY_HOLIDAY"


def test_shift_lengths_follow_daylight_saving_time():
    assert length("2026-10-14", "07:00", "19:00") == 720
    assert length("2026-10-14", "19:00", "07:00") == 720
    assert length("2026-03-28", "19:00", "07:00") == 660
    assert length("2026-10-24", "19:00", "07:00") == 780
    assert length("2026-10-14", "14:00", "00:00") == 600
    assert nominal_minutes("19:00", "07:00") == 720


def test_matches_the_validator_calendar():
    """fixtures/calendar.json is also checked by shared/calendar.test.ts."""
    shared = json.loads(
        (Path(__file__).parents[2] / "fixtures" / "calendar.json").read_text()
    )
    for case in shared["parisMinutes"]:
        assert paris_minute(case["date"], case["time"]) == case["minute"], case
    holidays = []
    day = "2026-01-01"
    while day < "2029-01-01":
        if is_public_holiday(day):
            holidays.append(day)
        day = add_days(day, 1)
    assert holidays == shared["publicHolidays"]
