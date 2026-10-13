/**
 * Ids and URLs of the stage, read at startup from /config.json: written next
 * to the app when it is deployed (infra/lib/web.ts), served by the Vite dev
 * server from .env.local in development (vite.config.ts).
 */
export interface AppConfig {
  userPoolId: string;
  userPoolClientId: string;
  /** Host name of Managed Login, without scheme. */
  authDomain: string;
  apiUrl: string;
}

const response = await fetch('/config.json');
if (!response.ok) throw new Error(`config.json : ${response.status}`);

export const config: AppConfig = await response.json();
