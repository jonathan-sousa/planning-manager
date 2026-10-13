import { and, between, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { type Bindings, callerName } from '../auth';
import { addDays, monthDates, monthOf, nominalMinutes, shiftInterval } from '../calendar';
import { db } from '../db/client';
import {
  acceptedViolations,
  agentRequests,
  agentSkills,
  agents,
  assignments,
  coverageNeeds,
  coverageOverrides,
  plannings,
  ruleSettings,
  shiftTypes,
  solveRuns,
} from '../db/schema';
import type { AssignmentSource, PlanningStatus } from '../domain';
import { type ApiError, notFound, ValidationError } from '../errors';
import { planningAgents, type RuleInput } from '../rules/model';
import { validatePlanning } from '../rules/validate';
import {
  acceptViolationInput,
  cellsInput,
  idParam,
  monthParam,
  solveInput,
  statusInput,
} from '../schemas';
import { startSolve } from '../solver-client';
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

/** Dates of a month widened by the context days. */
function window(month: string): [string, string] {
  const dates = monthDates(month);
  return [addDays(dates[0]!, -CONTEXT_DAYS), addDays(dates.at(-1)!, CONTEXT_DAYS)];
}

/** Everything the validator needs for a month, read from the database. */
async function loadRuleInput(month: string): Promise<RuleInput> {
  const [agentRows, links, shifts, cells, needs, overrides, requests, [settings]] =
    await Promise.all([
      db.select().from(agents),
      db.select().from(agentSkills),
      db.select().from(shiftTypes),
      db
        .select()
        .from(assignments)
        .where(between(assignments.date, ...window(month))),
      db.select().from(coverageNeeds),
      db.select().from(coverageOverrides),
      db.select().from(agentRequests),
      db.select().from(ruleSettings),
    ]);
  const skillIds = Map.groupBy(links, (link) => link.agentId);
  const withSkills = agentRows.map((agent) => ({
    ...agent,
    skillIds: (skillIds.get(agent.id) ?? []).map((link) => link.skillId),
  }));
  return {
    month,
    settings: settings!,
    agents: planningAgents(withSkills, cells, month),
    shiftTypes: shifts,
    cells,
    needs,
    overrides,
    requests,
  };
}

type Tx = Parameters<Parameters<typeof db.transactionWithRetry>[0]>[0];
type CellWrite = { agentId: string; date: string; shiftTypeId: string | null; locked: boolean };

/**
 * Replaces cells inside a transaction: contract dates and archived shift types
 * are checked, counted minutes computed (daylight saving time included).
 */
async function writeCells(
  tx: Tx,
  month: string,
  cells: CellWrite[],
  { updatedBy, source }: { updatedBy: string; source: AssignmentSource }
) {
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
      source,
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
  return rows.length ? tx.insert(assignments).values(rows).returning() : [];
}

/** Allowed status changes: validate, publish, reopen. */
const TRANSITIONS: Record<PlanningStatus, PlanningStatus[]> = {
  DRAFT: ['VALIDATED'],
  VALIDATED: ['PUBLISHED', 'DRAFT'],
  PUBLISHED: ['DRAFT'],
};

export const planningRoutes = new Hono<{ Bindings: Bindings }>()
  /** The month's planning (null until created) and the cells around it. */
  .get('/:month', validate('param', monthParam), async (c) => {
    const { month } = c.req.valid('param');
    const [planning, cells, accepted] = await Promise.all([
      db.select().from(plannings).where(eq(plannings.month, month)),
      db
        .select()
        .from(assignments)
        .where(between(assignments.date, ...window(month))),
      db.select().from(acceptedViolations).where(eq(acceptedViolations.month, month)),
    ]);
    return c.json({
      planning: planning[0] ?? null,
      assignments: cells,
      acceptedViolations: accepted,
    });
  })

  .post('/:month', validate('param', monthParam), async (c) => {
    const { month } = c.req.valid('param');
    const [existing] = await db.select().from(plannings).where(eq(plannings.month, month));
    if (existing) return c.json({ error: 'Ce mois a déjà un planning.' } satisfies ApiError, 409);
    const dates = monthDates(month);
    const updatedBy = callerName(c.env.event);

    // The draft starts with the approved absences, locked with their code.
    const planning = await db.transactionWithRetry(async (tx) => {
      const [created] = await tx.insert(plannings).values({ month }).returning();
      const [requests, agentRows, shifts] = await Promise.all([
        tx
          .select()
          .from(agentRequests)
          .where(
            and(
              eq(agentRequests.kind, 'ABSENCE_APPROVED'),
              lte(agentRequests.startDate, dates.at(-1)!),
              gte(agentRequests.endDate, dates[0]!)
            )
          ),
        tx.select().from(agents),
        tx.select().from(shiftTypes),
      ]);
      const agentById = new Map(agentRows.map((agent) => [agent.id, agent]));
      const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));
      const rows = requests.flatMap((request) => {
        const agent = agentById.get(request.agentId)!;
        const shift = shiftById.get(request.shiftTypeId!)!;
        return dates
          .filter(
            (date) =>
              date >= request.startDate &&
              date <= request.endDate &&
              date >= agent.startDate &&
              (!agent.endDate || date <= agent.endDate)
          )
          .map((date) => ({
            agentId: agent.id,
            date,
            month,
            shiftTypeId: shift.id,
            countedMinutes: countedOn(date, shift),
            locked: true,
            source: 'REQUEST' as const,
            updatedBy,
          }));
      });
      if (rows.length) await tx.insert(assignments).values(rows);
      return created!;
    });
    return c.json(planning, 201);
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

      const inserted = await writeCells(tx, month, cells, { updatedBy, source: 'MANUAL' });
      return { version: planning.version, assignments: inserted };
    });

    if (written) return c.json(written, 200);
    const [planning] = await db.select().from(plannings).where(eq(plannings.month, month));
    if (!planning) return c.json(notFound, 404);
    return c.json(planning.status === 'DRAFT' ? stale : notDraft, 409);
  })

  /**
   * Validates, publishes or reopens a month. Validating requires every hard
   * violation to be accepted with a justification. Bumps the version, so an
   * edit started before the change is refused.
   */
  .put(
    '/:month/status',
    validate('param', monthParam),
    validate('json', statusInput),
    async (c) => {
      const { month } = c.req.valid('param');
      const { status } = c.req.valid('json');
      const [current] = await db.select().from(plannings).where(eq(plannings.month, month));
      if (!current) return c.json(notFound, 404);
      if (!TRANSITIONS[current.status].includes(status)) {
        return c.json({ error: 'Changement de statut impossible.' } satisfies ApiError, 409);
      }
      if (status === 'VALIDATED') {
        const [input, accepted] = await Promise.all([
          loadRuleInput(month),
          db.select().from(acceptedViolations).where(eq(acceptedViolations.month, month)),
        ]);
        const acceptedKeys = new Set(
          accepted.map((item) => `${item.agentId}|${item.date}|${item.rule}`)
        );
        const open = validatePlanning(input).filter(
          (violation) =>
            violation.severity === 'HARD' &&
            !acceptedKeys.has(`${violation.agentId}|${violation.date}|${violation.rule}`)
        );
        if (open.length) {
          return c.json(
            {
              error: `${open.length} violation(s) dure(s) à corriger ou à accepter avec une justification.`,
            } satisfies ApiError,
            409
          );
        }
      }
      const [updated] = await db
        .update(plannings)
        .set({
          status,
          version: sql`${plannings.version} + 1`,
          publishedAt: status === 'PUBLISHED' ? new Date().toISOString() : null,
        })
        .where(and(eq(plannings.month, month), eq(plannings.status, current.status)))
        .returning();
      return updated ? c.json(updated, 200) : c.json(stale, 409);
    }
  )

  .post(
    '/:month/accepted-violations',
    validate('param', monthParam),
    validate('json', acceptViolationInput),
    async (c) => {
      const { month } = c.req.valid('param');
      const input = c.req.valid('json');
      if (monthOf(input.date) !== month) throw new ValidationError({ date: ['Hors du mois'] });
      const [planning] = await db.select().from(plannings).where(eq(plannings.month, month));
      if (!planning) return c.json(notFound, 404);
      if (planning.status !== 'DRAFT') return c.json(notDraft, 409);
      const [row] = await db
        .insert(acceptedViolations)
        .values({ ...input, month, acceptedBy: callerName(c.env.event) })
        .returning();
      return c.json(row!, 201);
    }
  )

  .delete(
    '/:month/accepted-violations/:id',
    validate('param', monthParam.extend(idParam.shape)),
    async (c) => {
      const { month, id } = c.req.valid('param');
      const [planning] = await db.select().from(plannings).where(eq(plannings.month, month));
      if (planning && planning.status !== 'DRAFT') return c.json(notDraft, 409);
      const [row] = await db
        .delete(acceptedViolations)
        .where(and(eq(acceptedViolations.id, id), eq(acceptedViolations.month, month)))
        .returning({ id: acceptedViolations.id });
      return row ? c.body(null, 204) : c.json(notFound, 404);
    }
  )

  /** Starts the solver on a draft; the run is followed with GET …/solve-runs/:id. */
  .post(
    '/:month/solve-runs',
    validate('param', monthParam),
    validate('json', solveInput),
    async (c) => {
      const { month } = c.req.valid('param');
      const [planning] = await db.select().from(plannings).where(eq(plannings.month, month));
      if (!planning) return c.json(notFound, 404);
      if (planning.status !== 'DRAFT') return c.json(notDraft, 409);
      const [run] = await db
        .insert(solveRuns)
        .values({
          month,
          mode: c.req.valid('json').mode,
          planningVersion: planning.version,
          createdBy: callerName(c.env.event),
        })
        .returning();
      try {
        await startSolve(run!.id);
      } catch (error) {
        await db
          .update(solveRuns)
          .set({ status: 'FAILED', error: String(error) })
          .where(eq(solveRuns.id, run!.id));
        throw error;
      }
      return c.json(run!, 202);
    }
  )

  .get('/:month/solve-runs/:id', validate('param', monthParam.extend(idParam.shape)), async (c) => {
    const { month, id } = c.req.valid('param');
    const [run] = await db
      .select()
      .from(solveRuns)
      .where(and(eq(solveRuns.id, id), eq(solveRuns.month, month)));
    return run ? c.json(run, 200) : c.json(notFound, 404);
  })

  /**
   * Applies a proposal in one transaction, if the planning is still at the
   * version the solver read; bumps the version.
   */
  .post(
    '/:month/solve-runs/:id/apply',
    validate('param', monthParam.extend(idParam.shape)),
    async (c) => {
      const { month, id } = c.req.valid('param');
      const updatedBy = callerName(c.env.event);
      const outcome = await db.transactionWithRetry(async (tx) => {
        const [run] = await tx
          .select()
          .from(solveRuns)
          .where(and(eq(solveRuns.id, id), eq(solveRuns.month, month)));
        if (!run) return 'not-found' as const;
        if (run.status !== 'SUCCEEDED' || !run.result) return 'not-ready' as const;
        const [planning] = await tx
          .update(plannings)
          .set({ version: sql`${plannings.version} + 1` })
          .where(
            and(
              eq(plannings.month, month),
              eq(plannings.version, run.planningVersion),
              eq(plannings.status, 'DRAFT')
            )
          )
          .returning();
        if (!planning) return 'stale' as const;
        if (run.result.cells.length) {
          await writeCells(
            tx,
            month,
            run.result.cells.map((cell) => ({ ...cell, locked: false })),
            { updatedBy, source: 'SOLVER' }
          );
        }
        await tx.update(solveRuns).set({ status: 'APPLIED' }).where(eq(solveRuns.id, id));
        return { version: planning.version };
      });
      if (outcome === 'not-found') return c.json(notFound, 404);
      if (outcome === 'not-ready') {
        return c.json({ error: 'Aucune proposition à appliquer.' } satisfies ApiError, 409);
      }
      if (outcome === 'stale') {
        return c.json(
          {
            error: 'Le planning a changé depuis le calcul : relancez le solveur.',
          } satisfies ApiError,
          409
        );
      }
      return c.json(outcome, 200);
    }
  );
