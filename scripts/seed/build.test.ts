import { describe, expect, it } from 'vitest';
import { buildSeed } from './build';

describe('buildSeed', () => {
  it('validates every row and resolves every reference', () => {
    const seed = buildSeed('2026-10');
    expect(seed.agents).toHaveLength(27);
    expect(seed.agentRequests.every((request) => request.startDate.startsWith('2026-11'))).toBe(
      true
    );
  });

  it('rolls dated rows over to the next year in December', () => {
    expect(buildSeed('2026-12').coverageOverrides[0]?.date).toBe('2027-01-14');
  });
});
