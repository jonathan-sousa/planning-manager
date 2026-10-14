import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agentSkills, skills } from '../db/schema';
import { expectCrudLifecycle } from '../test/crud';
import { db, resetDb } from '../test/db';
import { agent, grade } from '../test/factories';
import { body, send, uuid } from '../test/http';

vi.mock('../db/client', () => import('../test/db'));

beforeEach(async () => {
  await resetDb();
});

describe('agents', () => {
  const input = (gradeId: string, skillIds: string[]) => ({
    firstName: 'Inès',
    lastName: 'Joly',
    gradeId,
    skillIds,
    workTimeRatio: 80,
    nightMode: 'DAY_ONLY',
    hoursRegime: 'STANDARD_1607',
    active: true,
    startDate: '2026-01-05',
    endDate: null,
    initialBalanceMinutes: -210,
  });

  it('saves an agent with its skills, and replaces them on update', async () => {
    const ide = await grade();
    const [urg, amb] = await db
      .insert(skills)
      .values([
        { code: 'URG', label: 'Urgences' },
        { code: 'AMB', label: 'Ambulatoire' },
      ])
      .returning();
    const created = await body<{ id: string; skillIds: string[] }>(
      await send('POST', '/agents', input(ide.id, [urg!.id, urg!.id]))
    );
    expect(created.skillIds).toEqual([urg!.id]);

    const updated = await send('PUT', `/agents/${created.id}`, input(ide.id, [amb!.id]));
    expect(updated.status).toBe(200);
    expect(await db.select().from(agentSkills)).toEqual([
      { agentId: created.id, skillId: amb!.id },
    ]);
    const [listed] = await body<{ skillIds: string[]; initialBalanceMinutes: number }[]>(
      await send('GET', '/agents')
    );
    expect(listed).toMatchObject({ skillIds: [amb!.id], initialBalanceMinutes: -210 });
  });

  it('answers 404 for an unknown agent, and refuses an unknown grade', async () => {
    const ide = await grade();
    expect((await send('PUT', `/agents/${uuid(9)}`, input(ide.id, []))).status).toBe(404);
    const response = await send('POST', '/agents', input(uuid(9), []));
    expect(response.status).toBe(400);
    expect((await body(response)).error).toMatch(/Référence inconnue/);
  });

  it('sorts agents by last name then first name, in French order', async () => {
    await agent({ lastName: 'Étienne', firstName: 'Zoé' });
    await agent({ lastName: 'Dupont', firstName: 'Léa' });
    await agent({ lastName: 'Étienne', firstName: 'Ana' });
    const rows = await body<{ lastName: string; firstName: string }[]>(
      await send('GET', '/agents')
    );
    expect(rows.map((row) => `${row.lastName} ${row.firstName}`)).toEqual([
      'Dupont Léa',
      'Étienne Ana',
      'Étienne Zoé',
    ]);
  });

  it('creates, updates and deletes an agent', async () => {
    const created = input((await grade()).id, []);
    await expectCrudLifecycle('/agents', created, { ...created, workTimeRatio: 50 });
  });
});
