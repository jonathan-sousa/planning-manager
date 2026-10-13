import { describe, expect, it } from 'vitest';
import { buildPdf, type PlanningExport, toCsv } from './export';
import type { Agent, ShiftType } from '@/lib/resources';

const shift = (id: string, code: string, label: string, extra: Partial<ShiftType> = {}) =>
  ({
    id,
    code,
    label,
    kind: 'WORK',
    startTime: '07:00',
    endTime: '19:00',
    breakMinutes: 20,
    countedMinutes: 720,
    isNight: false,
    color: '#f59e0b',
    archived: false,
    ...extra,
  }) as ShiftType;
const agent = (id: string, lastName: string, firstName: string) =>
  ({
    id,
    lastName,
    firstName,
    gradeId: 'g',
    startDate: '2020-01-01',
    endDate: null,
  }) as Agent;

const data: PlanningExport = {
  month: '2026-11',
  status: 'DRAFT',
  dates: ['2026-11-01', '2026-11-02'],
  agents: [agent('a', 'Dupont', 'Jean'), agent('b', "L'Hôte; Martin", 'Léa')],
  gradeCode: new Map([['g', 'IDE']]),
  shifts: [
    shift('J', 'J', 'Jour'),
    shift('CA', 'CA', 'Congé annuel', {
      kind: 'ABSENCE',
      startTime: null,
      endTime: null,
      countedMinutes: 420,
    }),
  ],
  cells: new Map([
    [
      'a|2026-11-01',
      { agentId: 'a', date: '2026-11-01', shiftTypeId: 'J', countedMinutes: 780, locked: false },
    ],
    [
      'b|2026-11-02',
      { agentId: 'b', date: '2026-11-02', shiftTypeId: 'CA', countedMinutes: 420, locked: true },
    ],
  ]),
  counters: new Map(),
  coverage: [
    {
      label: 'J IDE',
      slot: { shiftTypeId: 'J', gradeId: 'g', skillId: null },
      byDate: new Map([['2026-11-02', { count: 0, min: 2 }]]),
    },
  ],
};

describe('planning exports', () => {
  it('writes one CSV line per cell, for Excel in French', () => {
    const csv = toCsv(data);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')).toEqual([
      '﻿Nom;Prénom;Grade;Date;Code;Libellé;Début;Fin;Heures',
      'Dupont;Jean;IDE;2026-11-01;J;Jour;07:00;19:00;13,00',
      '"L\'Hôte; Martin";Léa;IDE;2026-11-02;CA;Congé annuel;;;7,00',
      '',
    ]);
  });

  it('builds an A3 landscape PDF', async () => {
    const doc = await buildPdf(data);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(420);
  });
});
