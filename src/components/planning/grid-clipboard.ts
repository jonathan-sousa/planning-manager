// Copy and paste of grid codes, as tab-separated text (spreadsheet format).
import type { CellEdit } from './cells';

/** Codes of a block of cells, rows by line, columns by tab. */
export const blockText = (codes: string[][]) => codes.map((row) => row.join('\t')).join('\n');

/**
 * Edits for pasted text, from the top-left cell of the selection: `target`
 * gives the editable cell at an offset (undefined outside the grid, out of
 * contract or locked), `codes` the active shift types by uppercase code. An
 * empty value empties its cell; unknown codes are left out and reported.
 */
export function parsePaste(
  text: string,
  target: (dRow: number, dCol: number) => { agentId: string; date: string } | undefined,
  codes: Map<string, { id: string }>
): { edits: CellEdit[]; unknown: string[] } {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    // A trailing newline (spreadsheets add one) is not an empty last row.
    .filter((line, index, all) => line || index < all.length - 1)
    .map((line) => line.split('\t'));
  const edits: CellEdit[] = [];
  const unknown = new Set<string>();
  lines.forEach((line, dRow) =>
    line.forEach((raw, dCol) => {
      const cell = target(dRow, dCol);
      if (!cell) return;
      const code = raw.trim().toUpperCase();
      const shift = code ? codes.get(code) : null;
      if (shift === undefined) return void unknown.add(code);
      edits.push({ ...cell, shiftTypeId: shift?.id ?? null, locked: false });
    })
  );
  return { edits, unknown: [...unknown] };
}
