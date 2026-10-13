// Display helpers. Dates stay 'YYYY-MM-DD' strings: no Date round trip.

/** '2026-03-02' → '02/03/2026' */
export const formatDate = (date: string): string => date.split('-').reverse().join('/');

/** 690 → '11h30', 720 → '12h' */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}

/** 'h:mm' or 'h', signed for a balance ('-7:30') → minutes; NaN when malformed. */
export function parseDuration(text: string): number {
  const match = /^([-+]?)(\d{1,3})(?::([0-5]\d))?$/.exec(text.trim());
  if (!match) return Number.NaN;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '-' ? -minutes : minutes;
}

/** 690 → '11:30', -450 → '-7:30' (editable form of a duration). */
export const durationText = (minutes: number): string => {
  if (Number.isNaN(minutes)) return '';
  const size = Math.abs(minutes);
  return `${minutes < 0 ? '-' : ''}${Math.floor(size / 60)}:${String(size % 60).padStart(2, '0')}`;
};

/** A balance: 750 → '+12h30', -420 → '-7h', 0 → '0h'. */
export const formatBalance = (minutes: number): string =>
  `${minutes > 0 ? '+' : minutes < 0 ? '-' : ''}${formatMinutes(Math.abs(minutes))}`;

/** Minutes between two 'HH:mm' times of the same shift, crossing midnight if needed. */
export function shiftMinutes(start: string, end: string): number {
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const span = toMinutes(end) - toMinutes(start);
  return span > 0 ? span : span + 24 * 60;
}
