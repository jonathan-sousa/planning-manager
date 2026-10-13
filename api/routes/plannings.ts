import { and, between, eq, inArray, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { type Bindings, callerName } from '../auth';
import { addDays, monthDates, monthOf, nominalMinutes, shiftInterval } from '../calendar';
import { db } from '../db/client';
import { agents, assignments, plannings, shiftTypes } from '../db/schema';
import { type ApiError, notFound, ValidationError } from '../errors';
import { cellsInput, monthParam } from '../schemas';
import { validate } from '../validate';

/** Days of the neighbouring months loaded with a month, for rules spanning two months. */
const CONTEXT_DAYS = 13;

const stale: ApiError = {
  error: 'Le planning a été modifié entre-temps : rechargez la page.',
};
const notDraft: ApiError = { error: "Planning non modifiable : il n'est plus en brouillon." };

type ShiftType = typeof shiftTypes.$inferSelect;

/** Minutes credited for a shift on a date: a work shift follows daylight saving time. */
export function countedOn(date: string, shift: ShiftType): number {
  if (shift.kind !== 'WORK' || !shift.startTime || !shift.endTime) return shift.countedMinutes;
  const { start, end } = shiftInterval(date, shift.startTime, shift.endTime);
  return shift.countedMinutes + (end - start - nominalMinutes(shift.startTime, shift.endTime));
}

export const planningRoutes = new Hono<{ Bindings: Bindings }>()
  /** The month's planning (null until created) and the cells around it. */
  .get('/:month', validate('param', monthParam), async (c) => {
    const { month } = c.req.valid('param');
    const dates = monthDates(month);
    const [planning, cells] = await Promise.all([
      db.select().from(plannings).where(eq(plannings.month, month)),
      db
        .select()
        .from(assignments)
        .where(
          between(
            assignments.date,
            addDays(dates[0]!, -CONTEXT_DAYS),
            addDays(dates.at(-1)!, CONTEXT_DAYS)
          )
        ),
    ]);
    return c.json({ planning: planning[0] ?? null, assignments: cells });
  })

  .post('/:month', validate('param', monthParam), async (c) => {
    const { month } = c.req.valid('param');
    const [existing] = await db.select().from(plannings).where(eq(plannings.month, month));
    if (existing) return c.json({ error: 'Ce mois a déjà un planning.' } satisfies ApiError, 409);
    const [planning] = await db.insert(plannings).values({ month }).returning();
    return c.json(planning!, 201);
  })

  /**
   * Writes cells of a draft planning, if it is still at the version the edit
   * is based on; bumps the version. Contract dates and archived shift types
   * are checked here, the planning rules by the validator.
   */
  .put('/:month/cells', validate('param', monthParam), validate('json', cellsInput), async (c) => {
    const { month } = c.req.valid('param');
    const { version, cells } = c.req.valid('json');
    if (cells.some((cell) => monthOf(cell.date) !== month)) {
      throw new ValidationError({ cells: ['Cases hors du mois'] });
    }
    const updatedBy = callerName(c.env.event);

    const written = await db.transactionWithRetry(async (tx) => {
      const [planning] = await tx
        .update(plannings)
        .set({ version: sql`${plannings.version} + 1` })
        .where(
          and(
            eq(plannings.month, month),
            eq(plannings.version, version),
            eq(plannings.status, 'DRAFT')
          )
        )
        .returning();
      if (!planning) return undefined;

      const shiftIds = [...new Set(cells.flatMap((cell) => cell.shiftTypeId ?? []))];
      const agentIds = [...new Set(cells.map((cell) => cell.agentId))];
      const [shiftRows, agentRows] = await Promise.all([
        shiftIds.length
          ? tx.select().from(shiftTypes).where(inArray(shiftTypes.id, shiftIds))
          : Promise.resolve([]),
        tx.select().from(agents).where(inArray(agents.id, agentIds)),
      ]);
      const shiftById = new Map(shiftRows.map((shift) => [shift.id, shift]));
      const agentById = new Map(agentRows.map((agent) => [agent.id, agent]));

      const rows = [];
      for (const cell of cells) {
        const agent = agentById.get(cell.agentId);
        if (!agent) throw new ValidationError({ cells: ['Agent inconnu'] });
        if (cell.date < agent.startDate || (agent.endDate && cell.date > agent.endDate)) {
          throw new ValidationError({
            cells: [`Hors contrat : ${agent.lastName} le ${cell.date}`],
          });
        }
        if (!cell.shiftTypeId) continue;
        const shift = shiftById.get(cell.shiftTypeId);
        if (!shift || shift.archived)
          throw new ValidationError({ cells: ['Poste inconnu ou archivé'] });
        rows.push({
          agentId: cell.agentId,
          date: cell.date,
          month,
          shiftTypeId: shift.id,
          countedMinutes: countedOn(cell.date, shift),
          locked: cell.locked,
          source: 'MANUAL' as const,
          updatedBy,
        });
      }

      await tx
        .delete(assignments)
        .where(
          or(
            ...cells.map((cell) =>
              and(eq(assignments.agentId, cell.agentId), eq(assignments.date, cell.date))
            )
          )
        );
      const inserted = rows.length ? await tx.insert(assignments).values(rows).returning() : [];
      return { version: planning.version, assignments: inserted };
    });

    if (written) return c.json(written, 200);
    const [planning] = await db.select().from(plannings).where(eq(plannings.month, month));
    if (!planning) return c.json(notFound, 404);
    return c.json(planning.status === 'DRAFT' ? stale : notDraft, 409);
  });
