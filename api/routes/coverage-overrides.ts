import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/client';
import { coverageOverrides } from '../../db/schema';
import { notFound } from '../errors';
import { idParam, coverageOverrideInput } from '../../shared/schemas';
import { requireShiftKind, WORK_SHIFT } from '../shift-checks';
import { validate } from '../validate';

export const coverageOverrideRoutes = new Hono()
  .get('/', async (c) => {
    const rows = await db.select().from(coverageOverrides).orderBy(coverageOverrides.date);
    return c.json(rows);
  })

  .post('/', validate('json', coverageOverrideInput), async (c) => {
    const input = c.req.valid('json');
    await requireShiftKind(input.shiftTypeId, WORK_SHIFT);
    const [row] = await db.insert(coverageOverrides).values(input).returning();
    return c.json(row, 201);
  })

  .put('/:id', validate('param', idParam), validate('json', coverageOverrideInput), async (c) => {
    const input = c.req.valid('json');
    await requireShiftKind(input.shiftTypeId, WORK_SHIFT);
    const [row] = await db
      .update(coverageOverrides)
      .set(input)
      .where(eq(coverageOverrides.id, c.req.valid('param').id))
      .returning();
    return row ? c.json(row, 200) : c.json(notFound, 404);
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const [row] = await db
      .delete(coverageOverrides)
      .where(eq(coverageOverrides.id, c.req.valid('param').id))
      .returning({ id: coverageOverrides.id });
    return row ? c.body(null, 204) : c.json(notFound, 404);
  });
