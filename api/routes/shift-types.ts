import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { SHIFT_KINDS } from '../domain';
import { db } from '../db/client';
import { agentRequests, coverageNeeds, coverageOverrides, shiftTypes } from '../db/schema';
import { type ApiError, notFound } from '../errors';
import { idParam, shiftTypeInput } from '../schemas';
import { compareFr } from '../sort';
import { validate } from '../validate';

/**
 * Needs, overrides and requests depend on the kind (work shift vs absence or
 * rest code): it is frozen once they refer to the shift type. Hours, break and
 * counted time stay editable: these rows follow the current definition.
 */
const kindInUse: ApiError = {
  error: 'Poste déjà utilisé par des besoins ou des demandes : son type ne se modifie plus.',
  fields: { kind: ['Type figé : poste déjà utilisé'] },
};

/** Whether any row refers to the shift type. */
async function isReferenced(id: string): Promise<boolean> {
  const results = await Promise.all(
    [coverageNeeds, coverageOverrides, agentRequests].map((table) =>
      db.select({ id: table.id }).from(table).where(eq(table.shiftTypeId, id)).limit(1)
    )
  );
  return results.some((rows) => rows.length > 0);
}

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
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const [current] = await db.select().from(shiftTypes).where(eq(shiftTypes.id, id));
    if (!current) return c.json(notFound, 404);
    if (current.kind !== input.kind && (await isReferenced(id))) return c.json(kindInUse, 409);
    const [row] = await db.update(shiftTypes).set(input).where(eq(shiftTypes.id, id)).returning();
    return c.json(row!, 200);
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const [row] = await db
      .delete(shiftTypes)
      .where(eq(shiftTypes.id, c.req.valid('param').id))
      .returning({ id: shiftTypes.id });
    return row ? c.body(null, 204) : c.json(notFound, 404);
  });
