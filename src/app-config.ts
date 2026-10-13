/**
 * Ids and URLs of a stage, served as /config.json: written next to the app at
 * deployment (infra/lib/web.ts), by the Vite dev server in development
 * (vite.config.ts). Read at startup by src/config.ts.
 */
export interface AppConfig {
  userPoolId: string;
  userPoolClientId: string;
  /** Host name of Managed Login, without scheme. */
  authDomain: string;
  apiUrl: string;
}
