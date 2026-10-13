import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { coverageNeeds } from '../db/schema';
import { notFound } from '../errors';
import { idParam, coverageNeedInput } from '../schemas';
import { requireShiftKind, WORK_SHIFT } from '../shift-checks';
import { validate } from '../validate';

export const coverageNeedRoutes = new Hono()
  .get('/', async (c) => {
    const rows = await db.select().from(coverageNeeds);
    return c.json(rows);
  })

  .post('/', validate('json', coverageNeedInput), async (c) => {
    const input = c.req.valid('json');
    await requireShiftKind(input.shiftTypeId, WORK_SHIFT.kinds, WORK_SHIFT.message);
    const [row] = await db.insert(coverageNeeds).values(input).returning();
    return c.json(row, 201);
  })

  .put('/:id', validate('param', idParam), validate('json', coverageNeedInput), async (c) => {
    const input = c.req.valid('json');
    await requireShiftKind(input.shiftTypeId, WORK_SHIFT.kinds, WORK_SHIFT.message);
    const [row] = await db
      .update(coverageNeeds)
      .set(input)
      .where(eq(coverageNeeds.id, c.req.valid('param').id))
      .returning();
    return row ? c.json(row, 200) : c.json(notFound, 404);
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const [row] = await db
      .delete(coverageNeeds)
      .where(eq(coverageNeeds.id, c.req.valid('param').id))
      .returning({ id: coverageNeeds.id });
    return row ? c.body(null, 204) : c.json(notFound, 404);
  });
