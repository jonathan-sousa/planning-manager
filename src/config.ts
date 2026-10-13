import type { AppConfig } from './app-config';

/** The stage's /config.json; on failure the page says so instead of staying blank. */
async function loadConfig(): Promise<AppConfig> {
  try {
    const response = await fetch('/config.json');
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error(`config.json : ${response.status}`);
    }
    return (await response.json()) as AppConfig;
  } catch (error) {
    document.getElementById('root')!.textContent =
      "Impossible de charger la configuration de l'application : vérifiez la connexion, puis rechargez la page.";
    throw error;
  }
}

export const config = await loadConfig();
