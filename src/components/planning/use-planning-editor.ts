import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { type CellEdit, cellKey, type GridCell, withChanges } from './cells';
import { ApiRequestError } from '@/lib/api-client';
import {
  type Assignment,
  invalidatePlanning,
  type MonthPlanning,
  plannings,
  type ShiftType,
} from '@/lib/resources';

const SAVE_DELAY_MS = 400;

const toGridCell = (row: Assignment): GridCell => ({
  agentId: row.agentId,
  date: row.date,
  shiftTypeId: row.shiftTypeId,
  countedMinutes: row.countedMinutes,
  locked: row.locked,
});

/**
 * Local copy of a month's cells, edited optimistically and saved in the
 * background: edits are batched, sent with the planning version, and the
 * server's rows (exact counted minutes) replace the local guess. A stale
 * version reloads the month.
 */
export function usePlanningEditor(month: string, data: MonthPlanning, shifts: ShiftType[]) {
  const queryClient = useQueryClient();
  const shiftById = useMemo(() => new Map(shifts.map((shift) => [shift.id, shift])), [shifts]);
  const [cells, setCells] = useState(
    () => new Map(data.assignments.map((row) => [cellKey(row.agentId, row.date), toGridCell(row)]))
  );
  const [saving, setSaving] = useState(false);
  // Latest cells, read by event handlers without waiting for a render.
  const cellsRef = useRef(cells);
  const version = useRef(data.planning?.version ?? 0);
  const pending = useRef(new Map<string, CellEdit>());
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const undoStack = useRef<CellEdit[][]>([]);

  // A refetched month (another tab, a reload after a conflict) replaces the
  // local copy, unless edits are still waiting to be saved.
  useEffect(() => {
    if (pending.current.size || inFlight.current) return;
    version.current = data.planning?.version ?? 0;
    const fresh = new Map(
      data.assignments.map((row) => [cellKey(row.agentId, row.date), toGridCell(row)])
    );
    cellsRef.current = fresh;
    setCells(fresh);
  }, [data]);

  const reload = useCallback(() => invalidatePlanning(queryClient, month), [queryClient, month]);

  /** Sends the pending edits, batch after batch, one request at a time. */
  const flush = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      while (pending.current.size) {
        const batch = [...pending.current.values()];
        pending.current = new Map();
        const saved = await plannings.writeCells(month, { version: version.current, cells: batch });
        version.current = saved.version;
        const next = new Map(cellsRef.current);
        for (const row of saved.assignments) {
          const key = cellKey(row.agentId, row.date);
          // A newer local edit of the same cell wins until it is saved too.
          if (!pending.current.has(key)) next.set(key, toGridCell(row));
        }
        cellsRef.current = next;
        setCells(next);
      }
    } catch (error) {
      pending.current = new Map();
      undoStack.current = [];
      toast.error(error instanceof ApiRequestError ? error.message : 'Enregistrement impossible');
      await reload();
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [month, reload]);

  /** Applies edits locally and schedules their saving. */
  const apply = useCallback(
    (edits: CellEdit[], { recordUndo = true } = {}) => {
      if (edits.length === 0) return;
      const current = cellsRef.current;
      const previous = edits.map(({ agentId, date }): CellEdit => {
        const before = current.get(cellKey(agentId, date));
        return {
          agentId,
          date,
          shiftTypeId: before?.shiftTypeId ?? null,
          locked: before?.locked ?? false,
        };
      });
      for (const edit of edits) pending.current.set(cellKey(edit.agentId, edit.date), edit);
      const next = withChanges(current, edits, shiftById);
      if (recordUndo) undoStack.current.push(previous);
      cellsRef.current = next;
      setCells(next);
      // Saving from now on: the solver and status buttons wait for the flush.
      setSaving(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush, shiftById]
  );

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (previous) apply(previous, { recordUndo: false });
  }, [apply]);

  // Saves what is left when leaving the page.
  useEffect(() => () => void flush(), [flush]);

  return { cells, apply, undo, saving };
}
