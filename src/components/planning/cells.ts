// Cells of the planning grid, shared by the editor, the grid, the solver
// review and the exports. Pure: safe to import anywhere.
import { countedOn } from '../../../api/calendar';
import type { RuleShift } from '../../../api/rules/model';

export interface GridCell {
  agentId: string;
  date: string;
  shiftTypeId: string;
  countedMinutes: number;
  locked: boolean;
}

/** Desired state of a cell; `shiftTypeId: null` empties it. */
export interface CellEdit {
  agentId: string;
  date: string;
  shiftTypeId: string | null;
  locked: boolean;
}

export const cellKey = (agentId: string, date: string) => `${agentId}|${date}`;

/**
 * Applies cell changes to a copy of the cells: a shift sets the cell, with
 * its counted minutes as the server will compute them; none empties it.
 */
export function withChanges(
  cells: Map<string, GridCell>,
  changes: { agentId: string; date: string; shiftTypeId: string | null; locked?: boolean }[],
  shiftById: Map<string, RuleShift>
): Map<string, GridCell> {
  const next = new Map(cells);
  for (const { agentId, date, shiftTypeId, locked = false } of changes) {
    const key = cellKey(agentId, date);
    const shift = shiftTypeId && shiftById.get(shiftTypeId);
    if (shiftTypeId) {
      next.set(key, {
        agentId,
        date,
        shiftTypeId,
        countedMinutes: shift ? countedOn(date, shift) : 0,
        locked,
      });
    } else {
      next.delete(key);
    }
  }
  return next;
}
