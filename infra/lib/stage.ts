import { userInfo } from 'node:os';

/** The production stage, hosted on its own domain (the others run with the Vite dev server). */
export const PROD_STAGE = 'prod';

/** A stage name, or the developer's personal stage (their user name) by default. */
export function resolveStage(name?: string): string {
  const stage = name || userInfo().username;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(stage)) {
    throw new Error(`Invalid stage "${stage}": use lowercase letters, digits and dashes`);
  }
  return stage;
}
