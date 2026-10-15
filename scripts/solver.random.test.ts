// Random small months (daylight saving time, context and locked cells,
// absences, partial contracts, a shift ending at midnight): when the solver
// reports no hard violation, the TypeScript validator must agree.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addDays, countedOn, monthDates } from '../shared/calendar';
import type { RuleCell, RuleInput, RuleShift } from '../shared/rules/model';
import { validatePlanning } from '../shared/rules/validate';
import { solve } from './solve';

const settings = JSON.parse(readFileSync('fixtures/rule-scenarios/_settings.json', 'utf8'));
const shifts: RuleShift[] = JSON.parse(
  readFileSync('fixtures/rule-scenarios/_shifts.json', 'utf8')
).map((shift: Omit<RuleShift, 'id'>) => ({ ...shift, id: shift.code }));
const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));

/** Seeded generator (mulberry32): the same months on every run. */
function generator(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: T[]) => items[int(0, items.length - 1)]!;
  return { next, int, pick };
}

type Problem = Omit<RuleInput, 'cells'> & {
  mode: string;
  cells: (RuleCell & { locked: boolean })[];
};

function randomMonth(seed: number): Problem {
  const { next, int, pick } = generator(seed);
  const month = pick(['2026-03', '2026-10', '2026-11']);
  const dates = monthDates(month);
  const agents = Array.from({ length: int(3, 5) }, (_, i) => ({
    id: `a${i}`,
    firstName: `a${i}`,
    lastName: '',
    gradeId: 'IDE',
    skillIds: [],
    workTimeRatio: 100,
    nightMode: pick(['MIXED', 'MIXED', 'DAY_ONLY', 'NIGHT_ONLY'] as const),
    hoursRegime: 'STANDARD_1607' as const,
    startDate: pick(['2020-01-01', addDays(dates[0]!, int(-5, 10))]),
    endDate: pick([null, null, addDays(dates.at(-1)!, int(-10, 5))]),
  }));
  const cells = agents.flatMap((agent) =>
    Array.from({ length: dates.length + 26 }, (_, i) => addDays(dates[0]!, i - 13)).flatMap(
      (date) => {
        const inMonth = date >= dates[0]! && date <= dates.at(-1)!;
        const inContract = date >= agent.startDate && (!agent.endDate || date <= agent.endDate);
        if (!inContract || next() > (inMonth ? 0.15 : 0.5)) return [];
        let code = pick(['J', 'N', 'M', 'S', 'E', 'RH', 'CA']);
        if (agent.nightMode === 'DAY_ONLY' && code === 'N') code = 'J';
        if (agent.nightMode === 'NIGHT_ONLY' && 'JMSE'.includes(code)) code = 'N';
        const shift = shiftById.get(code)!;
        return [
          {
            agentId: agent.id,
            date,
            shiftTypeId: code,
            countedMinutes: countedOn(date, shift),
            locked: next() < 0.3,
          },
        ];
      }
    )
  );
  const needs = (['WEEKDAY', 'SATURDAY', 'SUNDAY_HOLIDAY'] as const).flatMap((dayKind) =>
    ['J', 'N', 'S', 'E', 'M'].flatMap((shiftTypeId) =>
      next() < 0.6
        ? [{ shiftTypeId, gradeId: 'IDE', skillId: null, dayKind, minCount: int(1, 2) }]
        : []
    )
  );
  const requests = agents.flatMap((agent) => {
    const start = addDays(dates[0]!, int(0, dates.length - 3));
    return next() < 0.5
      ? [
          {
            agentId: agent.id,
            startDate: start,
            endDate: addDays(start, int(0, 3)),
            kind: 'ABSENCE_APPROVED' as const,
            shiftTypeId: 'CA',
          },
        ]
      : [];
  });
  const settingsOfMonth = {
    ...settings,
    maxConsecutiveWorkDays: int(3, 6),
    restDayExcludesPreviousNight: next() < 0.5,
  };
  return {
    month,
    mode: pick(['COMPLETE', 'REOPTIMIZE']),
    settings: settingsOfMonth,
    agents,
    shiftTypes: shifts,
    cells,
    needs,
    overrides: [],
    requests,
  };
}

describe('solver on random months', () => {
  it(
    'never claims zero hard violations when the validator finds some',
    { timeout: 180_000 },
    () => {
      const problems = Array.from({ length: 12 }, (_, seed) => randomMonth(seed + 1));
      const results = solve(problems.map((problem) => ({ ...problem, timeLimitSeconds: 3 })));
      let checked = 0;
      problems.forEach((problem, index) => {
        const result = results[index]!;
        const cells = new Map(problem.cells.map((cell) => [`${cell.agentId}|${cell.date}`, cell]));
        for (const change of result.cells) {
          const key = `${change.agentId}|${change.date}`;
          if (!change.shiftTypeId) cells.delete(key);
          else {
            const shift = shiftById.get(change.shiftTypeId)!;
            cells.set(key, {
              agentId: change.agentId,
              date: change.date,
              shiftTypeId: shift.id,
              countedMinutes: countedOn(change.date, shift),
              locked: false,
            });
          }
        }
        const hard = validatePlanning({ ...problem, cells: [...cells.values()] }).filter(
          (violation) => violation.severity === 'HARD'
        );
        if (result.stats.hard === 0) {
          checked += 1;
          expect(hard, `seed ${index + 1}: ${JSON.stringify(hard.slice(0, 3))}`).toEqual([]);
        }
      });
      // Only the months the solver claims clean are checked: 5 of these 12 on a
      // fast machine. The solver runs on several threads within 3 s, so a slower
      // or busier one may clear fewer: the floor keeps a margin, it only catches
      // a test that would check next to nothing.
      expect(checked, 'months without hard violation').toBeGreaterThanOrEqual(3);
    }
  );
});
