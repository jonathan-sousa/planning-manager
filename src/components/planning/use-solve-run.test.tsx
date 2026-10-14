// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cellsOf, gridCell, shift } from './test-data';
import { useSolveRun } from './use-solve-run';

vi.mock('@/config', () => ({ config: { apiUrl: 'http://api.test' } }));
const { solve, getRun, applySolveRun } = vi.hoisted(() => ({
  solve: vi.fn(),
  getRun: vi.fn(),
  applySolveRun: vi.fn(),
}));
vi.mock('@/lib/resources', async (original) => ({
  ...(await original<object>()),
  plannings: {
    query: (month: string) => ({ queryKey: ['plannings', month] }),
    solve,
    solveRun: (_month: string, id: string) => ({
      queryKey: ['solve-runs', id],
      queryFn: () => getRun(id),
    }),
    applySolveRun,
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const shifts = [shift('j', 'J'), shift('n', 'N')];
const cells = cellsOf(gridCell('a', '2026-11-02', 'j'), gridCell('a', '2026-11-03', 'j'));
const run = (status: string, fields: object = {}) => ({ id: 'r', status, ...fields });
const proposal = {
  cells: [
    { agentId: 'a', date: '2026-11-03', shiftTypeId: null },
    { agentId: 'a', date: '2026-11-04', shiftTypeId: 'n' },
  ],
  stats: { coverage: 0 },
};

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const render = () => renderHook(() => useSolveRun('2026-11', cells, shifts), { wrapper });
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  queryClient = new QueryClient();
});
afterEach(() => vi.useRealTimers());

describe('useSolveRun', () => {
  it('follows a run every 2 s, then previews its proposal over the cells', async () => {
    solve.mockResolvedValue(run('PENDING'));
    getRun
      .mockResolvedValueOnce(run('RUNNING'))
      .mockResolvedValue(run('SUCCEEDED', { result: proposal }));
    const { result } = render();
    expect(result.current.running).toBe(false);

    await act(async () => result.current.start('COMPLETE'));
    expect(solve).toHaveBeenCalledWith('2026-11', 'COMPLETE');
    expect(result.current.running).toBe(true);
    expect(result.current.preview).toBeNull();

    await wait(2000);
    expect(result.current.running).toBe(true);
    await wait(2000);
    expect(result.current.running).toBe(false);
    const calls = getRun.mock.calls.length;
    await wait(6000);
    expect(getRun.mock.calls.length).toBe(calls);

    const preview = result.current.preview!;
    expect([...preview.cells.keys()].sort()).toEqual(['a|2026-11-02', 'a|2026-11-04']);
    expect(preview.changed).toEqual(new Set(['a|2026-11-03', 'a|2026-11-04']));
    expect(result.current.stats).toEqual({ coverage: 0 });
  });

  it('reports a failed run, and discards it', async () => {
    solve.mockResolvedValue(run('PENDING'));
    getRun.mockResolvedValue(run('FAILED', { error: "Le solveur n'a pas répondu à temps" }));
    const { result } = render();
    await act(async () => result.current.start('REOPTIMIZE'));
    await wait(2000);
    expect(result.current.failed).toBe("Le solveur n'a pas répondu à temps");
    expect(result.current.running).toBe(false);
    act(() => result.current.discard());
    expect(result.current.failed).toBeNull();
  });

  it('applies the proposal, then reloads the month', async () => {
    solve.mockResolvedValue(run('SUCCEEDED', { result: proposal }));
    applySolveRun.mockResolvedValue({ version: 4 });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = render();
    await act(async () => result.current.start('COMPLETE'));
    expect(result.current.preview).not.toBeNull();
    await act(async () => result.current.apply());
    await wait(0);
    expect(applySolveRun).toHaveBeenCalledWith('2026-11', 'r');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['plannings', '2026-11'] });
    expect(result.current.preview).toBeNull();
  });
});
