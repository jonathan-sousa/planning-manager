import { describe, expect, it } from 'vitest';
import { inContract, planningAgents, violationKey } from './model';

describe('rules model', () => {
  it('bounds a contract by its dates, both included, an open end running on', () => {
    const fixed = { startDate: '2026-11-02', endDate: '2026-11-20' };
    expect(inContract(fixed, '2026-11-01')).toBe(false);
    expect(inContract(fixed, '2026-11-02')).toBe(true);
    expect(inContract(fixed, '2026-11-20')).toBe(true);
    expect(inContract(fixed, '2026-11-21')).toBe(false);
    expect(inContract({ startDate: '2026-11-02', endDate: null }, '2030-01-01')).toBe(true);
  });

  it('identifies an accepted violation by agent, day and rule', () => {
    expect(violationKey({ agentId: 'a', date: '2026-11-03', rule: 'DAILY_REST' })).toBe(
      'a|2026-11-03|DAILY_REST'
    );
  });

  it('puts in the grid the agents under contract, active or holding cells', () => {
    const agent = (id: string, fields: object = {}) => ({
      id,
      startDate: '2020-01-01',
      endDate: null,
      active: true,
      ...fields,
    });
    const agents = [
      agent('active'),
      agent('left', { endDate: '2026-10-31' }),
      agent('arriving', { startDate: '2026-12-01' }),
      agent('leaving', { endDate: '2026-11-15' }),
      agent('inactive', { active: false }),
      agent('inactive-planned', { active: false }),
    ];
    const cells = [
      { agentId: 'inactive-planned', date: '2026-11-04' },
      // A cell in the context days does not bring an inactive agent back.
      { agentId: 'inactive', date: '2026-10-30' },
    ];
    expect(planningAgents(agents, cells, '2026-11').map((item) => item.id)).toEqual([
      'active',
      'leaving',
      'inactive-planned',
    ]);
  });
});
