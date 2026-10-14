// Display helpers of the frontend; the forms shared with the validator are in
// api/format.ts. Dates stay 'YYYY-MM-DD' strings: no Date round trip.
import { formatMinutes } from '../../api/format';

export { formatDate, formatMinutes } from '../../api/format';

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
