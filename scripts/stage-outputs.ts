/**
 * Outputs of the stage stack deployed last, read from the CDK outputs file:
 * `cdk-outputs.json` (development stage) unless CDK_OUTPUTS names another
 * (`cdk-outputs.prod.json`, written by `npm run infra:deploy:prod`).
 */
import { readFileSync } from 'node:fs';

export interface StageOutputs {
  stage: string;
  outputs: Record<string, string>;
}

export function readStageOutputs(
  file = process.env.CDK_OUTPUTS ?? 'cdk-outputs.json'
): StageOutputs {
  const all: Record<string, Record<string, string>> = JSON.parse(readFileSync(file, 'utf8'));
  const stackName = Object.keys(all).find((name) => name.startsWith('PlanningManager-'));
  if (!stackName) throw new Error(`No PlanningManager stack in ${file}`);
  return { stage: stackName.slice('PlanningManager-'.length), outputs: all[stackName]! };
}

/** An output of the stage stack; throws when it is missing. */
export function output({ stage, outputs }: StageOutputs, key: string): string {
  const value = outputs[key];
  if (!value) throw new Error(`Missing output ${key} for stage ${stage}`);
  return value;
}
