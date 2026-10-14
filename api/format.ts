// Text forms of dates and durations, in French: validator messages and the
// frontend share them. Dates stay 'YYYY-MM-DD' strings: no Date round trip.

/** '2026-03-02' → '02/03/2026' */
export const formatDate = (date: string): string => date.split('-').reverse().join('/');

/** '2026-03-02' → '02/03' */
export const formatDayMonth = (date: string): string => formatDate(date).slice(0, 5);

/** 690 → '11h30', 720 → '12h' */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}
