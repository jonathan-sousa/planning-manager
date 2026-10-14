import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { requireActiveAdmin } from '../accounts';
import { type Bindings, requireAdmin } from '../auth';
import { db } from '../db/client';
import { ruleSettings } from '../db/schema';
import { ruleSettingsInput } from '../schemas';
import { validate } from '../validate';

// Single row, inserted by the migration.
const DEFAULT_ID = 'default';

export const ruleSettingsRoutes = new Hono<{ Bindings: Bindings }>()
  .get('/', async (c) => {
    const [row] = await db.select().from(ruleSettings).where(eq(ruleSettings.id, DEFAULT_ID));
    return c.json(row!);
  })

  // Every manager reads the rules; admins change them.
  .put('/', requireAdmin, requireActiveAdmin, validate('json', ruleSettingsInput), async (c) => {
    const [row] = await db
      .update(ruleSettings)
      .set(c.req.valid('json'))
      .where(eq(ruleSettings.id, DEFAULT_ID))
      .returning();
    return c.json(row!, 200);
  });
