import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db/client';
import { agentSkills, agents } from '../../db/schema';
import { notFound } from '../errors';
import { agentInput, idParam } from '../../shared/schemas';
import { compareFr } from '../sort';
import { validate } from '../validate';

type Agent = typeof agents.$inferSelect;
type AgentInput = Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> & { skillIds: string[] };

/** Writes an agent and replaces its skills in one transaction; undefined if the id is unknown. */
function saveAgent(id: string | undefined, { skillIds, ...fields }: AgentInput) {
  return db.transactionWithRetry(async (tx) => {
    const [agent] = id
      ? await tx.update(agents).set(fields).where(eq(agents.id, id)).returning()
      : await tx.insert(agents).values(fields).returning();
    if (!agent) return undefined;
    if (id) await tx.delete(agentSkills).where(eq(agentSkills.agentId, id));
    if (skillIds.length > 0) {
      await tx
        .insert(agentSkills)
        .values(skillIds.map((skillId) => ({ agentId: agent.id, skillId })));
    }
    return { ...agent, skillIds };
  });
}

export const agentRoutes = new Hono()
  .get('/', async (c) => {
    const [rows, links] = await Promise.all([
      db.select().from(agents),
      db.select().from(agentSkills),
    ]);
    const skillIds = Map.groupBy(links, (link) => link.agentId);
    const result = rows
      .map((agent) => ({
        ...agent,
        skillIds: (skillIds.get(agent.id) ?? []).map((link) => link.skillId),
      }))
      .sort((a, b) => compareFr(a.lastName, b.lastName) || compareFr(a.firstName, b.firstName));
    return c.json(result);
  })

  .post('/', validate('json', agentInput), async (c) => {
    const agent = await saveAgent(undefined, c.req.valid('json'));
    return c.json(agent!, 201);
  })

  .put('/:id', validate('param', idParam), validate('json', agentInput), async (c) => {
    const agent = await saveAgent(c.req.valid('param').id, c.req.valid('json'));
    return agent ? c.json(agent, 200) : c.json(notFound, 404);
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const [row] = await db
      .delete(agents)
      .where(eq(agents.id, c.req.valid('param').id))
      .returning({ id: agents.id });
    return row ? c.body(null, 204) : c.json(notFound, 404);
  });
