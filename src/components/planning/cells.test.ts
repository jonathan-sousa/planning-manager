import { describe, expect, it } from 'vitest';
import { withChanges } from './cells';
import { cellsOf, gridCell, shift } from './test-data';

describe('cells', () => {
  it('applies changes to a copy, with counted minutes as the server computes them', () => {
    const night = shift('n', 'N', { startTime: '19:00', endTime: '07:00', isNight: true });
    const cells = cellsOf(gridCell('a', '2026-10-23', 'n'));
    const next = withChanges(
      cells,
      [
        { agentId: 'a', date: '2026-10-23', shiftTypeId: null },
        // The night of 24-25 October 2026 lasts one hour more.
        { agentId: 'a', date: '2026-10-24', shiftTypeId: 'n', locked: true },
      ],
      new Map([[night.id, night]])
    );
    expect([...next.values()]).toEqual([
      { agentId: 'a', date: '2026-10-24', shiftTypeId: 'n', countedMinutes: 780, locked: true },
    ]);
    expect(cells.size).toBe(1);
  });
});
