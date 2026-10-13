import { HTTPException } from 'hono/http-exception';

/** JSON body of every API error response. `fields` maps a form field to its messages. */
export type ApiError = { error: string; fields?: Record<string, string[]> };

/** Invalid input, rendered as 400 with per-field messages by `toErrorResponse`. */
export class ValidationError extends Error {
  readonly fields: Record<string, string[]>;

  constructor(fields: Record<string, string[]>) {
    super('Données invalides');
    this.fields = fields;
  }
}

type PgError = { code: string; constraint?: string };

/** PostgreSQL error fields, also when Drizzle wrapped the error in DrizzleQueryError. */
export function pgError(error: unknown): PgError | undefined {
  for (let current = error; current instanceof Error; current = current.cause) {
    const { code, constraint } = current as { code?: unknown; constraint?: unknown };
    if (typeof code === 'string') {
      return { code, constraint: typeof constraint === 'string' ? constraint : undefined };
    }
  }
  return undefined;
}

const duplicateCode = { field: 'code', message: 'Code déjà utilisé' };

/** Unique constraints of the schema, by name: the form field at fault and the message. */
const uniqueViolations: Record<string, { field?: string; message: string }> = {
  grades_code_idx: duplicateCode,
  skills_code_idx: duplicateCode,
  shift_types_active_code_idx: duplicateCode,
  coverage_needs_slot_key: {
    message: 'Un besoin existe déjà pour ce poste, ce grade, cette compétence et ce type de jour',
  },
  coverage_overrides_slot_key: {
    message: 'Une exception existe déjà pour cette date, ce poste, ce grade et cette compétence',
  },
};

/** Names of the unique constraints mapped to a message (checked against the migrations). */
export const uniqueConstraintNames = Object.keys(uniqueViolations);

/** Maps an error to its HTTP status and body; undefined for unexpected errors (500). */
export function toErrorResponse(
  error: unknown,
  method: string
): { status: 400 | 409; body: ApiError } | undefined {
  // Raised by Hono's validator on a body that is not JSON.
  if (error instanceof HTTPException && error.status === 400) {
    return { status: 400, body: { error: 'Requête invalide' } };
  }
  if (error instanceof ValidationError) {
    return { status: 400, body: { error: error.message, fields: error.fields } };
  }
  const pg = pgError(error);
  if (pg?.code === '23505') {
    const violation = (pg.constraint && uniqueViolations[pg.constraint]) || {
      message: 'Doublon',
    };
    return {
      status: 409,
      body: {
        error: violation.message,
        ...(violation.field && { fields: { [violation.field]: [violation.message] } }),
      },
    };
  }
  if (pg?.code === '23503') {
    // On DELETE the row is still referenced; on writes a referenced row is missing.
    return method === 'DELETE'
      ? { status: 409, body: { error: 'Suppression impossible : élément encore utilisé' } }
      : { status: 400, body: { error: 'Référence inconnue' } };
  }
  return undefined;
}

export const notFound: ApiError = { error: 'Introuvable' };
