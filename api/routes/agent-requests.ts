import { and, desc, eq, gte, lte, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/client';
import { agentRequests } from '../../db/schema';
import { notFound, ValidationError } from '../errors';
import { type AgentRequestInput, idParam, agentRequestInput } from '../../shared/schemas';
import { ABSENCE_CODE, requireShiftKind, WORK_SHIFT } from '../shift-checks';
import { validate } from '../validate';

/**
 * Checks against other rows: the code's kind (a shift wish names a work shift,
 * an approved absence an absence or rest code), and no overlap between two
 * approved absences of the same agent, which would lock a day twice.
 */
async function checkRequest(input: AgentRequestInput, id?: string): Promise<void> {
  const { kind, shiftTypeId } = input;
  if (kind === 'WISH_SHIFT') {
    await requireShiftKind(shiftTypeId, WORK_SHIFT);
  }
  if (kind !== 'ABSENCE_APPROVED') return;
  await requireShiftKind(shiftTypeId, ABSENCE_CODE);
  const [overlap] = await db
    .select({ id: agentRequests.id })
    .from(agentRequests)
    .where(
      and(
        eq(agentRequests.agentId, input.agentId),
        eq(agentRequests.kind, 'ABSENCE_APPROVED'),
        lte(agentRequests.startDate, input.endDate),
        gte(agentRequests.endDate, input.startDate),
        id ? ne(agentRequests.id, id) : undefined
      )
    )
    .limit(1);
  if (overlap) {
    throw new ValidationError({ startDate: ['Chevauche une autre absence validée de cet agent'] });
  }
}

export const agentRequestRoutes = new Hono()
  .get('/', async (c) => {
    const rows = await db.select().from(agentRequests).orderBy(desc(agentRequests.startDate));
    return c.json(rows);
  })

  .post('/', validate('json', agentRequestInput), async (c) => {
    await checkRequest(c.req.valid('json'));
    const [row] = await db.insert(agentRequests).values(c.req.valid('json')).returning();
    return c.json(row, 201);
  })

  .put('/:id', validate('param', idParam), validate('json', agentRequestInput), async (c) => {
    await checkRequest(c.req.valid('json'), c.req.valid('param').id);
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
