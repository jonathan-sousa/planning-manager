import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkSolverHealth, startSolve } from './solver-client';

const send = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/client-lambda', async (original) => ({
  ...(await original<object>()),
  LambdaClient: class {
    send = send;
  },
}));

const payload = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

beforeEach(() => {
  send.mockReset();
  process.env.SOLVER_FUNCTION_NAME = 'solver-fn';
});

describe('solver client', () => {
  it('starts a run without waiting for it', async () => {
    send.mockResolvedValue({});
    await startSolve('run-1');
    const { input } = send.mock.calls[0]![0] as { input: Record<string, unknown> };
    expect(input).toMatchObject({ FunctionName: 'solver-fn', InvocationType: 'Event' });
    expect(JSON.parse(input.Payload as string)).toEqual({ action: 'solve', runId: 'run-1' });
  });

  it('checks the solver health and its answer', async () => {
    const health = {
      status: 'OPTIMAL',
      ortoolsVersion: '9.15',
      pythonVersion: '3.14.0',
      database: 'ok',
    };
    send.mockResolvedValue({ Payload: payload(health) });
    await expect(checkSolverHealth()).resolves.toEqual(health);

    send.mockResolvedValue({ Payload: payload({ status: 'OPTIMAL' }) });
    await expect(checkSolverHealth()).rejects.toThrow();
  });

  it('reports a solver failure with its message', async () => {
    send.mockResolvedValue({
      FunctionError: 'Unhandled',
      Payload: payload({ errorMessage: 'connection lost' }),
    });
    await expect(checkSolverHealth()).rejects.toThrow('Solver failed: connection lost');
  });
});
