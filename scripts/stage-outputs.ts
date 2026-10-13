/**
 * Outputs of a stage stack, read from `cdk-outputs.<stage>.json` (written by
 * `npm run infra:deploy`). The stage comes from STAGE, or is the developer's
 * personal stage.
 */
import { readFileSync } from 'node:fs';
import { resolveStage } from '../infra/lib/stage';

export interface StageOutputs {
  stage: string;
  outputs: Record<string, string>;
}

export const outputsFile = (stage: string) => `cdk-outputs.${stage}.json`;

export function readStageOutputs(stage = resolveStage(process.env.STAGE)): StageOutputs {
  const all: Record<string, Record<string, string>> = JSON.parse(
    readFileSync(outputsFile(stage), 'utf8')
  );
  const outputs = all[`PlanningManager-${stage}`];
  if (!outputs) throw new Error(`No PlanningManager-${stage} stack in ${outputsFile(stage)}`);
  return { stage, outputs };
}

/** An output of the stage stack; throws when it is missing. */
export function output({ stage, outputs }: StageOutputs, key: string): string {
  const value = outputs[key];
  if (!value) throw new Error(`Missing output ${key} for stage ${stage}`);
  return value;
}
