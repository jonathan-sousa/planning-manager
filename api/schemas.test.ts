import { describe, expect, it } from 'vitest';
import { agentInput, agentRequestInput, ruleSettingsInput } from './schemas';

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
};

describe('agentInput', () => {
  it('trims names and deduplicates skills', () => {
    const skill = '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f';
    const parsed = agentInput.parse({ ...agent, skillIds: [skill, skill] });
    expect(parsed.firstName).toBe('Camille');
    expect(parsed.skillIds).toEqual([skill]);
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

  it('requires a shift for a shift wish only', () => {
    expect(agentRequestInput.safeParse(request).success).toBe(true);
    expect(agentRequestInput.safeParse({ ...request, kind: 'WISH_SHIFT' }).success).toBe(false);
    expect(agentRequestInput.safeParse({ ...request, shiftTypeId: agent.gradeId }).success).toBe(
      false
    );
  });
});

describe('ruleSettingsInput', () => {
  it('anchors fortnights on a Monday', () => {
    const shape = ruleSettingsInput.shape.fortnightAnchorDate;
    expect(shape.safeParse('2026-01-05').success).toBe(true);
    expect(shape.safeParse('2026-01-06').success).toBe(false);
  });
});
