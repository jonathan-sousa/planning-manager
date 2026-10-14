import { eq } from 'drizzle-orm';
import type { ShiftKind } from './domain';
import { db } from './db/client';
import { shiftTypes } from './db/schema';
import { ValidationError } from './errors';

/**
 * Rejects a reference to a shift type of the wrong kind (e.g. a coverage need
 * on an absence code). Needs a database read, so it lives outside the Zod
 * schemas. An unknown id is left to the foreign key.
 */
export async function requireShiftKind(
  shiftTypeId: string | null,
  { kinds, message }: { kinds: readonly ShiftKind[]; message: string }
): Promise<void> {
  if (!shiftTypeId) return;
  const [shift] = await db
    .select({ kind: shiftTypes.kind })
    .from(shiftTypes)
    .where(eq(shiftTypes.id, shiftTypeId));
  if (shift && !kinds.includes(shift.kind)) {
    throw new ValidationError({ shiftTypeId: [message] });
  }
}

export const WORK_SHIFT = { kinds: ['WORK'], message: 'Un poste travaillé est attendu' } as const;
export const ABSENCE_CODE = {
  kinds: ['ABSENCE', 'REST'],
  message: "Un code d'absence ou de repos est attendu",
} as const;
