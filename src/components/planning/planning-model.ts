// What the planning screen derives from a month's data: rows in grid order,
// violations and counters, coverage lines, balances and texts. Pure, shared
// by the editor, the grid and the exports; usePlanningModel memoizes it.
import { dayKind } from '../../../api/calendar';
import { formatMinutes } from '../../../api/format';
import {
  type AgentCounters,
  planningAgents,
  type RuleInput,
  type Violation,
  violationKey,
} from '../../../api/rules/model';
import { countPlanning } from '../../../api/rules/counters';
import { coverage } from '../../../api/rules/coverage';
import { validatePlanning } from '../../../api/rules/validate';
import type { GridCell } from './cells';
import type {
  AcceptedViolation,
  Agent,
  AgentRequest,
  CoverageNeed,
  CoverageOverride,
  Grade,
  RuleSettings,
  ShiftType,
  Skill,
} from '@/lib/resources';

export type CoverageSlot = NonNullable<Violation['slot']>;

/** Agents counted per day against a coverage need. */
export interface CoverageNeedCount {
  count: number;
  /** Required minimum; 0 for a need with a target only. */
  min: number;
}

export interface CoverageRow {
  label: string;
  slot: CoverageSlot;
  /** Per date: agents counted and required minimum, or undefined when no need. */
  byDate: Map<string, CoverageNeedCount>;
}

/** Weekends and public holidays, greyed in the grid and the PDF. */
export const isOffDay = (date: string) => dayKind(date) !== 'WEEKDAY';

export const agentName = (agent: { lastName: string; firstName: string }) =>
  `${agent.lastName} ${agent.firstName}`;

/** '150h / 151h30': hours credited over the target. */
export const hoursText = (count: AgentCounters) =>
  `${formatMinutes(count.creditedMinutes)} / ${formatMinutes(count.targetMinutes)}`;

/** The month's gap: hours credited minus the target. */
export const monthGap = (count: AgentCounters | undefined) =>
  count ? count.creditedMinutes - count.targetMinutes : 0;

export const isShort = (need: CoverageNeedCount | undefined): need is CoverageNeedCount =>
  need !== undefined && need.count < need.min;

/** '2/3' against a minimum, the headcount alone for a target-only need. */
export const coverageText = (need: CoverageNeedCount) =>
  need.min ? `${need.count}/${need.min}` : String(need.count);

/** Grid order: grade order, then name in French. */
export function sortAgents<A extends Agent>(agents: A[], grades: Grade[]): A[] {
  const gradeOrder = new Map(grades.map((grade) => [grade.id, grade.sortOrder]));
  return agents.toSorted(
    (a, b) =>
      (gradeOrder.get(a.gradeId) ?? 0) - (gradeOrder.get(b.gradeId) ?? 0) ||
      a.lastName.localeCompare(b.lastName, 'fr') ||
      a.firstName.localeCompare(b.firstName, 'fr')
  );
}

/** One line per need (shift, grade, skill), sorted by label. */
export function coverageRows(input: RuleInput, slotLabel: (slot: CoverageSlot) => string) {
  const bySlot = Map.groupBy(
    coverage(input),
    (slot) => `${slot.shiftTypeId}|${slot.gradeId}|${slot.skillId ?? ''}`
  );
  return [...bySlot.values()]
    .map((slots): CoverageRow => {
      const { shiftTypeId, gradeId, skillId } = slots[0]!;
      const slot = { shiftTypeId, gradeId, skillId };
      return {
        label: slotLabel(slot),
        slot,
        byDate: new Map(slots.map((day) => [day.date, { count: day.count, min: day.minCount }])),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

/** Hard violations to handle first, then the accepted ones, then the soft ones; by date. */
export function summarizeViolations(violations: Violation[], accepted: Set<string>) {
  const isOpenHard = (violation: Violation) =>
    violation.severity === 'HARD' && !accepted.has(violationKey(violation));
  const hard = violations.filter((violation) => violation.severity === 'HARD');
  return {
    isOpenHard,
    openHard: hard.filter(isOpenHard).length,
    accepted: hard.length - hard.filter(isOpenHard).length,
    soft: violations.length - hard.length,
    listed: violations.toSorted(
      (a, b) =>
        Number(!isOpenHard(a)) - Number(!isOpenHard(b)) ||
        Number(a.severity !== 'HARD') - Number(b.severity !== 'HARD') ||
        a.date.localeCompare(b.date)
    ),
  };
}

export interface PlanningData {
  month: string;
  agents: Agent[];
  grades: Grade[];
  skills: Skill[];
  shifts: ShiftType[];
  needs: CoverageNeed[];
  overrides: CoverageOverride[];
  requests: AgentRequest[];
  settings: RuleSettings;
  acceptedViolations: AcceptedViolation[];
  openingBalances: { agentId: string; minutes: number }[];
}

export type PlanningModel = ReturnType<typeof planningModel>;

/** Everything the screen shows of a month, for the cells currently displayed. */
export function planningModel(data: PlanningData, cells: Map<string, GridCell>) {
  const gradeCode = new Map(data.grades.map((grade) => [grade.id, grade.code]));
  const shiftCode = new Map(data.shifts.map((shift) => [shift.id, shift.code]));
  const skillCode = new Map(data.skills.map((skill) => [skill.id, skill.code]));
  const rows = sortAgents(
    planningAgents(data.agents, [...cells.values()], data.month),
    data.grades
  );
  const input: RuleInput = {
    month: data.month,
    settings: data.settings,
    agents: rows,
    shiftTypes: data.shifts,
    cells: [...cells.values()],
    needs: data.needs,
    overrides: data.overrides,
    requests: data.requests,
  };
  const slotLabel = ({ shiftTypeId, gradeId, skillId }: CoverageSlot) =>
    [shiftCode.get(shiftTypeId), gradeCode.get(gradeId), skillId && skillCode.get(skillId)]
      .filter(Boolean)
      .join(' ');
  const acceptedByKey = new Map(data.acceptedViolations.map((item) => [violationKey(item), item]));
  const accepted = new Set(acceptedByKey.keys());
  const violations = validatePlanning(input);
  return {
    rows,
    input,
    gradeCode,
    shiftCode,
    slotLabel,
    agentName: new Map(rows.map((agent) => [agent.id, agentName(agent)])),
    violations,
    accepted,
    acceptedByKey,
    summary: summarizeViolations(violations, accepted),
    counters: new Map(countPlanning(input).map((count) => [count.agentId, count])),
    openingBalance: new Map(data.openingBalances.map((item) => [item.agentId, item.minutes])),
    coverage: coverageRows(input, slotLabel),
  };
}
