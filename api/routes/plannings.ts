import { and, between, eq, gte, inArray, lt, lte, max, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { type Bindings, callerName } from '../auth';
import { addMonths, monthDates, monthOf } from '../calendar';
import { db } from '../db/client';
import {
  acceptedViolations,
  agentRequests,
  agentSkills,
  agents,
  assignments,
  coverageNeeds,
  coverageOverrides,
  monthBalances,
  plannings,
  ruleSettings,
  shiftTypes,
  solveRuns,
} from '../db/schema';
import { type AssignmentSource, UNFINISHED_SOLVE_STATUSES } from '../domain';
import { type ApiError, notFound, ValidationError } from '../errors';
import { planningAgents, type RuleInput } from '../rules/model';
import {
  absenceCells,
  canTransition,
  cellRows,
  contextWindow,
  isInProgress,
  isLost,
  monthBalanceRows,
  openingBalances,
  openingChangedSincePublication,
  openViolations,
  previousMonthOpen,
} from '../rules/planning';
import { countPlanning } from '../rules/counters';
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

const stale: ApiError = {
  error: 'Le planning a été modifié entre-temps : rechargez la page.',
};
const notDraft: ApiError = { error: "Planning non modifiable : il n'est plus en brouillon." };

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
        .where(between(assignments.date, ...contextWindow(month))),
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

/**
 * The balances of a month (api/rules/planning.ts), from the hours recorded at
 * each publication: a republished month thus updates the months after it.
 */
async function loadBalances(month: string) {
  const [agentRows, carried, [previous], [lastEarlier]] = await Promise.all([
    db.select({ id: agents.id, initial: agents.initialBalanceMinutes }).from(agents),
    db
      .select({
        agentId: monthBalances.agentId,
        minutes: sql<number>`sum(${monthBalances.creditedMinutes} - ${monthBalances.targetMinutes})::int`,
      })
      .from(monthBalances)
      .where(lt(monthBalances.month, month))
      .groupBy(monthBalances.agentId),
    db
      .select()
      .from(plannings)
      .where(eq(plannings.month, addMonths(month, -1))),
    db
      .select({ at: max(monthBalances.updatedAt) })
      .from(monthBalances)
      .where(lt(monthBalances.month, month)),
  ]);
  return {
    opening: openingBalances(agentRows, carried),
    previousMonthOpen: previousMonthOpen(previous),
    /** When an earlier month was last published. */
    earlierPublishedAt: lastEarlier?.at ?? null,
  };
}

type Tx = Parameters<Parameters<typeof db.transactionWithRetry>[0]>[0];
type CellWrite = { agentId: string; date: string; shiftTypeId: string | null; locked: boolean };

/** Replaces cells inside a transaction, as checked and computed by `cellRows`. */
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
  const rows = cellRows(
    cells,
    new Map(agentRows.map((agent) => [agent.id, agent])),
    new Map(shiftRows.map((shift) => [shift.id, shift])),
    { month, updatedBy, source }
  );

  // An upsert writes one row per cell (DSQL caps a transaction at 3 000 rows).
  const emptied = cells.filter((cell) => !cell.shiftTypeId);
  if (emptied.length) {
    await tx
      .delete(assignments)
      .where(
        or(
          ...emptied.map((cell) =>
            and(eq(assignments.agentId, cell.agentId), eq(assignments.date, cell.date))
          )
        )
      );
  }
  return rows.length
    ? tx
        .insert(assignments)
        .values(rows)
        .onConflictDoUpdate({
          target: [assignments.agentId, assignments.date],
          set: {
            shiftTypeId: sql`excluded.shift_type_id`,
            countedMinutes: sql`excluded.counted_minutes`,
            locked: sql`excluded.locked`,
            source: sql`excluded.source`,
            updatedBy: sql`excluded.updated_by`,
            updatedAt: sql`now()`,
          },
        })
        .returning()
    : [];
}

export const planningRoutes = new Hono<{ Bindings: Bindings }>()
  /** The month's planning (null until created) and the cells around it. */
  .get('/:month', validate('param', monthParam), async (c) => {
    const { month } = c.req.valid('param');
    const [planning, cells, accepted, balances] = await Promise.all([
      db.select().from(plannings).where(eq(plannings.month, month)),
      db
        .select()
        .from(assignments)
        .where(between(assignments.date, ...contextWindow(month))),
      db.select().from(acceptedViolations).where(eq(acceptedViolations.month, month)),
      loadBalances(month),
    ]);
    return c.json({
      planning: planning[0] ?? null,
      assignments: cells,
      acceptedViolations: accepted,
      balances: {
        opening: balances.opening,
        previousMonthOpen: balances.previousMonthOpen,
        openingChangedSincePublication: openingChangedSincePublication(
          planning[0]?.publishedAt,
          balances.earlierPublishedAt
        ),
      },
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
      const rows = absenceCells(
        requests,
        new Map(agentRows.map((agent) => [agent.id, agent])),
        new Map(shifts.map((shift) => [shift.id, shift])),
        { month, updatedBy }
      );
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
      if (!canTransition(current.status, status)) {
        return c.json({ error: 'Changement de statut impossible.' } satisfies ApiError, 409);
      }
      if (status === 'VALIDATED') {
        const [input, accepted] = await Promise.all([
          loadRuleInput(month),
          db.select().from(acceptedViolations).where(eq(acceptedViolations.month, month)),
        ]);
        const open = openViolations(validatePlanning(input), accepted);
        if (open.length) {
          return c.json(
            {
              error: `${open.length} violation(s) dure(s) à corriger ou à accepter avec une justification.`,
            } satisfies ApiError,
            409
          );
        }
      }
      // Publishing records each agent's hours of the month (a validated month
      // is not editable: its cells are those just read).
      const counts = status === 'PUBLISHED' ? countPlanning(await loadRuleInput(month)) : [];
      const updated = await db.transactionWithRetry(async (tx) => {
        const [row] = await tx
          .update(plannings)
          .set({
            status,
            version: sql`${plannings.version} + 1`,
            publishedAt: status === 'PUBLISHED' ? new Date().toISOString() : null,
          })
          .where(and(eq(plannings.month, month), eq(plannings.status, current.status)))
          .returning();
        if (row && status === 'PUBLISHED') {
          await tx.delete(monthBalances).where(eq(monthBalances.month, month));
          if (counts.length) await tx.insert(monthBalances).values(monthBalanceRows(counts, month));
        }
        return row;
      });
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
      if (!planning) return c.json(notFound, 404);
      if (planning.status !== 'DRAFT') return c.json(notDraft, 409);
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
      const running = await db
        .select()
        .from(solveRuns)
        .where(
          and(eq(solveRuns.month, month), inArray(solveRuns.status, UNFINISHED_SOLVE_STATUSES))
        );
      if (running.some((run) => isInProgress(run, Date.now()))) {
        return c.json(
          { error: 'Un calcul est déjà en cours sur ce mois.' } satisfies ApiError,
          409
        );
      }
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
          .set({ status: 'FAILED', error: "Le solveur n'a pas pu être lancé : réessayez." })
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
    if (!run) return c.json(notFound, 404);
    if (isLost(run, Date.now())) {
      // Killed by its timeout (or out of memory) before it could record the failure.
      const [failed] = await db
        .update(solveRuns)
        .set({ status: 'FAILED', error: "Le solveur n'a pas répondu à temps : relancez-le." })
        .where(and(eq(solveRuns.id, id), inArray(solveRuns.status, UNFINISHED_SOLVE_STATUSES)))
        .returning();
      return c.json(failed ?? run, 200);
    }
    return c.json(run, 200);
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
