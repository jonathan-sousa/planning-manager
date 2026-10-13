import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { grades } from '../db/schema';
import { notFound } from '../errors';
import { gradeInput, idParam } from '../schemas';
import { compareFr } from '../sort';
import { validate } from '../validate';

export const gradeRoutes = new Hono()
  .get('/', async (c) => {
    const rows = await db.select().from(grades);
    return c.json(rows.sort((a, b) => a.sortOrder - b.sortOrder || compareFr(a.code, b.code)));
  })

  .post('/', validate('json', gradeInput), async (c) => {
    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${grades.sortOrder}) + 1, 0)::int` })
      .from(grades);
    const [row] = await db
      .insert(grades)
      .values({ ...c.req.valid('json'), sortOrder: next })
      .returning();
    return c.json(row, 201);
  })

  .put('/:id', validate('param', idParam), validate('json', gradeInput), async (c) => {
    const [row] = await db
      .update(grades)
      .set(c.req.valid('json'))
      .where(eq(grades.id, c.req.valid('param').id))
      .returning();
    return row ? c.json(row, 200) : c.json(notFound, 404);
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const [row] = await db
      .delete(grades)
      .where(eq(grades.id, c.req.valid('param').id))
      .returning({ id: grades.id });
    return row ? c.body(null, 204) : c.json(notFound, 404);
  });
