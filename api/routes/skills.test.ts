import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrudLifecycle } from '../test/crud';
import { resetDb } from '../test/db';
import { body, send } from '../test/http';

vi.mock('../db/client', () => import('../test/db'));

beforeEach(async () => {
  await resetDb();
});

describe('skills', () => {
  it('lists skills by code, in French order', async () => {
    for (const code of ['URG', 'ÉCHO', 'AMB']) await send('POST', '/skills', { code, label: code });
    const rows = await body<{ code: string }[]>(await send('GET', '/skills'));
    expect(rows.map((row) => row.code)).toEqual(['AMB', 'ÉCHO', 'URG']);
  });

  it('creates, updates and deletes a skill', async () => {
    await expectCrudLifecycle(
      '/skills',
      { code: 'URG', label: 'Urgences' },
      { code: 'URG', label: 'Urgences adultes' }
    );
  });
});
