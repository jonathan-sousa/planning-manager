import { describe, expect, it } from 'vitest';
import type { RuleInput } from './model';
import { countPlanning } from './counters';

const base: Omit<RuleInput, 'agents' | 'cells'> = {
  month: '2026-11',
  settings: {} as RuleInput['settings'],
  shiftTypes: [
    {
      id: 'J',
      code: 'J',
      kind: 'WORK',
      startTime: '07:00',
      endTime: '19:00',
      breakMinutes: 20,
      countedMinutes: 720,
      isNight: false,
    },
    {
      id: 'N',
      code: 'N',
      kind: 'WORK',
      startTime: '19:00',
      endTime: '07:00',
      breakMinutes: 20,
      countedMinutes: 720,
      isNight: true,
    },
    {
      id: 'CA',
      code: 'CA',
      kind: 'ABSENCE',
      startTime: null,
      endTime: null,
      breakMinutes: 0,
      countedMinutes: 420,
      isNight: false,
    },
  ],
  needs: [],
  overrides: [],
  requests: [],
};
const agent = {
  id: 'A',
  firstName: 'A',
  lastName: '',
  gradeId: 'IDE',
  skillIds: [],
  workTimeRatio: 100,
  nightMode: 'MIXED' as const,
  hoursRegime: 'STANDARD_1607' as const,
  startDate: '2020-01-01',
  endDate: null,
};

describe('countPlanning', () => {
  it('counts hours, nights, weekends and holidays of the month only', () => {
    const [counters] = countPlanning({
      ...base,
      agents: [agent],
      cells: [
        { agentId: 'A', date: '2026-10-31', shiftTypeId: 'N', countedMinutes: 720 },
        { agentId: 'A', date: '2026-11-01', shiftTypeId: 'J', countedMinutes: 720 }, // Sunday, holiday
        { agentId: 'A', date: '2026-11-03', shiftTypeId: 'N', countedMinutes: 720 },
        { agentId: 'A', date: '2026-11-05', shiftTypeId: 'CA', countedMinutes: 420 },
      ],
    });
    expect(counters).toMatchObject({
      workedMinutes: 1440,
      creditedMinutes: 1860,
      nights: 1,
      weekendDays: 1,
      holidays: 1,
    });
  });

  it('prorates the annual obligation by work-time ratio and contract days', () => {
    const [full, part] = countPlanning({
      ...base,
      agents: [agent, { ...agent, id: 'B', workTimeRatio: 80, startDate: '2026-11-16' }],
      cells: [],
    });
    expect(full!.targetMinutes).toBe(Math.round((1607 * 60 * 30) / 365));
    expect(part!.targetMinutes).toBe(Math.round((1607 * 60 * 0.8 * 15) / 365));
  });
});
