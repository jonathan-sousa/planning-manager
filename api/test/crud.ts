// The life cycle every reference data router shares: create, list, update,
// delete, and 404 on an unknown id.
import { expect } from 'vitest';
import { body, send, uuid } from './http';

export async function expectCrudLifecycle(path: string, created: object, updated: object) {
  const response = await send('POST', path, created);
  expect(response.status).toBe(201);
  const { id } = await body<{ id: string }>(response);
  expect(await body(await send('GET', path))).toEqual([expect.objectContaining(created)]);

  const changed = await send('PUT', `${path}/${id}`, updated);
  expect(changed.status).toBe(200);
  expect(await body(changed)).toMatchObject({ id, ...updated });
  expect((await send('PUT', `${path}/${uuid(404)}`, updated)).status).toBe(404);

  expect((await send('DELETE', `${path}/${id}`)).status).toBe(204);
  expect((await send('DELETE', `${path}/${id}`)).status).toBe(404);
  expect(await body(await send('GET', path))).toEqual([]);
}
