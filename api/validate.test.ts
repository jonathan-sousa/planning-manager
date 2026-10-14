import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ValidationError } from './errors';
import { validate } from './validate';

const app = new Hono()
  .post('/', validate('json', z.object({ code: z.string().min(1), count: z.int() })), (c) =>
    c.json(c.req.valid('json'))
  )
  .onError((error, c) =>
    error instanceof ValidationError ? c.json({ fields: error.fields }, 400) : c.text('?', 500)
  );

const post = (body: unknown) =>
  app.request('/', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('validate', () => {
  it('passes the parsed input on', async () => {
    const response = await post({ code: 'J', count: 2 });
    expect(await response.json()).toEqual({ code: 'J', count: 2 });
  });

  it('throws a ValidationError with the messages of each invalid field', async () => {
    const response = await post({ code: '', count: 1.5 });
    expect(response.status).toBe(400);
    const { fields } = (await response.json()) as { fields: Record<string, string[]> };
    expect(Object.keys(fields).sort()).toEqual(['code', 'count']);
  });
});
