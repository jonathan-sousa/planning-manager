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

export const SOLVE_MODES = ['COMPLETE', 'REOPTIMIZE'] as const;
export type SolveMode = (typeof SOLVE_MODES)[number];

/** Cognito groups: every user is a manager; admins also manage accounts and rules. */
export const MANAGER_GROUP = 'MANAGERS';
export const ADMIN_GROUP = 'ADMINS';

export const SOLVE_STATUSES = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'APPLIED'] as const;
export type SolveStatus = (typeof SOLVE_STATUSES)[number];
/** A run in these statuses may still produce a proposal. */
export const UNFINISHED_SOLVE_STATUSES = [
  'PENDING',
  'RUNNING',
] as const satisfies readonly SolveStatus[];

/** SES events recorded for the accounts page: the last one of an email tells whether it is reachable. */
export const EMAIL_EVENT_KINDS = ['DELIVERY', 'BOUNCE', 'COMPLAINT'] as const;
export type EmailEventKind = (typeof EMAIL_EVENT_KINDS)[number];

/** Planning rules and their severity (shared/rules/ applies them). */
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
