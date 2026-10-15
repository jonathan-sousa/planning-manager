import { describe, expect, it } from 'vitest';
import { coverage } from './coverage';
import type { RuleAgent, RuleInput } from './model';

const agent = (id: string, gradeId: string, skillIds: string[] = []): RuleAgent => ({
  id,
  firstName: id,
  lastName: '',
  gradeId,
  skillIds,
  workTimeRatio: 100,
  nightMode: 'MIXED',
  hoursRegime: 'STANDARD_1607',
  startDate: '2020-01-01',
  endDate: null,
});
const cell = (agentId: string, date: string, shiftTypeId = 'J') => ({
  agentId,
  date,
  shiftTypeId,
  countedMinutes: 720,
});
const input = (fields: Partial<RuleInput>): RuleInput => ({
  month: '2026-11',
  settings: {} as RuleInput['settings'],
  agents: [agent('ide1', 'IDE', ['URG']), agent('ide2', 'IDE'), agent('as1', 'AS')],
  shiftTypes: [],
  cells: [],
  needs: [],
  overrides: [],
  requests: [],
  ...fields,
});
const need = (fields: Partial<RuleInput['needs'][number]> = {}) => ({
  shiftTypeId: 'J',
  gradeId: 'IDE',
  skillId: null,
  dayKind: 'WEEKDAY' as const,
  minCount: 2,
  ...fields,
});
const on = (date: string, slots: ReturnType<typeof coverage>) =>
  slots.filter((slot) => slot.date === date);

describe('coverage', () => {
  it('counts the agents of the grade on the shift, each day the need applies', () => {
    const slots = coverage(
      input({
        needs: [need()],
        cells: [
          cell('ide1', '2026-11-02'),
          cell('as1', '2026-11-02'),
          cell('ide2', '2026-11-02', 'N'),
        ],
      })
    );
    // Monday 2 November: one nurse on J (the aide and the night shift do not count).
    expect(on('2026-11-02', slots)).toEqual([
      {
        date: '2026-11-02',
        shiftTypeId: 'J',
        gradeId: 'IDE',
        skillId: null,
        minCount: 2,
        count: 1,
      },
    ]);
    // Weekdays only: no slot on Saturday 7, Sunday 8 or the public holiday of 11 November.
    expect(on('2026-11-07', slots)).toEqual([]);
    expect(on('2026-11-08', slots)).toEqual([]);
    expect(on('2026-11-11', slots)).toEqual([]);
    expect(slots).toHaveLength(20);
  });

  it('requires the skill when the need names one', () => {
    const slots = coverage(
      input({
        needs: [need({ skillId: 'URG', minCount: 1 })],
        cells: [cell('ide1', '2026-11-03'), cell('ide2', '2026-11-03')],
      })
    );
    expect(on('2026-11-03', slots)[0]!.count).toBe(1);
  });

  it('replaces the standard need of a slot with the dated override', () => {
    const slots = coverage(
      input({
        needs: [need(), need({ gradeId: 'AS', minCount: 1 })],
        overrides: [
          { date: '2026-11-03', shiftTypeId: 'J', gradeId: 'IDE', skillId: null, minCount: 4 },
          // An override also creates a slot that has no standard need that day.
          { date: '2026-11-08', shiftTypeId: 'J', gradeId: 'IDE', skillId: null, minCount: 1 },
        ],
      })
    );
    expect(on('2026-11-03', slots).map((slot) => [slot.gradeId, slot.minCount])).toEqual([
      ['IDE', 4],
      ['AS', 1],
    ]);
    expect(on('2026-11-08', slots).map((slot) => slot.minCount)).toEqual([1]);
  });
});
