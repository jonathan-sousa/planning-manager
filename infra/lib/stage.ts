import { userInfo } from 'node:os';

/** The production stage, hosted on its own domain (the others run with the Vite dev server). */
export const PROD_STAGE = 'prod';

/**
 * A stage name, or the developer's personal stage by default: their user
 * name, lowercased, with any other character than a letter or digit as a dash.
 */
export function resolveStage(name?: string): string {
  const stage =
    name ||
    userInfo()
      .username.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(stage)) {
    throw new Error(`Invalid stage "${stage}": use lowercase letters, digits and dashes`);
  }
  return stage;
}
