import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectCrudLifecycle } from '../test/crud';
import { resetDb } from '../test/db';
import { absenceRequest, agent, LEAVE, shiftType } from '../test/factories';
import { body, send } from '../test/http';

vi.mock('../../db/client', () => import('../test/db'));

beforeEach(async () => {
  await resetDb();
});

describe('agent requests', () => {
  const request = (agentId: string, shiftTypeId: string | null, fields: object = {}) => ({
    agentId,
    startDate: '2026-11-03',
    endDate: '2026-11-09',
    kind: 'ABSENCE_APPROVED',
    shiftTypeId,
    comment: null,
    ...fields,
  });

  it('refuses an approved absence overlapping another one', async () => {
    const joly = await agent();
    const leave = await shiftType(LEAVE);
    await absenceRequest({
      agentId: joly.id,
      shiftTypeId: leave.id,
      startDate: '2026-11-09',
      endDate: '2026-11-12',
    });
    const response = await send('POST', '/agent-requests', request(joly.id, leave.id));
    expect(response.status).toBe(400);
    expect((await body(response)).fields).toHaveProperty('startDate');
  });

  it('saves an approved absence without overlap, itself excluded', async () => {
    const joly = await agent();
    const leave = await shiftType(LEAVE);
    const own = await absenceRequest({ agentId: joly.id, shiftTypeId: leave.id });
    const response = await send('PUT', `/agent-requests/${own.id}`, request(joly.id, leave.id));
    expect(response.status).toBe(200);
  });

  it('requires a work shift for a shift wish, an absence code for an approved absence', async () => {
    const joly = await agent();
    const day = await shiftType();
    const leave = await shiftType(LEAVE);
    const wish = await send(
      'POST',
      '/agent-requests',
      request(joly.id, leave.id, { kind: 'WISH_SHIFT' })
    );
    expect(wish.status).toBe(400);
    expect((await body(wish)).fields?.shiftTypeId?.[0]).toMatch(/poste travaillé/);
    const absence = await send('POST', '/agent-requests', request(joly.id, day.id));
    expect((await body(absence)).fields?.shiftTypeId?.[0]).toMatch(/absence ou de repos/);
  });

  it('creates, updates and deletes a request', async () => {
    const wish = request((await agent()).id, null, { kind: 'WISH_OFF' });
    await expectCrudLifecycle('/agent-requests', wish, { ...wish, comment: 'Rendez-vous' });
  });
});
