// Cells of the planning grid, shared by the editor, the grid, the solver
// review and the exports. No dependency: safe to import anywhere.

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
