import {
  boolean,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  index,
  jsonb,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  ASSIGNMENT_SOURCES,
  DAY_KINDS,
  HOURS_REGIMES,
  NIGHT_MODES,
  PLANNING_STATUSES,
  REQUEST_KINDS,
  SHIFT_KINDS,
  EMAIL_EVENT_KINDS,
  SOLVE_MODES,
  SOLVE_STATUSES,
} from '../domain';

// Aurora DSQL: random UUID primary keys, timestamps in UTC, no SERIAL, no
// enum types (text columns typed through `enum`, values validated by the API).
const id = { id: uuid().primaryKey().defaultRandom() };
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date().toISOString()),
};
// Calendar dates as 'YYYY-MM-DD' strings, never JS Dates.
const day = (name: string) => date(name, { mode: 'string' });

export const grades = pgTable(
  'grades',
  {
    ...id,
    code: text().notNull(),
    label: text().notNull(),
    sortOrder: integer('sort_order').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('grades_code_idx').on(table.code)]
);

export const skills = pgTable(
  'skills',
  {
    ...id,
    code: text().notNull(),
    label: text().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('skills_code_idx').on(table.code)]
);

export const agents = pgTable('agents', {
  ...id,
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  gradeId: uuid('grade_id')
    .notNull()
    .references(() => grades.id, { onDelete: 'restrict' }),
  /** Percentage of a full-time position (100 = full time). */
  workTimeRatio: integer('work_time_ratio').notNull().default(100),
  nightMode: text('night_mode', { enum: NIGHT_MODES }).notNull(),
  hoursRegime: text('hours_regime', { enum: HOURS_REGIMES }).notNull(),
  active: boolean().notNull().default(true),
  startDate: day('start_date').notNull(),
  endDate: day('end_date'),
  ...timestamps,
});

export const agentSkills = pgTable(
  'agent_skills',
  {
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'restrict' }),
  },
  (table) => [primaryKey({ columns: [table.agentId, table.skillId] })]
);

/** Grid codes: work shifts, but also absences and rest days. */
export const shiftTypes = pgTable(
  'shift_types',
  {
    ...id,
    code: text().notNull(),
    label: text().notNull(),
    kind: text({ enum: SHIFT_KINDS }).notNull(),
    /** 'HH:mm', Paris time; set for WORK shifts only. */
    startTime: text('start_time'),
    endTime: text('end_time'),
    breakMinutes: integer('break_minutes').notNull().default(0),
    /** Minutes credited to the agent's balance for one occurrence. */
    countedMinutes: integer('counted_minutes').notNull(),
    isNight: boolean('is_night').notNull().default(false),
    /** '#rrggbb' */
    color: text().notNull(),
    archived: boolean().notNull().default(false),
    ...timestamps,
  },
  // Archiving frees the code: a new shift type can take it over.
  (table) => [
    uniqueIndex('shift_types_active_code_idx')
      .on(table.code)
      .where(sql`not ${table.archived}`),
  ]
);

export const coverageNeeds = pgTable(
  'coverage_needs',
  {
    ...id,
    shiftTypeId: uuid('shift_type_id')
      .notNull()
      .references(() => shiftTypes.id, { onDelete: 'restrict' }),
    gradeId: uuid('grade_id')
      .notNull()
      .references(() => grades.id, { onDelete: 'restrict' }),
    skillId: uuid('skill_id').references(() => skills.id, { onDelete: 'restrict' }),
    dayKind: text('day_kind', { enum: DAY_KINDS }).notNull(),
    minCount: integer('min_count').notNull(),
    targetCount: integer('target_count'),
    ...timestamps,
  },
  (table) => [
    unique('coverage_needs_slot_key')
      .on(table.shiftTypeId, table.gradeId, table.skillId, table.dayKind)
      .nullsNotDistinct(),
  ]
);

export const coverageOverrides = pgTable(
  'coverage_overrides',
  {
    ...id,
    date: day('date').notNull(),
    shiftTypeId: uuid('shift_type_id')
      .notNull()
      .references(() => shiftTypes.id, { onDelete: 'restrict' }),
    gradeId: uuid('grade_id')
      .notNull()
      .references(() => grades.id, { onDelete: 'restrict' }),
    skillId: uuid('skill_id').references(() => skills.id, { onDelete: 'restrict' }),
    minCount: integer('min_count').notNull(),
    ...timestamps,
  },
  (table) => [
    unique('coverage_overrides_slot_key')
      .on(table.date, table.shiftTypeId, table.gradeId, table.skillId)
      .nullsNotDistinct(),
  ]
);

export const agentRequests = pgTable('agent_requests', {
  ...id,
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  startDate: day('start_date').notNull(),
  endDate: day('end_date').notNull(),
  kind: text({ enum: REQUEST_KINDS }).notNull(),
  shiftTypeId: uuid('shift_type_id').references(() => shiftTypes.id, { onDelete: 'restrict' }),
  comment: text(),
  ...timestamps,
});

/** One per month ('YYYY-MM'); `version` guards concurrent edits of its cells. */
export const plannings = pgTable('plannings', {
  month: text().primaryKey(),
  status: text({ enum: PLANNING_STATUSES }).notNull().default('DRAFT'),
  version: integer().notNull().default(0),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
  notes: text(),
  ...timestamps,
});

/** One cell of the grid: what an agent does on a day (a night belongs to its start day). */
export const assignments = pgTable(
  'assignments',
  {
    ...id,
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'restrict' }),
    date: day('date').notNull(),
    month: text()
      .notNull()
      .references(() => plannings.month, { onDelete: 'restrict' }),
    shiftTypeId: uuid('shift_type_id')
      .notNull()
      .references(() => shiftTypes.id, { onDelete: 'restrict' }),
    /** Minutes credited, fixed when the cell is set (daylight saving time included). */
    countedMinutes: integer('counted_minutes').notNull(),
    locked: boolean().notNull().default(false),
    source: text({ enum: ASSIGNMENT_SOURCES }).notNull(),
    comment: text(),
    /** Cognito username of the last writer. */
    updatedBy: text('updated_by').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('assignments_agent_date_idx').on(table.agentId, table.date),
    index('assignments_date_idx').on(table.date),
  ]
);

/** A hard violation the manager keeps, with a justification (required to validate the month). */
export const acceptedViolations = pgTable(
  'accepted_violations',
  {
    ...id,
    month: text()
      .notNull()
      .references(() => plannings.month, { onDelete: 'restrict' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'restrict' }),
    date: day('date').notNull(),
    rule: text().notNull(),
    comment: text().notNull(),
    acceptedBy: text('accepted_by').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('accepted_violations_key_idx').on(table.agentId, table.date, table.rule)]
);

/** Proposed cells of a solve run: the cells to change, `shiftTypeId: null` empties one. */
export interface SolveResult {
  cells: { agentId: string; date: string; shiftTypeId: string | null }[];
  /** Solver statistics (status, objective terms, wall time…). */
  stats: Record<string, number | string>;
}

/** One run of the solver on a month: options, then the proposal (diff) or the error. */
export const solveRuns = pgTable(
  'solve_runs',
  {
    ...id,
    month: text()
      .notNull()
      .references(() => plannings.month, { onDelete: 'restrict' }),
    mode: text({ enum: SOLVE_MODES }).notNull(),
    status: text({ enum: SOLVE_STATUSES }).notNull().default('PENDING'),
    /** Planning version the proposal is based on: applying it requires the same. */
    planningVersion: integer('planning_version').notNull(),
    result: jsonb().$type<SolveResult>(),
    error: text(),
    createdBy: text('created_by').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
    ...timestamps,
  },
  (table) => [index('solve_runs_month_idx').on(table.month)]
);

/**
 * Single row (id 'default', inserted by the migration). Defaults follow the
 * FPH rules (décret 2002-9); durations in minutes.
 */
export const ruleSettings = pgTable('rule_settings', {
  id: text().primaryKey().default('default'),
  minDailyRestMinutes: integer('min_daily_rest_minutes').notNull().default(720),
  maxShiftAmplitudeMinutes: integer('max_shift_amplitude_minutes').notNull().default(720),
  breakThresholdMinutes: integer('break_threshold_minutes').notNull().default(360),
  minBreakMinutes: integer('min_break_minutes').notNull().default(20),
  maxWeeklyMinutes: integer('max_weekly_minutes').notNull().default(2880),
  minWeeklyRestMinutes: integer('min_weekly_rest_minutes').notNull().default(2160),
  fortnightMinRestDays: integer('fortnight_min_rest_days').notNull().default(4),
  /** Monday that starts the fixed two-week periods. */
  fortnightAnchorDate: day('fortnight_anchor_date').notNull().default('2026-01-05'),
  maxConsecutiveWorkDays: integer('max_consecutive_work_days').notNull().default(5),
  /** A rest day also requires no night shift starting the day before. */
  restDayExcludesPreviousNight: boolean('rest_day_excludes_previous_night').notNull().default(true),
  monthlyHoursToleranceMinutes: integer('monthly_hours_tolerance_minutes').notNull().default(720),
  // Soft constraint weights (coverage is optimised first, lexicographically).
  hoursDeviationWeight: integer('hours_deviation_weight').notNull().default(10),
  wishWeight: integer('wish_weight').notNull().default(5),
  weekendFairnessWeight: integer('weekend_fairness_weight').notNull().default(3),
  nightFairnessWeight: integer('night_fairness_weight').notNull().default(3),
  holidayFairnessWeight: integer('holiday_fairness_weight').notNull().default(3),
  isolatedRestDayWeight: integer('isolated_rest_day_weight').notNull().default(2),
  stabilityWeight: integer('stability_weight').notNull().default(1),
  updatedAt: timestamps.updatedAt,
});

/** Bounces and complaints of the emails Cognito sends through SES (api/email-events.ts). */
export const emailEvents = pgTable(
  'email_events',
  {
    ...id,
    /** Recipient, lowercase. */
    email: text().notNull(),
    kind: text({ enum: EMAIL_EVENT_KINDS }).notNull(),
    /** SES bounce type and subtype, or complaint feedback type. */
    detail: text(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'string' }).notNull(),
    ...timestamps,
  },
  (table) => [index('email_events_email_idx').on(table.email)]
);
