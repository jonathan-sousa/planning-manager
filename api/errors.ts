/** SQLSTATE of a PostgreSQL error, also when Drizzle wrapped it in DrizzleQueryError. */
export function pgErrorCode(error: unknown): string | undefined {
  for (let current = error; current instanceof Error; current = current.cause) {
    const { code } = current as { code?: unknown };
    if (typeof code === 'string') return code;
  }
  return undefined;
}
