// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CellEdit } from './cells';
import { shift } from './test-data';
import { usePlanningEditor } from './use-planning-editor';
import { ApiRequestError } from '@/lib/api-client';
import type { MonthPlanning } from '@/lib/resources';

vi.mock('@/config', () => ({ config: { apiUrl: 'http://api.test' } }));
const { writeCells, toastError } = vi.hoisted(() => ({
  writeCells: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('@/lib/resources', async (original) => ({
  ...(await original<object>()),
  plannings: { query: (month: string) => ({ queryKey: ['plannings', month] }), writeCells },
}));
vi.mock('sonner', () => ({ toast: { error: toastError } }));

const shifts = [shift('j', 'J'), shift('n', 'N', { startTime: '19:00', endTime: '07:00' })];

const month = (version: number, assignments: MonthPlanning['assignments'] = []) =>
  ({
    planning: { month: '2026-11', status: 'DRAFT', version },
    assignments,
    acceptedViolations: [],
    balances: { opening: [], previousMonthOpen: false, openingChangedSincePublication: false },
  }) as unknown as MonthPlanning;

const row = (date: string, shiftTypeId: string, countedMinutes = 720) =>
  ({
    agentId: 'a',
    date,
    shiftTypeId,
    countedMinutes,
    locked: false,
  }) as MonthPlanning['assignments'][number];

const edit = (date: string, shiftTypeId: string | null): CellEdit => ({
  agentId: 'a',
  date,
  shiftTypeId,
  locked: false,
});

/** Answers each save with the next version and the rows written. */
const answerSaves = () =>
  writeCells.mockImplementation(
    async (_month: string, { version, cells }: { version: number; cells: CellEdit[] }) => ({
      version: version + 1,
      assignments: cells
        .filter((cell) => cell.shiftTypeId)
        .map((cell) => row(cell.date, cell.shiftTypeId!, 700)),
    })
  );

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const render = (data = month(3)) =>
  renderHook((props) => usePlanningEditor('2026-11', props.data, shifts), {
    wrapper,
    initialProps: { data },
  });
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const codes = (cells: Map<string, { date: string; shiftTypeId: string }>) =>
  [...cells.values()].map((cell) => `${cell.date}:${cell.shiftTypeId}`).sort();

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  queryClient = new QueryClient();
});
afterEach(() => vi.useRealTimers());

describe('usePlanningEditor', () => {
  it('shows an edit at once, saves it in the background with the version', async () => {
    answerSaves();
    const { result } = render();
    act(() => result.current.apply([edit('2026-11-02', 'j')]));
    expect(codes(result.current.cells)).toEqual(['2026-11-02:j']);
    expect(result.current.cells.get('a|2026-11-02')!.countedMinutes).toBe(720);
    expect(result.current.saving).toBe(true);
    expect(writeCells).not.toHaveBeenCalled();

    await wait(400);
    expect(writeCells).toHaveBeenCalledWith('2026-11', {
      version: 3,
      cells: [edit('2026-11-02', 'j')],
    });
    // The server's counted minutes replace the local guess.
    expect(result.current.cells.get('a|2026-11-02')!.countedMinutes).toBe(700);
    expect(result.current.saving).toBe(false);
  });

  it('batches the edits of 400 ms, one request at a time, each with the new version', async () => {
    let release!: () => void;
    writeCells.mockImplementationOnce(async (_month, { version, cells }) => {
      await new Promise<void>((resolve) => (release = resolve));
      return { version: version + 1, assignments: cells.map((c: CellEdit) => row(c.date, 'j')) };
    });
    const { result } = render();
    act(() => result.current.apply([edit('2026-11-02', 'j')]));
    await wait(200);
    act(() => result.current.apply([edit('2026-11-03', 'j')]));
    await wait(400);
    expect(writeCells).toHaveBeenCalledTimes(1);
    expect(writeCells.mock.calls[0]![1].cells).toHaveLength(2);

    answerSaves();
    act(() => result.current.apply([edit('2026-11-04', 'n')]));
    await wait(400);
    // Still in flight: the third edit waits.
    expect(writeCells).toHaveBeenCalledTimes(1);
    await act(async () => release());
    await wait(0);
    expect(writeCells).toHaveBeenCalledTimes(2);
    expect(writeCells.mock.calls[1]![1]).toEqual({
      version: 4,
      cells: [edit('2026-11-04', 'n')],
    });
  });

  it('keeps a newer local edit of a cell while an older one is being saved', async () => {
    let release!: () => void;
    writeCells.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => (release = resolve));
      return { version: 4, assignments: [row('2026-11-02', 'j')] };
    });
    const { result } = render();
    act(() => result.current.apply([edit('2026-11-02', 'j')]));
    await wait(400);
    answerSaves();
    act(() => result.current.apply([edit('2026-11-02', 'n')]));
    await act(async () => release());
    expect(result.current.cells.get('a|2026-11-02')!.shiftTypeId).toBe('n');
  });

  it('reloads the month when a save is refused, and forgets the undo history', async () => {
    writeCells.mockRejectedValueOnce(
      new ApiRequestError(409, { error: 'Le planning a été modifié entre-temps' })
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = render();
    act(() => result.current.apply([edit('2026-11-02', 'j')]));
    await wait(400);
    expect(toastError).toHaveBeenCalledWith('Le planning a été modifié entre-temps');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['plannings', '2026-11'] });
    act(() => result.current.undo());
    await wait(400);
    expect(writeCells).toHaveBeenCalledTimes(1);
  });

  it('undoes the last edit, and saves the undo', async () => {
    answerSaves();
    const { result } = render(month(3, [row('2026-11-02', 'n')]));
    act(() => result.current.apply([edit('2026-11-02', 'j'), edit('2026-11-03', 'j')]));
    act(() => result.current.undo());
    expect(codes(result.current.cells)).toEqual(['2026-11-02:n']);
    await wait(400);
    expect(writeCells).toHaveBeenCalledTimes(1);
    expect(writeCells.mock.calls[0]![1].cells).toEqual([
      edit('2026-11-02', 'n'),
      edit('2026-11-03', null),
    ]);
  });

  it('takes a refetched month, unless edits are waiting', async () => {
    answerSaves();
    const { result, rerender } = render();
    rerender({ data: month(5, [row('2026-11-10', 'n')]) });
    expect(codes(result.current.cells)).toEqual(['2026-11-10:n']);

    act(() => result.current.apply([edit('2026-11-02', 'j')]));
    rerender({ data: month(6, []) });
    expect(codes(result.current.cells)).toEqual(['2026-11-02:j', '2026-11-10:n']);
    await wait(400);
    expect(writeCells.mock.calls[0]![1].version).toBe(5);
  });

  it('saves what is left when the page closes', async () => {
    answerSaves();
    const { result, unmount } = render();
    act(() => result.current.apply([edit('2026-11-02', 'j')]));
    unmount();
    expect(writeCells).toHaveBeenCalledTimes(1);
  });
});
