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

export const PLANNING_STATUSES = ['DRAFT', 'VALIDATED', 'PUBLISHED'] as const;
export type PlanningStatus = (typeof PLANNING_STATUSES)[number];

export const ASSIGNMENT_SOURCES = ['MANUAL', 'SOLVER', 'REQUEST'] as const;
export type AssignmentSource = (typeof ASSIGNMENT_SOURCES)[number];

/** Planning rules and their severity (api/rules/ applies them). */
export const RULES = {
  APPROVED_ABSENCE: 'HARD',
  DAILY_REST: 'HARD',
  SHIFT_AMPLITUDE: 'HARD',
  SHIFT_BREAK: 'HARD',
  WEEKLY_HOURS: 'HARD',
  WEEKLY_REST: 'HARD',
  FORTNIGHT_REST: 'HARD',
  CONSECUTIVE_DAYS: 'HARD',
  NIGHT_MODE: 'HARD',
  COVERAGE: 'SOFT',
  MONTHLY_HOURS: 'SOFT',
  WISH: 'SOFT',
  ISOLATED_REST: 'SOFT',
} as const;

export type RuleCode = keyof typeof RULES;
export const HARD_RULES = (Object.keys(RULES) as RuleCode[]).filter(
  (rule) => RULES[rule] === 'HARD'
);
