import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { type SolveMode, UNFINISHED_SOLVE_STATUSES } from '../../../shared/domain';
import { cellKey, type GridCell, withChanges } from './cells';
import { invalidatePlanning, plannings, type ShiftType } from '@/lib/resources';

const POLL_MS = 2000;

const unfinished = (status: string | undefined) =>
  (UNFINISHED_SOLVE_STATUSES as readonly string[]).includes(status ?? '');

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
      unfinished(query.state.data?.status ?? 'PENDING') ? POLL_MS : false,
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
      await invalidatePlanning(queryClient, month);
      setRunId(null);
      toast.success('Proposition appliquée');
    },
    onError: (error) => toast.error(error.message),
  });

  const status = run.data?.status;
  const result = status === 'SUCCEEDED' ? run.data?.result : null;

  // The proposal laid over the current cells, and the cells it changes.
  const preview = useMemo(
    () =>
      result
        ? {
            cells: withChanges(
              cells,
              result.cells,
              new Map(shifts.map((shift) => [shift.id, shift]))
            ),
            changed: new Set(result.cells.map((change) => cellKey(change.agentId, change.date))),
          }
        : null,
    [result, cells, shifts]
  );

  return {
    start: (mode: SolveMode) => start.mutate(mode),
    apply: () => apply.mutate(),
    discard: () => setRunId(null),
    running: start.isPending || (!run.isError && unfinished(status)),
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
