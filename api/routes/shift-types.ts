import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { SHIFT_KINDS } from '../../shared/domain';
import { db } from '../../db/client';
import {
  agentRequests,
  assignments,
  coverageNeeds,
  coverageOverrides,
  shiftTypes,
} from '../../db/schema';
import { type ApiError, notFound } from '../lib/errors';
import { idParam, shiftTypeInput } from '../../shared/schemas';
import { compareFr } from '../lib/sort';
import { validate } from '../middleware/validate';

/**
 * Needs, overrides and requests depend on whether a shift type is worked or
 * not (absence and rest codes are interchangeable for them): that is frozen
 * once they refer to it. Hours, break and counted time stay editable: these
 * rows follow the current definition.
 */
const kindInUse: ApiError = {
  error:
    "Poste déjà utilisé par des besoins ou des demandes : il ne peut plus passer de travaillé à non travaillé, ni l'inverse.",
  fields: { kind: ['Travaillé ou non : figé, poste déjà utilisé'] },
};

/**
 * Once a shift type appears in a planning, what defines the time worked is
 * frozen: past months must keep their meaning. Archiving frees the code for a
 * new definition.
 */
const TIMING_FIELDS = [
  'kind',
  'startTime',
  'endTime',
  'breakMinutes',
  'countedMinutes',
  'isNight',
] as const;

const planned: ApiError = {
  error:
    'Poste présent dans un planning : son type, ses horaires et son décompte ne se modifient plus. Archivez-le et créez-en un nouveau avec le même code.',
};

async function isPlanned(id: string): Promise<boolean> {
  const rows = await db
    .select({ id: assignments.id })
    .from(assignments)
    .where(eq(assignments.shiftTypeId, id))
    .limit(1);
  return rows.length > 0;
}

/** Whether a need, override or request refers to the shift type. */
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
    const retimed = TIMING_FIELDS.some((field) => current[field] !== input[field]);
    if (retimed && (await isPlanned(id))) return c.json(planned, 409);
    const worked = (kind: string) => kind === 'WORK';
    if (worked(current.kind) !== worked(input.kind) && (await isReferenced(id))) {
      return c.json(kindInUse, 409);
    }
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
