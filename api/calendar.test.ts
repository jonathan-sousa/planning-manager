import { describe, expect, it } from 'vitest';
import {
  addDays,
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
});
