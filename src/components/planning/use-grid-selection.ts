import { useState } from 'react';

export type Position = { row: number; col: number };

/**
 * Spreadsheet selection of a rows × columns grid: a focused cell, an anchor
 * (Shift extends from it), and the code being typed in the focused cell.
 */
export function useGridSelection(rowCount: number, colCount: number) {
  const [anchor, setAnchor] = useState<Position>({ row: 0, col: 0 });
  const [focus, setFocus] = useState<Position>({ row: 0, col: 0 });
  const [typed, setTyped] = useState('');

  const bounds = {
    top: Math.min(anchor.row, focus.row),
    bottom: Math.max(anchor.row, focus.row),
    left: Math.min(anchor.col, focus.col),
    right: Math.max(anchor.col, focus.col),
  };
  const isSelected = (row: number, col: number) =>
    row >= bounds.top && row <= bounds.bottom && col >= bounds.left && col <= bounds.right;

  /** Focuses a cell, kept inside the grid; `extend` keeps the anchor. */
  const move = (row: number, col: number, extend = false) => {
    const next = {
      row: Math.max(0, Math.min(rowCount - 1, row)),
      col: Math.max(0, Math.min(colCount - 1, col)),
    };
    setFocus(next);
    if (!extend) setAnchor(next);
    setTyped('');
  };

  return {
    focus,
    bounds,
    single: bounds.top === bounds.bottom && bounds.left === bounds.right,
    isSelected,
    move,
    typed,
    setTyped,
  };
}
