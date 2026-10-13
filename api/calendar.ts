// Calendar arithmetic on 'YYYY-MM-DD' / 'HH:mm' strings, in Paris time.
// The only place where a Date is used: at UTC midnight for calendar days,
// and through Intl for the Paris offset (daylight saving time).
import type { DayKind } from './domain';

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (date: string, days: number): string => fromUtc(toUtc(date) + days * DAY_MS);

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((toUtc(to) - toUtc(from)) / DAY_MS);

/** 0 = Sunday … 6 = Saturday. */
export const dayOfWeek = (date: string): number => new Date(toUtc(date)).getUTCDay();

/** 'YYYY-MM' of a date. */
export const monthOf = (date: string): string => date.slice(0, 7);

/** 'YYYY-MM' shifted by a number of months. */
export function addMonths(month: string, months: number): string {
  return fromUtc(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + months, 1)
  ).slice(0, 7);
}

const monthFormat = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const weekdayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow', timeZone: 'UTC' });

/** 'novembre 2026' */
export const monthLabel = (month: string): string => monthFormat.format(toUtc(`${month}-01`));

/** 'L', 'M', 'M', 'J', 'V', 'S', 'D' */
export const weekdayLetter = (date: string): string => weekdayFormat.format(toUtc(date));

/** Current month in Paris. */
export const currentMonth = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' })
    .format(new Date())
    .slice(0, 7);

/** Every date of a 'YYYY-MM' month. */
export function monthDates(month: string): string[] {
  const dates: string[] = [];
  for (let date = `${month}-01`; monthOf(date) === month; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

/** Easter Sunday (anonymous Gregorian algorithm). */
function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** French public holidays of a year (mainland France). */
export function publicHolidays(year: number): Set<string> {
  const easterSunday = easter(year);
  return new Set([
    `${year}-01-01`,
    addDays(easterSunday, 1), // lundi de Pâques
    `${year}-05-01`,
    `${year}-05-08`,
    addDays(easterSunday, 39), // Ascension
    addDays(easterSunday, 50), // lundi de Pentecôte
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ]);
}

export const isPublicHoliday = (date: string): boolean =>
  publicHolidays(Number(date.slice(0, 4))).has(date);

/** Kind of day used by the coverage needs. */
export function dayKind(date: string): DayKind {
  const weekday = dayOfWeek(date);
  if (weekday === 0 || isPublicHoliday(date)) return 'SUNDAY_HOLIDAY';
  return weekday === 6 ? 'SATURDAY' : 'WEEKDAY';
}

const parisOffset = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Paris',
  timeZoneName: 'longOffset',
});

/** Offset of Paris from UTC at an instant, in minutes ('GMT+02:00' → 120). */
function parisOffsetMinutes(ms: number): number {
  const name = parisOffset.formatToParts(ms).find((part) => part.type === 'timeZoneName')!.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
}

/** Absolute minute (since the Unix epoch) of a Paris wall-clock time. */
export function parisMinute(date: string, time: string): number {
  const wall = toUtc(date) + (Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))) * 60_000;
  // The offset depends on the instant; one correction settles it (DST gaps
  // and overlaps resolve to the earlier offset).
  const first = wall - parisOffsetMinutes(wall) * 60_000;
  return (wall - parisOffsetMinutes(first) * 60_000) / 60_000;
}

/**
 * Absolute interval of a shift starting on `date`, in epoch minutes. A shift
 * whose end is not after its start ends the next day; the length follows
 * daylight saving time (a 19:00–07:00 night lasts 11 h or 13 h on change nights).
 */
export function shiftInterval(
  date: string,
  startTime: string,
  endTime: string
): { start: number; end: number } {
  const endDate = endTime > startTime ? date : addDays(date, 1);
  return { start: parisMinute(date, startTime), end: parisMinute(endDate, endTime) };
}

/** Wall-clock length of a shift, ignoring daylight saving time. */
export function nominalMinutes(startTime: string, endTime: string): number {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const span = minutes(endTime) - minutes(startTime);
  return span > 0 ? span : span + 24 * 60;
}
