import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  countedOn,
  fortnightStart,
  isPublicHoliday,
  parisMinute,
  monthLabel,
  weekdayLetter,
  dayKind,
  monthDates,
  nominalMinutes,
  publicHolidays,
  shiftInterval,
} from './calendar';

const length = (date: string, start: string, end: string) => {
  const interval = shiftInterval(date, start, end);
  return interval.end - interval.start;
};

describe('calendar', () => {
  it('walks dates and months', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(monthDates('2026-02')).toHaveLength(28);
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthLabel('2026-11')).toBe('novembre 2026');
    expect(weekdayLetter('2026-11-02')).toBe('L');
  });

  it('knows the French public holidays, Easter-based ones included', () => {
    const holidays = publicHolidays(2026);
    expect(holidays.size).toBe(11);
    // Easter 2026: April 5.
    for (const date of ['2026-04-06', '2026-05-14', '2026-05-25']) {
      expect(holidays.has(date)).toBe(true);
    }
  });

  it('classifies days for coverage needs', () => {
    expect(dayKind('2026-10-14')).toBe('WEEKDAY');
    expect(dayKind('2026-10-17')).toBe('SATURDAY');
    expect(dayKind('2026-10-18')).toBe('SUNDAY_HOLIDAY');
    expect(dayKind('2026-11-11')).toBe('SUNDAY_HOLIDAY');
  });

  it('measures shifts in Paris time, daylight saving time included', () => {
    expect(length('2026-10-14', '07:00', '19:00')).toBe(720);
    expect(length('2026-10-14', '19:00', '07:00')).toBe(720);
    expect(length('2026-03-28', '19:00', '07:00')).toBe(660); // clocks go forward
    expect(length('2026-10-24', '19:00', '07:00')).toBe(780); // clocks go back
    expect(length('2026-10-14', '14:00', '00:00')).toBe(600);
    expect(nominalMinutes('19:00', '07:00')).toBe(720);
  });

  it('credits night shifts their real length on daylight saving nights', () => {
    const night = {
      kind: 'WORK',
      startTime: '19:00',
      endTime: '07:00',
      countedMinutes: 720,
    };
    expect(countedOn('2026-10-14', night)).toBe(720);
    expect(countedOn('2026-10-24', night)).toBe(780);
    expect(countedOn('2026-03-28', night)).toBe(660);
    expect(countedOn('2026-03-28', { ...night, kind: 'ABSENCE' })).toBe(720);
  });

  it('finds the fixed fortnight of a date from its anchor Monday', () => {
    expect(fortnightStart('2026-01-05', '2026-01-05')).toBe('2026-01-05');
    expect(fortnightStart('2026-01-18', '2026-01-05')).toBe('2026-01-05');
    expect(fortnightStart('2026-01-19', '2026-01-05')).toBe('2026-01-19');
    // Before the anchor too.
    expect(fortnightStart('2026-01-04', '2026-01-05')).toBe('2025-12-22');
  });

  it('matches the solver calendar (fixtures/calendar.json)', () => {
    const shared = JSON.parse(readFileSync('fixtures/calendar.json', 'utf8')) as {
      parisMinutes: { date: string; time: string; minute: number }[];
      publicHolidays: string[];
    };
    for (const { date, time, minute } of shared.parisMinutes) {
      expect(parisMinute(date, time), `${date} ${time}`).toBe(minute);
    }
    const holidays = [];
    for (let date = '2026-01-01'; date < '2029-01-01'; date = addDays(date, 1)) {
      if (isPublicHoliday(date)) holidays.push(date);
    }
    expect(holidays).toEqual(shared.publicHolidays);
  });
});
