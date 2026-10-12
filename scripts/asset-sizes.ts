/**
 * Prints the size of each asset referenced by the last `cdk synth`, so stale
 * assets left in cdk.out are not mistaken for the live Lambda bundles.
 *
 * Usage: tsx scripts/asset-sizes.ts [stage]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join } from 'node:path';

const stage = process.argv[2] ?? userInfo().username;
const assets = JSON.parse(
  readFileSync(join('cdk.out', `PlanningManager-${stage}.assets.json`), 'utf8')
) as { files: Record<string, { source: { path: string } }> };

for (const { source } of Object.values(assets.files)) {
  const path = join('cdk.out', source.path);
  if (!statSync(path).isDirectory()) continue;
  const size = execFileSync('du', ['-sh', path], { encoding: 'utf8' }).split('\t')[0];
  console.log(`${size.padStart(6)}  ${source.path}`);
}
