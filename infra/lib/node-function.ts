import * as path from 'node:path';
import { Duration, type RemovalPolicy } from 'aws-cdk-lib';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

export interface NodeFunctionProps {
  /** Entry file, relative to the repository root (`api/…`). */
  readonly entry: string;
  readonly environment: Record<string, string>;
  readonly removalPolicy: RemovalPolicy;
  readonly memorySize?: number;
  readonly timeout?: Duration;
  /** Construct id of the log group (kept stable for existing stacks). */
  readonly logGroupId?: string;
}

/** A Lambda of the `api/` code: Node 24 on ARM64, bundled as ESM, logs kept a month. */
export function nodeFunction(scope: Construct, id: string, props: NodeFunctionProps) {
  return new NodejsFunction(scope, id, {
    entry: path.resolve(import.meta.dirname, '../..', props.entry),
    runtime: Runtime.NODEJS_24_X,
    architecture: Architecture.ARM_64,
    memorySize: props.memorySize ?? 512,
    timeout: props.timeout ?? Duration.seconds(30),
    logGroup: new LogGroup(scope, props.logGroupId ?? `${id}LogGroup`, {
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: props.removalPolicy,
    }),
    environment: props.environment,
    bundling: {
      format: OutputFormat.ESM,
      mainFields: ['module', 'main'],
      // AWS SDK v3 ships with the Node runtime; `pg-native` is an optional
      // native binding `pg` probes for.
      externalModules: ['@aws-sdk/*', '@smithy/*', 'pg-native'],
      // CommonJS dependencies bundled into ESM still call `require`.
      banner:
        "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  });
}
