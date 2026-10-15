import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { z } from 'zod';

const lambda = new LambdaClient({});

export const solverHealth = z.object({
  status: z.string(),
  ortoolsVersion: z.string(),
  pythonVersion: z.string(),
  database: z.string(),
});
export type SolverHealth = z.infer<typeof solverHealth>;

async function invoke(payload: Record<string, unknown>): Promise<unknown> {
  const { Payload, FunctionError } = await lambda.send(
    new InvokeCommand({
      FunctionName: process.env.SOLVER_FUNCTION_NAME,
      Payload: JSON.stringify(payload),
    })
  );
  const body = Payload ? JSON.parse(Buffer.from(Payload).toString()) : undefined;
  if (FunctionError) {
    throw new Error(`Solver failed: ${body?.errorMessage ?? FunctionError}`);
  }
  return body;
}

/** Starts a solve run without waiting: the solver writes its result to the run. */
export async function startSolve(runId: string): Promise<void> {
  await lambda.send(
    new InvokeCommand({
      FunctionName: process.env.SOLVER_FUNCTION_NAME,
      InvocationType: 'Event',
      Payload: JSON.stringify({ action: 'solve', runId }),
    })
  );
}

export async function checkSolverHealth(): Promise<SolverHealth> {
  return solverHealth.parse(await invoke({ action: 'health' }));
}
