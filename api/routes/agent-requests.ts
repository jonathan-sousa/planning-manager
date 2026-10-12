import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { agentRequests } from '../db/schema';
import { notFound } from '../errors';
import { idParam, agentRequestInput } from '../schemas';
import { validate } from '../validate';

export const agentRequestRoutes = new Hono()
  .get('/', async (c) => {
    const rows = await db.select().from(agentRequests).orderBy(desc(agentRequests.startDate));
    return c.json(rows);
  })

  .post('/', validate('json', agentRequestInput), async (c) => {
    const [row] = await db.insert(agentRequests).values(c.req.valid('json')).returning();
    return c.json(row, 201);
  })

  .put('/:id', validate('param', idParam), validate('json', agentRequestInput), async (c) => {
    const [row] = await db
      .update(agentRequests)
      .set(c.req.valid('json'))
      .where(eq(agentRequests.id, c.req.valid('param').id))
      .returning();
    return row ? c.json(row, 200) : c.json(notFound, 404);
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const [row] = await db
      .delete(agentRequests)
      .where(eq(agentRequests.id, c.req.valid('param').id))
      .returning({ id: agentRequests.id });
    return row ? c.body(null, 204) : c.json(notFound, 404);
  });
