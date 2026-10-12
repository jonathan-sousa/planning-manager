// Enumerations of the domain model, shared by the database schema, the API
// input schemas and the frontend. No runtime dependency: safe to bundle.

export const NIGHT_MODES = ['DAY_ONLY', 'NIGHT_ONLY', 'MIXED'] as const;
export type NightMode = (typeof NIGHT_MODES)[number];

export const HOURS_REGIMES = [
  'STANDARD_1607',
  'VARIABLE_REST_1582',
  'NIGHT_1476',
  'MIXED_PRORATA',
] as const;
export type HoursRegime = (typeof HOURS_REGIMES)[number];

export const SHIFT_KINDS = ['WORK', 'ABSENCE', 'REST'] as const;
export type ShiftKind = (typeof SHIFT_KINDS)[number];

export const DAY_KINDS = ['WEEKDAY', 'SATURDAY', 'SUNDAY_HOLIDAY'] as const;
export type DayKind = (typeof DAY_KINDS)[number];

export const REQUEST_KINDS = ['ABSENCE_APPROVED', 'WISH_OFF', 'WISH_SHIFT'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
