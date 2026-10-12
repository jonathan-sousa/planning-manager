/// <reference types="node" />
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineFunction } from '@aws-amplify/backend';
import { DockerImage, Duration } from 'aws-cdk-lib';
import { Architecture, Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';

const functionDir = path.dirname(fileURLToPath(import.meta.url));

// Bundled locally with uv (no Docker): wheels are resolved for the Lambda
// platform, then the solver package is copied next to them.
export const solver = defineFunction(
  (scope) =>
    new Function(scope, 'solver', {
      runtime: Runtime.PYTHON_3_14,
      architecture: Architecture.ARM_64,
      handler: 'solver.handler.handler',
      memorySize: 6144,
      timeout: Duration.seconds(90),
      retryAttempts: 0,
      code: Code.fromAsset(functionDir, {
        exclude: ['.venv', '.pytest_cache', '.ruff_cache', '**/__pycache__', 'tests'],
        bundling: {
          image: DockerImage.fromRegistry('dummy'),
          local: {
            tryBundle(outputDir: string) {
              const requirements = path.join(outputDir, 'requirements.txt');
              execSync(
                `uv export --frozen --no-dev --no-hashes --no-emit-project -o ${requirements}`,
                {
                  cwd: functionDir,
                  stdio: 'inherit',
                }
              );
              execSync(
                `uv pip install -r ${requirements} --target ${outputDir} --python-version 3.14 --python-platform aarch64-manylinux_2_28 --only-binary=:all:`,
                { cwd: functionDir, stdio: 'inherit' }
              );
              execSync(`cp -R ${path.join(functionDir, 'src', 'solver')} ${outputDir}`);
              return true;
            },
          },
        },
      }),
    })
);
