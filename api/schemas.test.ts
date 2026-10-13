import { describe, expect, it } from 'vitest';
import { agentInput, agentRequestInput, ruleSettingsInput, shiftTypeInput } from './schemas';

const agent = {
  firstName: ' Camille ',
  lastName: 'Martin',
  gradeId: '0b7f6a52-3c0e-4a8e-9a43-2f3a1f9c2b10',
  skillIds: [],
  workTimeRatio: 80,
  nightMode: 'MIXED',
  hoursRegime: 'MIXED_PRORATA',
  active: true,
  startDate: '2026-01-01',
  endDate: null,
  initialBalanceMinutes: -90,
};

describe('agentInput', () => {
  it('trims names and deduplicates skills', () => {
    const skill = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f';
    const parsed = agentInput.parse({ ...agent, skillIds: [skill, skill] });
    expect(parsed.firstName).toBe('Camille');
    expect(parsed.skillIds).toEqual([skill]);
  });

  it('reports cross-field errors together with field errors', () => {
    const result = agentInput.safeParse({ ...agent, firstName: '', endDate: '2025-12-31' });
    const paths = result.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(['firstName', 'endDate']);
  });

  it('rejects an end date before the start date', () => {
    const result = agentInput.safeParse({ ...agent, endDate: '2025-12-31' });
    expect(result.error?.issues[0]?.path).toEqual(['endDate']);
  });
});

describe('agentRequestInput', () => {
  const request = {
    agentId: agent.gradeId,
    startDate: '2026-03-02',
    endDate: '2026-03-02',
    kind: 'WISH_OFF',
    shiftTypeId: null,
    comment: null,
  };

  it('requires a shift except for a day-off wish', () => {
    const shift = { shiftTypeId: agent.gradeId };
    expect(agentRequestInput.safeParse(request).success).toBe(true);
    expect(agentRequestInput.safeParse({ ...request, ...shift }).success).toBe(false);
    expect(agentRequestInput.safeParse({ ...request, kind: 'WISH_SHIFT' }).success).toBe(false);
    expect(agentRequestInput.safeParse({ ...request, kind: 'WISH_SHIFT', ...shift }).success).toBe(
      true
    );
    expect(
      agentRequestInput.safeParse({ ...request, kind: 'ABSENCE_APPROVED', ...shift }).success
    ).toBe(true);
  });
});

describe('ruleSettingsInput', () => {
  it('anchors fortnights on a Monday', () => {
    const shape = ruleSettingsInput.shape.fortnightAnchorDate;
    expect(shape.safeParse('2026-01-05').success).toBe(true);
    expect(shape.safeParse('2026-01-06').success).toBe(false);
  });
});

describe('shiftTypeInput', () => {
  const night = {
    code: 'N',
    label: 'Nuit',
    kind: 'WORK',
    startTime: '19:00',
    endTime: '07:00',
    breakMinutes: 20,
    countedMinutes: 720,
    isNight: true,
    color: '#4f46e5',
    archived: false,
  };
  const errors = (input: unknown) =>
    shiftTypeInput.safeParse(input).error?.issues.map((issue) => issue.path[0]);

  it('accepts a consistent night shift', () => {
    expect(shiftTypeInput.safeParse(night).success).toBe(true);
  });

  it('requires the night flag across midnight, and a break shorter than the shift', () => {
    expect(errors({ ...night, isNight: false })).toEqual(['isNight']);
    expect(errors({ ...night, endTime: '19:00' })).toEqual(['endTime']);
    expect(errors({ ...night, startTime: '07:00', endTime: '07:20', isNight: false })).toEqual([
      'breakMinutes',
    ]);
  });

  it('does not treat a shift ending at 00:00 as crossing midnight', () => {
    expect(
      errors({ ...night, startTime: '14:00', endTime: '00:00', isNight: false })
    ).toBeUndefined();
  });

  it('keeps hours, break and night flag for work shifts only', () => {
    const absence = { ...night, kind: 'ABSENCE', countedMinutes: 420 };
    expect(errors(absence)).toEqual(['startTime', 'endTime', 'breakMinutes', 'isNight']);
  });
});
