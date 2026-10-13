import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { countedOn } from '../../../api/calendar';
import type { SolveMode } from '../../../api/domain';
import { cellKey, type GridCell } from './use-planning-editor';
import { plannings, type ShiftType } from '@/lib/resources';

const POLL_MS = 2000;

/**
 * A solver run on the month: start it, follow it until it ends, then preview
 * its proposal over the current cells, apply it or discard it.
 */
export function useSolveRun(month: string, cells: Map<string, GridCell>, shifts: ShiftType[]) {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);

  const run = useQuery({
    ...plannings.solveRun(month, runId ?? ''),
    enabled: runId !== null,
    refetchInterval: (query) =>
      ['PENDING', 'RUNNING'].includes(query.state.data?.status ?? 'PENDING') ? POLL_MS : false,
  });

  const start = useMutation({
    mutationFn: (mode: SolveMode) => plannings.solve(month, mode),
    onSuccess: (created) => {
      // The pending run is shown at once, before the first poll.
      queryClient.setQueryData(plannings.solveRun(month, created.id).queryKey, created);
      setRunId(created.id);
    },
    onError: (error) => toast.error(error.message),
  });

  const apply = useMutation({
    mutationFn: () => plannings.applySolveRun(month, runId!),
    onSuccess: async () => {
      // The applied cells replace the preview only once they are loaded.
      await queryClient.invalidateQueries({ queryKey: plannings.query(month).queryKey });
      setRunId(null);
      toast.success('Proposition appliquée');
    },
    onError: (error) => toast.error(error.message),
  });

  const status = run.data?.status;
  const result = status === 'SUCCEEDED' ? run.data?.result : null;

  // The proposal laid over the current cells, and the cells it changes.
  let preview: { cells: Map<string, GridCell>; changed: Set<string> } | null = null;
  if (result) {
    const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));
    const next = new Map(cells);
    const changed = new Set<string>();
    for (const change of result.cells) {
      const key = cellKey(change.agentId, change.date);
      changed.add(key);
      const shift = change.shiftTypeId && shiftById.get(change.shiftTypeId);
      if (change.shiftTypeId) {
        next.set(key, {
          agentId: change.agentId,
          date: change.date,
          shiftTypeId: change.shiftTypeId,
          countedMinutes: shift ? countedOn(change.date, shift) : 0,
          locked: false,
        });
      } else {
        next.delete(key);
      }
    }
    preview = { cells: next, changed };
  }

  return {
    start: (mode: SolveMode) => start.mutate(mode),
    apply: () => apply.mutate(),
    discard: () => setRunId(null),
    running: start.isPending || (!run.isError && (status === 'PENDING' || status === 'RUNNING')),
    applying: apply.isPending,
    failed:
      status === 'FAILED'
        ? (run.data?.error ?? 'Échec du solveur')
        : run.isError
          ? run.error.message
          : null,
    stats: result?.stats ?? null,
    preview,
  };
}
