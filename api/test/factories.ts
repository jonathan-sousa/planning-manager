// Rows of a small fictional service, written straight to the test database.
import { db } from './db';
import {
  acceptedViolations,
  agentRequests,
  agents,
  assignments,
  grades,
  monthBalances,
  plannings,
  shiftTypes,
  solveRuns,
} from '../db/schema';

type Insert<T extends { $inferInsert: unknown }> = Partial<T['$inferInsert']>;

export async function grade(fields: Insert<typeof grades> = {}) {
  const [row] = await db
    .insert(grades)
    .values({ code: 'IDE', label: 'Infirmier', sortOrder: 0, ...fields })
    .returning();
  return row!;
}

/** An agent, of the first grade when none is given (created if needed). */
export async function agent(fields: Insert<typeof agents> = {}) {
  const [first] = await db.select().from(grades).limit(1);
  const gradeId = fields.gradeId ?? first?.id ?? (await grade()).id;
  const [row] = await db
    .insert(agents)
    .values({
      firstName: 'Inès',
      lastName: 'Joly',
      gradeId,
      nightMode: 'MIXED',
      hoursRegime: 'STANDARD_1607',
      startDate: '2020-01-01',
      ...fields,
    })
    .returning();
  return row!;
}

export const DAY_SHIFT = {
  code: 'J',
  label: 'Jour',
  kind: 'WORK',
  startTime: '07:00',
  endTime: '19:00',
  breakMinutes: 20,
  countedMinutes: 720,
  isNight: false,
  color: '#f59e0b',
  archived: false,
} as const;

export const LEAVE = {
  ...DAY_SHIFT,
  code: 'CA',
  label: 'Congé annuel',
  kind: 'ABSENCE',
  startTime: null,
  endTime: null,
  breakMinutes: 0,
  countedMinutes: 420,
  color: '#22c55e',
} as const;

export async function shiftType(fields: Insert<typeof shiftTypes> = {}) {
  const [row] = await db
    .insert(shiftTypes)
    .values({ ...DAY_SHIFT, ...fields })
    .returning();
  return row!;
}

export async function planning(month: string, fields: Insert<typeof plannings> = {}) {
  const [row] = await db
    .insert(plannings)
    .values({ month, ...fields })
    .returning();
  return row!;
}

export async function cell(
  fields: Pick<typeof assignments.$inferInsert, 'agentId' | 'date' | 'shiftTypeId'> &
    Insert<typeof assignments>
) {
  const [row] = await db
    .insert(assignments)
    .values({
      month: fields.date.slice(0, 7),
      countedMinutes: 720,
      source: 'MANUAL',
      updatedBy: 'seed',
      ...fields,
    })
    .returning();
  return row!;
}

export async function absenceRequest(
  fields: Pick<typeof agentRequests.$inferInsert, 'agentId' | 'shiftTypeId'> &
    Insert<typeof agentRequests>
) {
  const [row] = await db
    .insert(agentRequests)
    .values({
      startDate: '2026-11-03',
      endDate: '2026-11-03',
      kind: 'ABSENCE_APPROVED',
      ...fields,
    })
    .returning();
  return row!;
}

export async function acceptedViolation(
  fields: Pick<typeof acceptedViolations.$inferInsert, 'month' | 'agentId' | 'date' | 'rule'>
) {
  const [row] = await db
    .insert(acceptedViolations)
    .values({ comment: 'Validé avec le cadre', acceptedBy: 'seed', ...fields })
    .returning();
  return row!;
}

export async function monthBalance(fields: typeof monthBalances.$inferInsert) {
  const [row] = await db.insert(monthBalances).values(fields).returning();
  return row!;
}

export async function solveRun(
  fields: Pick<typeof solveRuns.$inferInsert, 'month'> & Insert<typeof solveRuns>
) {
  const [row] = await db
    .insert(solveRuns)
    .values({ mode: 'COMPLETE', planningVersion: 0, createdBy: 'seed', ...fields })
    .returning();
  return row!;
}
