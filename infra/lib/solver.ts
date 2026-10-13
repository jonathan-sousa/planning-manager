import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { DockerImage, Duration, type RemovalPolicy } from 'aws-cdk-lib';
import { Architecture, Code, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import type { Database } from './database';

export interface SolverProps {
  readonly database: Database;
  readonly removalPolicy: RemovalPolicy;
}

const solverDir = path.resolve(import.meta.dirname, '../../solver');

/**
 * OR-Tools CP-SAT solver, Python on ARM64. Bundled locally with uv (no
 * Docker): wheels are resolved for the Lambda platform, then the `solver`
 * package is copied next to them.
 */
export class Solver extends Construct {
  readonly function: LambdaFunction;

  constructor(scope: Construct, id: string, props: SolverProps) {
    super(scope, id);

    this.function = new LambdaFunction(this, 'Function', {
      runtime: Runtime.PYTHON_3_14,
      architecture: Architecture.ARM_64,
      handler: 'solver.handler.handler',
      memorySize: 6144,
      timeout: Duration.seconds(90),
      retryAttempts: 0,
      logGroup: new LogGroup(this, 'LogGroup', {
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: props.removalPolicy,
      }),
      environment: {
        DATABASE_ENDPOINT: props.database.cluster.clusterEndpoint,
      },
      code: Code.fromAsset(solverDir, {
        exclude: ['.venv', '.pytest_cache', '.ruff_cache', '**/__pycache__', 'tests'],
        bundling: {
          image: DockerImage.fromRegistry('dummy'),
          local: {
            tryBundle(outputDir: string) {
              // The export already pins every transitive dependency, so the
              // install runs with --no-deps and the AWS SDK (boto3, botocore,
              // s3transfer, jmespath) is dropped: the Python runtime ships it,
              // and the solver would otherwise exceed the 250 MB limit.
              const exported = path.join(outputDir, 'requirements.full.txt');
              const requirements = path.join(outputDir, 'requirements.txt');
              execSync(
                `uv export --frozen --no-dev --no-hashes --no-emit-project --color never -o ${exported}`,
                { cwd: solverDir, stdio: 'inherit' }
              );
              execSync(
                `grep -vE '^(boto3|botocore|s3transfer|jmespath)==' ${exported} > ${requirements} && rm ${exported}`,
                { stdio: 'inherit' }
              );
              execSync(
                `uv pip install -r ${requirements} --no-deps --target ${outputDir} --python-version 3.14 --python-platform aarch64-manylinux_2_28 --only-binary=:all:`,
                { cwd: solverDir, stdio: 'inherit' }
              );
              execSync(`cp -R ${path.join(solverDir, 'src', 'solver')} ${outputDir}`);
              return true;
            },
          },
        },
      }),
    });

    // Connects as the `solver` database role (migration 0006), mapped to this
    // function's IAM role by `npm run db:migrate`.
    props.database.cluster.grantConnect(this.function);
  }
}
