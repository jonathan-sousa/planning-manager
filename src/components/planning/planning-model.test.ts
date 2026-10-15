import { describe, expect, it } from 'vitest';
import type { Violation } from '../../../shared/rules/model';
import {
  coverageText,
  isOffDay,
  isShort,
  monthGap,
  planningModel,
  sortAgents,
  summarizeViolations,
} from './planning-model';
import { agent, cellsOf, grade, gridCell, monthData, shift } from './test-data';

describe('planning model', () => {
  it('orders agents by grade, then name in French', () => {
    const grades = [grade('ide', 'IDE', 0), grade('as', 'AS', 1)];
    const sorted = sortAgents(
      [
        agent('1', 'Martin', 'Léa', 'as'),
        agent('2', 'Étienne', 'Zoé'),
        agent('3', 'Dupont', 'Ana'),
        agent('4', 'Étienne', 'Ali'),
      ],
      grades
    );
    expect(sorted.map((row) => row.id)).toEqual(['3', '4', '2', '1']);
  });

  it('greys weekends and public holidays', () => {
    expect(isOffDay('2026-11-07')).toBe(true); // Saturday
    expect(isOffDay('2026-11-08')).toBe(true); // Sunday
    expect(isOffDay('2026-11-11')).toBe(true); // Armistice
    expect(isOffDay('2026-11-12')).toBe(false);
  });

  it('writes coverage against its minimum, the headcount for a target only', () => {
    expect(coverageText({ count: 1, min: 2 })).toBe('1/2');
    expect(coverageText({ count: 3, min: 0 })).toBe('3');
    expect(isShort({ count: 1, min: 2 })).toBe(true);
    expect(isShort({ count: 2, min: 2 })).toBe(false);
    expect(isShort(undefined)).toBe(false);
  });

  it('lists the hard violations to handle first, then accepted ones, then soft ones', () => {
    const violation = (
      rule: Violation['rule'],
      severity: Violation['severity'],
      date: string
    ): Violation => ({ rule, severity, date, agentId: 'a', message: '' });
    const summary = summarizeViolations(
      [
        violation('WISH', 'SOFT', '2026-11-01'),
        violation('DAILY_REST', 'HARD', '2026-11-05'),
        violation('WEEKLY_REST', 'HARD', '2026-11-02'),
        violation('DAILY_REST', 'HARD', '2026-11-03'),
      ],
      new Set(['a|2026-11-02|WEEKLY_REST'])
    );
    expect(summary).toMatchObject({ openHard: 2, accepted: 1, soft: 1 });
    expect(summary.listed.map((item) => item.date)).toEqual([
      '2026-11-03',
      '2026-11-05',
      '2026-11-02',
      '2026-11-01',
    ]);
  });

  it('derives the month: rows, counters, balances, coverage lines', () => {
    const joly = agent('a', 'Joly', 'Inès');
    const model = planningModel(
      monthData({
        agents: [joly, { ...joly, id: 'gone', endDate: '2026-10-31' }],
        shifts: [shift('j', 'J')],
        needs: [
          {
            id: 'n',
            shiftTypeId: 'j',
            gradeId: 'ide',
            skillId: null,
            dayKind: 'WEEKDAY',
            minCount: 1,
            targetCount: null,
            createdAt: '',
            updatedAt: '',
          },
        ],
        openingBalances: [{ agentId: 'a', minutes: -90 }],
      }),
      cellsOf(gridCell('a', '2026-11-02', 'j'), gridCell('a', '2026-11-03', 'j'))
    );
    expect(model.rows.map((row) => row.id)).toEqual(['a']);
    expect(model.agentName.get('a')).toBe('Joly Inès');
    const count = model.counters.get('a')!;
    expect(count.creditedMinutes).toBe(1440);
    expect(model.openingBalance.get('a')! + monthGap(count)).toBe(-90 + 1440 - 7925);
    expect(model.coverage).toHaveLength(1);
    expect(model.coverage[0]).toMatchObject({ label: 'J IDE' });
    expect(model.coverage[0]!.byDate.get('2026-11-02')).toEqual({ count: 1, min: 1 });
    expect(model.coverage[0]!.byDate.get('2026-11-04')).toEqual({ count: 0, min: 1 });
  });
});
