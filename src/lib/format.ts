// Display helpers. Dates stay 'YYYY-MM-DD' strings: no Date round trip.

/** '2026-03-02' → '02/03/2026' */
export const formatDate = (date: string): string => date.split('-').reverse().join('/');

/** 690 → '11h30', 720 → '12h' */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}

/** 'h:mm' or 'h' → minutes; NaN when malformed. */
export function parseDuration(text: string): number {
  const match = /^(\d{1,3})(?::([0-5]\d))?$/.exec(text.trim());
  return match ? Number(match[1]) * 60 + Number(match[2] ?? 0) : Number.NaN;
}

/** 690 → '11:30' (editable form of a duration). */
export const durationText = (minutes: number): string =>
  Number.isNaN(minutes)
    ? ''
    : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

/** Minutes between two 'HH:mm' times of the same shift, crossing midnight if needed. */
export function shiftMinutes(start: string, end: string): number {
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const span = toMinutes(end) - toMinutes(start);
  return span > 0 ? span : span + 24 * 60;
}
