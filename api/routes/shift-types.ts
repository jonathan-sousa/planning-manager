import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { SHIFT_KINDS } from '../domain';
import { db } from '../db/client';
import { shiftTypes } from '../db/schema';
import { notFound } from '../errors';
import { idParam, shiftTypeInput } from '../schemas';
import { compareFr } from '../sort';
import { validate } from '../validate';

export const shiftTypeRoutes = new Hono()
  .get('/', async (c) => {
    const rows = await db.select().from(shiftTypes);
    const kindOrder = (kind: string) => SHIFT_KINDS.indexOf(kind as (typeof SHIFT_KINDS)[number]);
    return c.json(
      rows.sort(
        (a, b) =>
          Number(a.archived) - Number(b.archived) ||
          kindOrder(a.kind) - kindOrder(b.kind) ||
          compareFr(a.code, b.code)
      )
    );
  })

  .post('/', validate('json', shiftTypeInput), async (c) => {
    const [row] = await db.insert(shiftTypes).values(c.req.valid('json')).returning();
    return c.json(row, 201);
  })

  .put('/:id', validate('param', idParam), validate('json', shiftTypeInput), async (c) => {
    const [row] = await db
      .update(shiftTypes)
      .set(c.req.valid('json'))
      .where(eq(shiftTypes.id, c.req.valid('param').id))
      .returning();
    return row ? c.json(row, 200) : c.json(notFound, 404);
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const [row] = await db
      .delete(shiftTypes)
      .where(eq(shiftTypes.id, c.req.valid('param').id))
      .returning({ id: shiftTypes.id });
    return row ? c.body(null, 204) : c.json(notFound, 404);
  });
