import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/** Serves /config.json (src/config.ts) from .env.local, written by `npm run env:write`. */
function stageConfig(): Plugin {
  return {
    name: 'stage-config',
    configureServer(server) {
      server.middlewares.use('/config.json', (_request, response) => {
        const env = loadEnv('development', import.meta.dirname, '');
        response.setHeader('Content-Type', 'application/json');
        response.end(
          JSON.stringify({
            userPoolId: env.USER_POOL_ID,
            userPoolClientId: env.USER_POOL_CLIENT_ID,
            authDomain: env.AUTH_DOMAIN,
            apiUrl: env.API_URL,
          })
        );
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Must come before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    stageConfig(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
