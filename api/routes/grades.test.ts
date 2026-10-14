import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrudLifecycle } from '../test/crud';
import { resetDb } from '../test/db';
import { agent, grade } from '../test/factories';
import { body, send, uuid } from '../test/http';

vi.mock('../db/client', () => import('../test/db'));

beforeEach(async () => {
  await resetDb();
});

describe('grades', () => {
  it('appends a new grade at the end of the order', async () => {
    await send('POST', '/grades', { code: 'IDE', label: 'Infirmier' });
    await send('POST', '/grades', { code: 'AS', label: 'Aide-soignant' });
    const rows = await body<{ code: string; sortOrder: number }[]>(await send('GET', '/grades'));
    expect(rows.map((row) => [row.code, row.sortOrder])).toEqual([
      ['IDE', 0],
      ['AS', 1],
    ]);
  });

  it('reports a duplicate code on its field', async () => {
    await grade({ code: 'IDE' });
    const response = await send('POST', '/grades', { code: 'IDE', label: 'Autre' });
    expect(response.status).toBe(409);
    expect((await body(response)).fields).toHaveProperty('code');
  });

  it('refuses to delete a grade still used, and answers 404 for an unknown one', async () => {
    const used = await grade();
    await agent({ gradeId: used.id });
    const response = await send('DELETE', `/grades/${used.id}`);
    expect(response.status).toBe(409);
    expect((await body(response)).error).toMatch(/encore utilisé/);
    expect((await send('PUT', `/grades/${uuid(9)}`, { code: 'X', label: 'X' })).status).toBe(404);
    expect((await send('DELETE', `/grades/${uuid(9)}`)).status).toBe(404);
  });

  it('creates, updates and deletes a grade', async () => {
    await expectCrudLifecycle(
      '/grades',
      { code: 'IDE', label: 'Infirmier' },
      { code: 'IDE', label: "Infirmier diplômé d'État" }
    );
  });
});
