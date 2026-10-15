// Counters of each agent over the month: hours credited against the target,
// nights, weekends, holidays. Shown in the grid, recorded at publication, and
// read by the MONTHLY_HOURS rule.
import { dayOfWeek, daysBetween, isPublicHoliday, monthDates, monthOf } from '../calendar';
import type { HoursRegime } from '../domain';
import { type AgentCounters, inContract, type RuleInput } from './model';

const HOUR = 60;

/** Annual working time of a full-time agent, in minutes. */
const ANNUAL_MINUTES: Record<Exclude<HoursRegime, 'MIXED_PRORATA'>, number> = {
  STANDARD_1607: 1607 * HOUR,
  VARIABLE_REST_1582: 1582 * HOUR,
  NIGHT_1476: 1476 * HOUR,
};

/** Hours, nights, weekends and holidays of each agent over the month. */
export function countPlanning(input: RuleInput): AgentCounters[] {
  const dates = monthDates(input.month);
  const shiftById = new Map(input.shiftTypes.map((shift) => [shift.id, shift]));
  const cellsByAgent = Map.groupBy(input.cells, (cell) => cell.agentId);

  return input.agents.map((agent) => {
    const counters: AgentCounters = {
      agentId: agent.id,
      workedMinutes: 0,
      creditedMinutes: 0,
      targetMinutes: 0,
      nights: 0,
      weekendDays: 0,
      holidays: 0,
    };
    let nightMinutes = 0;
    for (const cell of cellsByAgent.get(agent.id) ?? []) {
      const shift = shiftById.get(cell.shiftTypeId);
      if (!shift || monthOf(cell.date) !== input.month) continue;
      counters.creditedMinutes += cell.countedMinutes;
      if (shift.kind !== 'WORK') continue;
      counters.workedMinutes += cell.countedMinutes;
      if (shift.isNight) {
        counters.nights += 1;
        nightMinutes += cell.countedMinutes;
      }
      if ([0, 6].includes(dayOfWeek(cell.date))) counters.weekendDays += 1;
      if (isPublicHoliday(cell.date)) counters.holidays += 1;
    }
    // Annual obligation × work-time ratio, pro rata of the contract days in the
    // month; a mixed regime moves from 1607 h towards 1476 h with its night share.
    const annual =
      agent.hoursRegime === 'MIXED_PRORATA'
        ? ANNUAL_MINUTES.STANDARD_1607 -
          (ANNUAL_MINUTES.STANDARD_1607 - ANNUAL_MINUTES.NIGHT_1476) *
            (counters.workedMinutes ? nightMinutes / counters.workedMinutes : 0)
        : ANNUAL_MINUTES[agent.hoursRegime];
    const contractDays = dates.filter((date) => inContract(agent, date)).length;
    const year = Number(input.month.slice(0, 4));
    const yearDays = daysBetween(`${year}-01-01`, `${year + 1}-01-01`);
    counters.targetMinutes = Math.round(
      (annual * (agent.workTimeRatio / 100) * contractDays) / yearDays
    );
    return counters;
  });
}
