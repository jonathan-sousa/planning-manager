// Why a coverage minimum is not met: what stops each agent of the grade from
// taking the shift that day. Reuses the validator, so it explains gaps left by
// hand as well as by the solver.
import type { RuleAgent, RuleInput, Violation } from './model';
import { validatePlanning } from './validate';

export interface CoverageSlotKey {
  date: string;
  shiftTypeId: string;
  gradeId: string;
  skillId: string | null;
}

export type CandidateStatus =
  /** Counted in the slot already. */
  | 'COUNTED'
  /** Empty or rest day, no hard rule broken by placing the shift. */
  | 'AVAILABLE'
  /** On another work shift that could be swapped without breaking a hard rule. */
  | 'ELSEWHERE'
  /** Placing the shift breaks at least one hard rule. */
  | 'BLOCKED'
  | 'ABSENT'
  | 'LOCKED'
  | 'NO_SKILL'
  | 'OUT_OF_CONTRACT';

export interface Candidate {
  agentId: string;
  status: CandidateStatus;
  /** Shift held that day, if any. */
  shiftTypeId?: string;
  /** Hard violations the placement would add (BLOCKED). */
  blockers: Violation[];
}

const violationKey = (v: Violation) => `${v.rule}|${v.date}|${v.message}`;

/** Hard violations of one agent, on the input restricted to that agent. */
function hardViolations(input: RuleInput, agent: RuleAgent, cells: RuleInput['cells']) {
  return validatePlanning({
    ...input,
    agents: [agent],
    cells,
    needs: [],
    overrides: [],
    requests: input.requests.filter((request) => request.agentId === agent.id),
  }).filter((violation) => violation.severity === 'HARD');
}

/**
 * Every agent of the slot's grade, with what placing the slot's shift on them
 * that day would take. Locked cells are kept as they are, like the solver does.
 */
export function diagnoseCoverage(
  input: RuleInput,
  slot: CoverageSlotKey,
  locked: (agentId: string, date: string) => boolean
): Candidate[] {
  const shiftById = new Map(input.shiftTypes.map((shift) => [shift.id, shift]));
  const shift = shiftById.get(slot.shiftTypeId);
  return input.agents
    .filter((agent) => agent.gradeId === slot.gradeId)
    .map((agent): Candidate => {
      const cells = input.cells.filter((cell) => cell.agentId === agent.id);
      const current = cells.find((cell) => cell.date === slot.date);
      const held = current && shiftById.get(current.shiftTypeId);
      const result = (status: CandidateStatus, blockers: Violation[] = []): Candidate => ({
        agentId: agent.id,
        status,
        shiftTypeId: current?.shiftTypeId,
        blockers,
      });

      if (slot.skillId && !agent.skillIds.includes(slot.skillId)) return result('NO_SKILL');
      if (current?.shiftTypeId === slot.shiftTypeId) return result('COUNTED');
      if (slot.date < agent.startDate || (agent.endDate && slot.date > agent.endDate)) {
        return result('OUT_OF_CONTRACT');
      }
      const approvedAbsence = input.requests.some(
        (request) =>
          request.agentId === agent.id &&
          request.kind === 'ABSENCE_APPROVED' &&
          request.startDate <= slot.date &&
          request.endDate >= slot.date
      );
      if (held?.kind === 'ABSENCE' || approvedAbsence) return result('ABSENT');
      if (current && locked(agent.id, slot.date)) return result('LOCKED');

      const before = new Set(hardViolations(input, agent, cells).map(violationKey));
      const placed = [
        ...cells.filter((cell) => cell.date !== slot.date),
        {
          agentId: agent.id,
          date: slot.date,
          shiftTypeId: slot.shiftTypeId,
          countedMinutes: shift?.countedMinutes ?? 0,
        },
      ];
      const added = hardViolations(input, agent, placed).filter(
        (violation) => !before.has(violationKey(violation))
      );
      if (added.length) return result('BLOCKED', added);
      return result(held?.kind === 'WORK' ? 'ELSEWHERE' : 'AVAILABLE');
    });
}
