// Coverage of the needs: agents per shift, grade and skill on each day of the
// month, against the required minimum. The grid's coverage lines, the
// COVERAGE violations and the diagnosis read it.
import { dayKind, monthDates } from '../calendar';
import type { RuleInput } from './model';

export interface CoverageSlot {
  date: string;
  shiftTypeId: string;
  gradeId: string;
  skillId: string | null;
  minCount: number;
  /** Agents on that shift with the grade (and the skill, when required). */
  count: number;
}

/** Coverage of each need of each day of the month; dated overrides replace the standard need of the same slot. */
export function coverage(input: RuleInput): CoverageSlot[] {
  const slotKey = (need: { shiftTypeId: string; gradeId: string; skillId: string | null }) =>
    `${need.shiftTypeId}|${need.gradeId}|${need.skillId ?? ''}`;
  const agentById = new Map(input.agents.map((agent) => [agent.id, agent]));
  const cellsByDate = Map.groupBy(input.cells, (cell) => cell.date);
  return monthDates(input.month).flatMap((date) => {
    const needs = new Map(
      input.needs
        .filter((need) => need.dayKind === dayKind(date))
        .map((need) => [slotKey(need), need])
    );
    for (const override of input.overrides.filter((item) => item.date === date)) {
      needs.set(slotKey(override), { ...override, dayKind: dayKind(date) });
    }
    return [...needs.values()].map(({ shiftTypeId, gradeId, skillId, minCount }) => ({
      date,
      shiftTypeId,
      gradeId,
      skillId,
      minCount,
      count: (cellsByDate.get(date) ?? []).filter((cell) => {
        const agent = agentById.get(cell.agentId);
        return (
          cell.shiftTypeId === shiftTypeId &&
          agent?.gradeId === gradeId &&
          (!skillId || agent.skillIds.includes(skillId))
        );
      }).length,
    }));
  });
}
