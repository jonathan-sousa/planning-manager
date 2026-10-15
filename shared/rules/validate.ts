// The single definition of a planning violation (docs/scheduling-rules.md).
// Pure function: the grid runs it on every edit, the API before publishing.
import {
  addDays,
  dayOfWeek,
  fortnightStart,
  monthDates,
  monthOf,
  nominalMinutes,
  parisMinute,
  shiftInterval,
} from '../calendar';
import { type RuleCode, RULES } from '../domain';
import { formatDayMonth, formatMinutes } from '../format';
import { countPlanning } from './counters';
import { coverage } from './coverage';
import {
  inContract,
  type RuleAgent,
  type RuleCell,
  type RuleInput,
  type RuleShift,
  type Violation,
} from './model';

interface WorkPeriod {
  date: string;
  start: number;
  end: number;
}

/** One agent's month seen through the rules. */
class AgentPlan {
  readonly cells = new Map<string, { cell: RuleCell; shift: RuleShift }>();

  readonly agent: RuleAgent;

  constructor(agent: RuleAgent, cells: RuleCell[], shiftById: Map<string, RuleShift>) {
    this.agent = agent;
    for (const cell of cells) {
      const shift = shiftById.get(cell.shiftTypeId);
      if (shift) this.cells.set(cell.date, { cell, shift });
    }
  }

  /** The work shift starting on a date, if any. */
  work(date: string): RuleShift | undefined {
    const entry = this.cells.get(date);
    return entry?.shift.kind === 'WORK' ? entry.shift : undefined;
  }

  /** Work periods in absolute minutes, sorted. */
  periods(): WorkPeriod[] {
    return [...this.cells.values()]
      .filter(({ shift }) => shift.kind === 'WORK' && shift.startTime && shift.endTime)
      .map(({ cell, shift }) => ({
        date: cell.date,
        ...shiftInterval(cell.date, shift.startTime!, shift.endTime!),
      }))
      .sort((a, b) => a.start - b.start);
  }

  /** No work shift starts that day, nor (optionally) a night the day before. */
  isRestDay(date: string, excludePreviousNight: boolean): boolean {
    if (this.work(date)) return false;
    return !(excludePreviousNight && this.work(addDays(date, -1))?.isNight);
  }

  inContract(date: string): boolean {
    return inContract(this.agent, date);
  }
}

const name = (agent: RuleAgent) => `${agent.firstName} ${agent.lastName}`;

/**
 * Days d such that the predicate fails on d but not on d - 1: reports a run of
 * failing rolling windows once, on its first window (the first day of the
 * month for a run that started before it).
 */
function firstOfRuns(dates: string[], fails: (date: string) => boolean): string[] {
  return dates.filter((date, index) => fails(date) && (index === 0 || !fails(addDays(date, -1))));
}

export function validatePlanning(input: RuleInput): Violation[] {
  const { month, settings } = input;
  const dates = monthDates(month);
  const inMonth = (date: string) => monthOf(date) === month;
  const shiftById = new Map(input.shiftTypes.map((shift) => [shift.id, shift]));
  const cellsByAgent = Map.groupBy(input.cells, (cell) => cell.agentId);
  const violations: Violation[] = [];
  const add = (rule: RuleCode, date: string, message: string, agentId?: string) =>
    violations.push({ rule, severity: RULES[rule], date, agentId, message });

  for (const agent of input.agents) {
    const plan = new AgentPlan(agent, cellsByAgent.get(agent.id) ?? [], shiftById);
    const who = name(agent);

    for (const [date, { shift }] of plan.cells) {
      if (!inMonth(date) || shift.kind !== 'WORK' || !shift.startTime || !shift.endTime) continue;
      // On the nominal span: a DST night lasting 13 h is not a longer shift.
      const span = nominalMinutes(shift.startTime, shift.endTime);
      if (span > settings.maxShiftAmplitudeMinutes) {
        add('SHIFT_AMPLITUDE', date, `${shift.code} dure ${formatMinutes(span)}`, agent.id);
      }
      if (
        span - shift.breakMinutes > settings.breakThresholdMinutes &&
        shift.breakMinutes < settings.minBreakMinutes
      ) {
        add('SHIFT_BREAK', date, `${shift.code} : pause de ${shift.breakMinutes} min`, agent.id);
      }
      if (agent.nightMode === 'DAY_ONLY' && shift.isNight) {
        add('NIGHT_MODE', date, `${who} travaille de jour uniquement`, agent.id);
      }
      if (agent.nightMode === 'NIGHT_ONLY' && !shift.isNight) {
        add('NIGHT_MODE', date, `${who} travaille de nuit uniquement`, agent.id);
      }
    }

    // Daily rest between two consecutive work periods.
    const periods = plan.periods();
    for (let i = 1; i < periods.length; i++) {
      const rest = periods[i]!.start - periods[i - 1]!.end;
      const date = inMonth(periods[i]!.date) ? periods[i]!.date : periods[i - 1]!.date;
      if (rest < settings.minDailyRestMinutes && inMonth(date)) {
        add(
          'DAILY_REST',
          date,
          `Repos de ${formatMinutes(Math.max(rest, 0))} avant ce poste`,
          agent.id
        );
      }
    }

    // Rolling 7-day windows ending on each day of the month.
    const weeklyMinutes = (end: string) =>
      Array.from({ length: 7 }, (_, i) => plan.cells.get(addDays(end, -i)))
        .filter((entry) => entry?.shift.kind === 'WORK')
        .reduce((sum, entry) => sum + entry!.cell.countedMinutes, 0);
    for (const date of firstOfRuns(
      dates,
      (end) => weeklyMinutes(end) > settings.maxWeeklyMinutes
    )) {
      add('WEEKLY_HOURS', date, `${formatMinutes(weeklyMinutes(date))} sur 7 jours`, agent.id);
    }

    // Every 7-day window must meet a rest period of the minimum length.
    const restPeriods = [-Infinity, ...periods.flatMap((p) => [p.start, p.end]), Infinity];
    const longRests: [number, number][] = [];
    for (let i = 0; i < restPeriods.length; i += 2) {
      const [from, to] = [restPeriods[i]!, restPeriods[i + 1]!];
      if (to - from >= settings.minWeeklyRestMinutes) longRests.push([from, to]);
    }
    const lacksWeeklyRest = (end: string) => {
      const windowStart = parisMinute(addDays(end, -6), '00:00');
      const windowEnd = parisMinute(addDays(end, 1), '00:00');
      return !longRests.some(([from, to]) => from < windowEnd && to > windowStart);
    };
    for (const date of firstOfRuns(dates, lacksWeeklyRest)) {
      add(
        'WEEKLY_REST',
        date,
        `Pas de repos de ${formatMinutes(settings.minWeeklyRestMinutes)} sur 7 jours`,
        agent.id
      );
    }

    // Fixed fortnights: enough rest days, two of them consecutive with a Sunday.
    const fortnightStarts = new Set(
      dates.map((date) => fortnightStart(date, settings.fortnightAnchorDate))
    );
    for (const first of fortnightStarts) {
      const days = Array.from({ length: 14 }, (_, i) => addDays(first, i));
      if (!days.every((date) => plan.inContract(date))) continue;
      const rest = (date: string) => plan.isRestDay(date, settings.restDayExcludesPreviousNight);
      const restDays = days.filter(rest).length;
      const sundayPair = days.some(
        (date) =>
          dayOfWeek(date) === 0 && rest(date) && (rest(addDays(date, -1)) || rest(addDays(date, 1)))
      );
      const shownOn = days.filter(inMonth).at(-1)!;
      if (restDays < settings.fortnightMinRestDays) {
        add(
          'FORTNIGHT_REST',
          shownOn,
          `${restDays} jours de repos sur la quinzaine du ${formatDayMonth(first)}`,
          agent.id
        );
      }
      if (!sundayPair) {
        add(
          'FORTNIGHT_REST',
          shownOn,
          `Pas de repos de 2 jours avec un dimanche sur la quinzaine du ${formatDayMonth(first)}`,
          agent.id
        );
      }
    }

    // Consecutive worked days.
    let run = 0;
    for (
      let date = addDays(dates[0]!, -settings.maxConsecutiveWorkDays);
      date <= dates.at(-1)!;
      date = addDays(date, 1)
    ) {
      run = plan.work(date) ? run + 1 : 0;
      // Once per run: when it passes the maximum, or on the 1st if it already had.
      const over = run > settings.maxConsecutiveWorkDays;
      if (
        over &&
        inMonth(date) &&
        (run === settings.maxConsecutiveWorkDays + 1 || date === dates[0])
      ) {
        add('CONSECUTIVE_DAYS', date, `${run} jours travaillés d'affilée`, agent.id);
      }
    }

    // Isolated rest day (empty or rest code, not an absence) between two worked days.
    for (const date of dates) {
      const off = !plan.cells.has(date) || plan.cells.get(date)!.shift.kind === 'REST';
      if (
        plan.inContract(date) &&
        off &&
        plan.work(addDays(date, -1)) &&
        plan.work(addDays(date, 1))
      ) {
        add('ISOLATED_REST', date, 'Jour de repos isolé', agent.id);
      }
    }
  }

  // Requests: approved absences hold their code; wishes are soft.
  for (const request of input.requests) {
    const agent = input.agents.find((candidate) => candidate.id === request.agentId);
    if (!agent) continue;
    const cells = new Map((cellsByAgent.get(agent.id) ?? []).map((cell) => [cell.date, cell]));
    for (let date = request.startDate; date <= request.endDate; date = addDays(date, 1)) {
      if (!inMonth(date) || !inContract(agent, date)) continue;
      const cell = cells.get(date);
      const shift = cell && shiftById.get(cell.shiftTypeId);
      const expected = request.shiftTypeId && shiftById.get(request.shiftTypeId)?.code;
      if (request.kind === 'ABSENCE_APPROVED' && cell?.shiftTypeId !== request.shiftTypeId) {
        add('APPROVED_ABSENCE', date, `Absence validée : ${expected} attendu`, agent.id);
      }
      if (request.kind === 'WISH_OFF' && shift?.kind === 'WORK') {
        add('WISH', date, 'Souhait de repos', agent.id);
      }
      if (request.kind === 'WISH_SHIFT' && cell?.shiftTypeId !== request.shiftTypeId) {
        add('WISH', date, `Souhait : ${expected}`, agent.id);
      }
    }
  }

  for (const { date, shiftTypeId, gradeId, skillId, minCount, count } of coverage(input)) {
    if (count < minCount) {
      violations.push({
        rule: 'COVERAGE',
        severity: RULES.COVERAGE,
        date,
        slot: { shiftTypeId, gradeId, skillId },
        message: `${count}/${minCount}`,
      });
    }
  }

  // Monthly hours against the target.
  for (const counters of countPlanning(input)) {
    const gap = counters.creditedMinutes - counters.targetMinutes;
    if (Math.abs(gap) > settings.monthlyHoursToleranceMinutes) {
      const sign = gap > 0 ? '+' : '−';
      add(
        'MONTHLY_HOURS',
        dates.at(-1)!,
        `Heures du mois : ${sign}${formatMinutes(Math.abs(gap))} par rapport à la cible`,
        counters.agentId
      );
    }
  }

  return violations;
}
