import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors';
import type { Violation } from './model';
import {
  absenceCells,
  canTransition,
  cellRows,
  contextWindow,
  isInProgress,
  isLost,
  openingBalances,
  openingChangedSincePublication,
  openViolations,
  previousMonthOpen,
} from './planning';

const joly = { id: 'a1', lastName: 'Joly', startDate: '2026-11-02', endDate: '2026-11-20' };
const day = {
  id: 's1',
  code: 'J',
  kind: 'WORK' as const,
  startTime: '07:00',
  endTime: '19:00',
  breakMinutes: 20,
  countedMinutes: 720,
  isNight: false,
  archived: false,
};
const leave = { ...day, id: 's2', code: 'CA', kind: 'ABSENCE' as const, countedMinutes: 420 };
const agents = new Map([[joly.id, joly]]);
const shifts = new Map([day, leave, { ...day, id: 's3', archived: true }].map((s) => [s.id, s]));
const context = { month: '2026-11', updatedBy: 'u', source: 'MANUAL' as const };

describe('planning core', () => {
  it('loads a month with 13 days around it', () => {
    expect(contextWindow('2026-11')).toEqual(['2026-10-19', '2026-12-13']);
  });

  it('validates, publishes and reopens, step by step', () => {
    expect(canTransition('DRAFT', 'VALIDATED')).toBe(true);
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(false);
    expect(canTransition('VALIDATED', 'DRAFT')).toBe(true);
    expect(canTransition('PUBLISHED', 'DRAFT')).toBe(true);
    expect(canTransition('PUBLISHED', 'VALIDATED')).toBe(false);
  });

  it('keeps the hard violations not accepted', () => {
    const violation = (rule: Violation['rule'], severity: Violation['severity']): Violation => ({
      rule,
      severity,
      date: '2026-11-03',
      agentId: 'a1',
      message: '',
    });
    const open = openViolations(
      [
        violation('DAILY_REST', 'HARD'),
        violation('WEEKLY_REST', 'HARD'),
        violation('WISH', 'SOFT'),
      ],
      [{ agentId: 'a1', date: '2026-11-03', rule: 'DAILY_REST' }]
    );
    expect(open.map((item) => item.rule)).toEqual(['WEEKLY_REST']);
  });

  it('tells a run in progress from a lost one', () => {
    const now = Date.parse('2026-11-03T10:00:00Z');
    const run = (status: string, createdAt: string) => ({ status, createdAt });
    expect(isInProgress(run('RUNNING', '2026-11-03T09:58:00Z'), now)).toBe(true);
    expect(isLost(run('RUNNING', '2026-11-03T09:58:00Z'), now)).toBe(false);
    expect(isLost(run('PENDING', '2026-11-03T09:56:00Z'), now)).toBe(true);
    expect(isInProgress(run('PENDING', '2026-11-03T09:56:00Z'), now)).toBe(false);
    expect(isLost(run('SUCCEEDED', '2026-11-03T09:00:00Z'), now)).toBe(false);
  });

  it('turns a cell edit into rows, emptied cells left out', () => {
    expect(
      cellRows(
        [
          { agentId: 'a1', date: '2026-11-03', shiftTypeId: 's1', locked: true },
          { agentId: 'a1', date: '2026-11-04', shiftTypeId: null, locked: false },
        ],
        agents,
        shifts,
        context
      )
    ).toEqual([
      {
        agentId: 'a1',
        date: '2026-11-03',
        month: '2026-11',
        shiftTypeId: 's1',
        countedMinutes: 720,
        locked: true,
        source: 'MANUAL',
        updatedBy: 'u',
      },
    ]);
  });

  it('refuses an unknown agent, a day outside the contract, an archived shift', () => {
    const refusal = (cell: { agentId: string; date: string; shiftTypeId: string | null }) => {
      try {
        cellRows([{ ...cell, locked: false }], agents, shifts, context);
      } catch (error) {
        return error instanceof ValidationError ? error.fields.cells?.[0] : error;
      }
    };
    expect(refusal({ agentId: 'x', date: '2026-11-03', shiftTypeId: 's1' })).toBe('Agent inconnu');
    expect(refusal({ agentId: 'a1', date: '2026-11-01', shiftTypeId: null })).toBe(
      'Hors contrat : Joly le 2026-11-01'
    );
    expect(refusal({ agentId: 'a1', date: '2026-11-03', shiftTypeId: 's3' })).toBe(
      'Poste inconnu ou archivé'
    );
  });

  it('posts approved absences on the days of the month within the contract', () => {
    const rows = absenceCells(
      [{ agentId: 'a1', startDate: '2026-10-28', endDate: '2026-11-03', shiftTypeId: 's2' }],
      agents,
      shifts,
      { month: '2026-11', updatedBy: 'u' }
    );
    expect(rows.map((row) => [row.date, row.locked, row.source, row.countedMinutes])).toEqual([
      ['2026-11-02', true, 'REQUEST', 420],
      ['2026-11-03', true, 'REQUEST', 420],
    ]);
  });

  it('opens balances with the initial balance plus the carried gaps', () => {
    expect(
      openingBalances(
        [
          { id: 'a1', initial: 60 },
          { id: 'a2', initial: -30 },
        ],
        [{ agentId: 'a1', minutes: -150 }]
      )
    ).toEqual([
      { agentId: 'a1', minutes: -90 },
      { agentId: 'a2', minutes: -30 },
    ]);
  });

  it('flags a previous month still open, and an opening changed since publication', () => {
    expect(previousMonthOpen(undefined)).toBe(false);
    expect(previousMonthOpen({ status: 'VALIDATED' })).toBe(true);
    expect(previousMonthOpen({ status: 'PUBLISHED' })).toBe(false);

    const published = '2026-12-03 09:00:00+00';
    expect(openingChangedSincePublication(null, '2026-12-04 09:00:00+00')).toBe(false);
    expect(openingChangedSincePublication(published, null)).toBe(false);
    expect(openingChangedSincePublication(published, '2026-12-02 09:00:00+00')).toBe(false);
    expect(openingChangedSincePublication(published, '2026-12-04 09:00:00+00')).toBe(true);
  });
});
