// Decisions of the planning routes (api/routes/plannings.ts), without the
// database: what a month loads, which status changes are allowed, which cells
// to write, which violations still block, how balances open.
import { addDays, countedOn, monthDates } from '../shared/calendar';
import {
  type AssignmentSource,
  type PlanningStatus,
  UNFINISHED_SOLVE_STATUSES,
} from '../shared/domain';
import { ValidationError } from './errors';
import {
  type AgentCounters,
  inContract,
  type RuleShift,
  type Violation,
  violationKey,
} from '../shared/rules/model';

/** Days of the neighbouring months loaded with a month, for rules spanning two months. */
export const CONTEXT_DAYS = 13;

/** Dates of a month widened by the context days. */
export function contextWindow(month: string): [string, string] {
  const dates = monthDates(month);
  return [addDays(dates[0]!, -CONTEXT_DAYS), addDays(dates.at(-1)!, CONTEXT_DAYS)];
}

/** Allowed status changes: validate, publish, reopen. */
const TRANSITIONS: Record<PlanningStatus, PlanningStatus[]> = {
  DRAFT: ['VALIDATED'],
  VALIDATED: ['PUBLISHED', 'DRAFT'],
  PUBLISHED: ['DRAFT'],
};

export const canTransition = (from: PlanningStatus, to: PlanningStatus) =>
  TRANSITIONS[from].includes(to);

/** Hard violations not accepted with a justification: they block the validation. */
export function openViolations(
  violations: Violation[],
  accepted: { agentId: string; date: string; rule: string }[]
): Violation[] {
  const acceptedKeys = new Set(accepted.map(violationKey));
  return violations.filter(
    (violation) => violation.severity === 'HARD' && !acceptedKeys.has(violationKey(violation))
  );
}

/** Past this age, a run still pending or running is lost (Lambda timeout: 90 s). */
const RUN_EXPIRY_MS = 3 * 60_000;

const isUnfinished = (run: { status: string }) =>
  (UNFINISHED_SOLVE_STATUSES as readonly string[]).includes(run.status);

/** A run still pending or running, past the time the solver could take. */
export const isLost = (run: { status: string; createdAt: string }, now: number) =>
  isUnfinished(run) && now - Date.parse(run.createdAt) > RUN_EXPIRY_MS;

/** A run still pending or running, within the time the solver could take. */
export const isInProgress = (run: { status: string; createdAt: string }, now: number) =>
  isUnfinished(run) && !isLost(run, now);

interface CellAgent {
  id: string;
  lastName: string;
  startDate: string;
  endDate: string | null;
}

type CellShift = RuleShift & { archived: boolean };

interface WriteContext {
  month: string;
  updatedBy: string;
  source: AssignmentSource;
}

/**
 * Rows to upsert for a cell edit: contract dates and archived shift types are
 * checked, counted minutes computed (daylight saving time included). A cell
 * without shift type is emptied, not written.
 */
export function cellRows(
  cells: { agentId: string; date: string; shiftTypeId: string | null; locked: boolean }[],
  agentById: Map<string, CellAgent>,
  shiftById: Map<string, CellShift>,
  { month, updatedBy, source }: WriteContext
) {
  return cells.flatMap((cell) => {
    const agent = agentById.get(cell.agentId);
    if (!agent) throw new ValidationError({ cells: ['Agent inconnu'] });
    if (!inContract(agent, cell.date)) {
      throw new ValidationError({ cells: [`Hors contrat : ${agent.lastName} le ${cell.date}`] });
    }
    if (!cell.shiftTypeId) return [];
    const shift = shiftById.get(cell.shiftTypeId);
    if (!shift || shift.archived)
      throw new ValidationError({ cells: ['Poste inconnu ou archivé'] });
    return [
      {
        agentId: cell.agentId,
        date: cell.date,
        month,
        shiftTypeId: shift.id,
        countedMinutes: countedOn(cell.date, shift),
        locked: cell.locked,
        source,
        updatedBy,
      },
    ];
  });
}

/**
 * Cells a new draft starts with: each approved absence on the days of the
 * month within the agent's contract, locked with its code (unless archived).
 */
export function absenceCells(
  requests: { agentId: string; startDate: string; endDate: string; shiftTypeId: string | null }[],
  agentById: Map<string, CellAgent>,
  shiftById: Map<string, CellShift>,
  { month, updatedBy }: Omit<WriteContext, 'source'>
) {
  const dates = monthDates(month);
  return requests.flatMap((request) => {
    const agent = agentById.get(request.agentId)!;
    const shift = shiftById.get(request.shiftTypeId!)!;
    // A cell is never written with an archived code: the validator flags the
    // absence, the manager picks a current code.
    if (shift.archived) return [];
    return dates
      .filter(
        (date) => date >= request.startDate && date <= request.endDate && inContract(agent, date)
      )
      .map((date) => ({
        agentId: agent.id,
        date,
        month,
        shiftTypeId: shift.id,
        countedMinutes: countedOn(date, shift),
        locked: true,
        source: 'REQUEST' as const,
        updatedBy,
      }));
  });
}

/** What publishing records of each agent's month: hours credited and target. */
export const monthBalanceRows = (counts: AgentCounters[], month: string) =>
  counts.map((count) => ({
    agentId: count.agentId,
    month,
    creditedMinutes: count.creditedMinutes,
    targetMinutes: count.targetMinutes,
  }));

/**
 * Each agent's hour balance at the start of a month: their initial balance
 * plus the gap (credited - target) of every earlier month, as of its last
 * publication.
 */
export function openingBalances(
  agents: { id: string; initial: number }[],
  carried: { agentId: string; minutes: number }[]
) {
  const carriedBy = new Map(carried.map((row) => [row.agentId, row.minutes]));
  return agents.map((agent) => ({
    agentId: agent.id,
    minutes: agent.initial + (carriedBy.get(agent.id) ?? 0),
  }));
}

/** The previous month is planned but not published: its hours may still change. */
export const previousMonthOpen = (previous: { status: PlanningStatus } | undefined) =>
  previous !== undefined && previous.status !== 'PUBLISHED';

/**
 * An earlier month was republished after this one: the opening balances this
 * month was published with have changed. Both timestamps are read from the
 * database in its text format, so they compare as text.
 */
export const openingChangedSincePublication = (
  publishedAt: string | null | undefined,
  earlierPublishedAt: string | null
) => !!publishedAt && earlierPublishedAt !== null && earlierPublishedAt > publishedAt;
