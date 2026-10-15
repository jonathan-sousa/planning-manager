import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/client';
import { skills } from '../../db/schema';
import { notFound } from '../errors';
import { idParam, skillInput } from '../../shared/schemas';
import { compareFr } from '../sort';
import { validate } from '../validate';

export const skillRoutes = new Hono()
  .get('/', async (c) => {
    const rows = await db.select().from(skills);
    return c.json(rows.sort((a, b) => compareFr(a.code, b.code)));
  })

  .post('/', validate('json', skillInput), async (c) => {
    const [row] = await db.insert(skills).values(c.req.valid('json')).returning();
    return c.json(row, 201);
  })

  .put('/:id', validate('param', idParam), validate('json', skillInput), async (c) => {
    const [row] = await db
      .update(skills)
      .set(c.req.valid('json'))
      .where(eq(skills.id, c.req.valid('param').id))
      .returning();
    return row ? c.json(row, 200) : c.json(notFound, 404);
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const [row] = await db
      .delete(skills)
      .where(eq(skills.id, c.req.valid('param').id))
      .returning({ id: skills.id });
    return row ? c.body(null, 204) : c.json(notFound, 404);
  });
