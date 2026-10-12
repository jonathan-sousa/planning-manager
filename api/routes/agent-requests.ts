import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { agentRequests, shiftTypes } from '../db/schema';
import { notFound, ValidationError } from '../errors';
import { type AgentRequestInput, idParam, agentRequestInput } from '../schemas';
import { validate } from '../validate';

/** A shift wish names a work shift; an approved absence, an absence or rest code. */
async function checkShiftKind({ kind, shiftTypeId }: AgentRequestInput): Promise<void> {
  if (!shiftTypeId) return;
  const [shift] = await db
    .select({ kind: shiftTypes.kind })
    .from(shiftTypes)
    .where(eq(shiftTypes.id, shiftTypeId));
  if (!shift) return; // the foreign key reports it
  if (kind === 'WISH_SHIFT' && shift.kind !== 'WORK') {
    throw new ValidationError({ shiftTypeId: ['Un poste travaillé est attendu'] });
  }
  if (kind === 'ABSENCE_APPROVED' && shift.kind === 'WORK') {
    throw new ValidationError({ shiftTypeId: ["Un code d'absence ou de repos est attendu"] });
  }
}

export const agentRequestRoutes = new Hono()
  .get('/', async (c) => {
    const rows = await db.select().from(agentRequests).orderBy(desc(agentRequests.startDate));
    return c.json(rows);
  })

  .post('/', validate('json', agentRequestInput), async (c) => {
    await checkShiftKind(c.req.valid('json'));
    const [row] = await db.insert(agentRequests).values(c.req.valid('json')).returning();
    return c.json(row, 201);
  })

  .put('/:id', validate('param', idParam), validate('json', agentRequestInput), async (c) => {
    await checkShiftKind(c.req.valid('json'));
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
