// End to end: the Python solver fills a month of the fictional department,
// then the TypeScript validator must find no hard violation in its proposal.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countedOn } from '../api/calendar';
import type { RuleInput } from '../api/rules/model';
import { coverage, validatePlanning } from '../api/rules/validate';
import { buildSeed } from './seed/build';
import { solve } from './solve';

const settings = JSON.parse(readFileSync('fixtures/rule-scenarios/_settings.json', 'utf8'));

describe('solver', () => {
  it('proposes a month without hard violations', { timeout: 120_000 }, () => {
    const month = '2026-11';
    const seed = buildSeed('2026-10');
    const skillIds = Map.groupBy(seed.agentSkills, (link) => link.agentId);
    const input: RuleInput = {
      month,
      settings,
      agents: seed.agents
        .filter((agent) => agent.active)
        .map((agent) => ({
          ...agent,
          skillIds: (skillIds.get(agent.id) ?? []).map((link) => link.skillId),
        })),
      shiftTypes: seed.shiftTypes,
      cells: [],
      needs: seed.coverageNeeds,
      overrides: seed.coverageOverrides,
      requests: seed.agentRequests,
    };

    const result = solve([{ ...input, mode: 'COMPLETE', timeLimitSeconds: 20 }])[0]!;
    const shiftById = new Map<string, (typeof seed.shiftTypes)[number]>(
      seed.shiftTypes.map((shift) => [shift.id, shift])
    );
    const cells = result.cells.flatMap((cell) =>
      cell.shiftTypeId
        ? [
            {
              ...cell,
              shiftTypeId: cell.shiftTypeId,
              countedMinutes: countedOn(cell.date, shiftById.get(cell.shiftTypeId)!),
            },
          ]
        : []
    );
    const proposal = { ...input, cells };
    const hard = validatePlanning(proposal).filter((violation) => violation.severity === 'HARD');
    const short = coverage(proposal).reduce(
      (sum, slot) => sum + Math.max(0, slot.minCount - slot.count),
      0
    );

    expect(result.stats.hard).toBe(0);
    expect(hard, JSON.stringify(hard.slice(0, 5))).toEqual([]);
    expect(short).toBe(result.stats.coverage);
  });
});
