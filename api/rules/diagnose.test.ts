import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { diagnoseCoverage } from './diagnose';
import type { RuleAgent, RuleInput, RuleSettings, RuleShift } from './model';

const read = <T>(file: string): T =>
  JSON.parse(readFileSync(`fixtures/rule-scenarios/${file}`, 'utf8')) as T;
const shifts = read<Omit<RuleShift, 'id'>[]>('_shifts.json').map((shift) => ({
  ...shift,
  id: shift.code,
}));

const agent = (id: string, extra: Partial<RuleAgent> = {}): RuleAgent => ({
  id,
  firstName: id,
  lastName: '',
  gradeId: 'IDE',
  skillIds: [],
  workTimeRatio: 100,
  nightMode: 'MIXED',
  hoursRegime: 'MIXED_PRORATA',
  startDate: '2020-01-01',
  endDate: null,
  ...extra,
});
const cell = (agentId: string, date: string, code: string) => ({
  agentId,
  date,
  shiftTypeId: code,
  countedMinutes: shifts.find((shift) => shift.code === code)!.countedMinutes,
});

const input: RuleInput = {
  month: '2026-11',
  settings: read<RuleSettings>('_settings.json'),
  shiftTypes: shifts,
  agents: [
    agent('counted'),
    agent('afterNight'),
    agent('onLeave'),
    agent('requested'),
    agent('free'),
    agent('onM'),
    agent('lockedM'),
    agent('nightOnly', { nightMode: 'NIGHT_ONLY' }),
    agent('gone', { endDate: '2026-11-05' }),
    agent('aide', { gradeId: 'AS' }),
  ],
  cells: [
    cell('counted', '2026-11-10', 'J'),
    cell('afterNight', '2026-11-09', 'N'),
    cell('onLeave', '2026-11-10', 'CA'),
    cell('onM', '2026-11-10', 'M'),
    cell('lockedM', '2026-11-10', 'M'),
  ],
  needs: [],
  overrides: [],
  requests: [
    {
      agentId: 'requested',
      startDate: '2026-11-09',
      endDate: '2026-11-11',
      kind: 'ABSENCE_APPROVED',
      shiftTypeId: 'CA',
    },
  ],
};

const slot = { date: '2026-11-10', shiftTypeId: 'J', gradeId: 'IDE', skillId: null };

describe('diagnoseCoverage', () => {
  it('tells what stops each agent of the grade', () => {
    const result = diagnoseCoverage(input, slot, (agentId) => agentId === 'lockedM');
    expect(Object.fromEntries(result.map((c) => [c.agentId, c.status]))).toEqual({
      counted: 'COUNTED',
      afterNight: 'BLOCKED',
      onLeave: 'ABSENT',
      requested: 'ABSENT',
      free: 'AVAILABLE',
      onM: 'ELSEWHERE',
      lockedM: 'LOCKED',
      nightOnly: 'BLOCKED',
      gone: 'OUT_OF_CONTRACT',
    });
    const blockers = (id: string) =>
      result.find((c) => c.agentId === id)!.blockers.map((v) => v.rule);
    expect(blockers('afterNight')).toEqual(['DAILY_REST']);
    expect(blockers('nightOnly')).toEqual(['NIGHT_MODE']);
  });

  it('puts agents without the required skill aside', () => {
    const result = diagnoseCoverage(input, { ...slot, skillId: 'SMUR' }, () => false);
    expect(result.every((c) => c.status === 'NO_SKILL')).toBe(true);
  });

  it('blocks on a rule the placement would break', () => {
    const busy = {
      ...input,
      agents: [agent('tired')],
      cells: ['02', '03', '04', '05', '06'].map((day) => cell('tired', `2026-11-${day}`, 'M')),
    };
    const [tired] = diagnoseCoverage(busy, { ...slot, date: '2026-11-07' }, () => false);
    expect(tired!.status).toBe('BLOCKED');
    expect(tired!.blockers.map((v) => v.rule)).toContain('CONSECUTIVE_DAYS');
  });

  it('ignores hard violations the agent already had', () => {
    const misplaced = {
      ...input,
      agents: [agent('nightOnly', { nightMode: 'NIGHT_ONLY' })],
      cells: [cell('nightOnly', '2026-11-03', 'J')],
    };
    const [nightOnly] = diagnoseCoverage(misplaced, { ...slot, shiftTypeId: 'N' }, () => false);
    expect(nightOnly!.status).toBe('AVAILABLE');
  });
});
