import { describe, expect, it } from 'vitest';
import { blockText, parsePaste } from './grid-clipboard';

const codes = new Map([
  ['J', { id: 'j' }],
  ['N', { id: 'n' }],
]);
const dates = ['2026-11-02', '2026-11-03'];
// One agent row, two dates; the second date is locked.
const target = (dRow: number, dCol: number) =>
  dRow === 0 && dCol === 0 ? { agentId: 'a', date: dates[dCol]! } : undefined;

describe('grid clipboard', () => {
  it('copies a block as tab-separated lines', () => {
    expect(
      blockText([
        ['J', ''],
        ['N', 'J'],
      ])
    ).toBe('J\t\nN\tJ');
  });

  it('pastes codes on editable cells only, an empty value empties the cell', () => {
    const all = (dRow: number, dCol: number) =>
      dRow < 2 && dCol < 2 ? { agentId: `a${dRow}`, date: dates[dCol]! } : undefined;
    expect(parsePaste(' j\t\r\n\tn\n', all, codes).edits).toEqual([
      { agentId: 'a0', date: '2026-11-02', shiftTypeId: 'j', locked: false },
      { agentId: 'a0', date: '2026-11-03', shiftTypeId: null, locked: false },
      { agentId: 'a1', date: '2026-11-02', shiftTypeId: null, locked: false },
      { agentId: 'a1', date: '2026-11-03', shiftTypeId: 'n', locked: false },
    ]);
    expect(parsePaste('J\tN', target, codes).edits).toHaveLength(1);
  });

  it('reports unknown codes once and leaves their cells', () => {
    const { edits, unknown } = parsePaste('X', target, codes);
    expect(edits).toEqual([]);
    expect(unknown).toEqual(['X']);
  });
});
