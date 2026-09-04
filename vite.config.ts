import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const serverPort = Number(env.VITE_PORT) || 3000;

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port: serverPort,
      strictPort: true,
      hmr: env.DISABLE_HMR === 'true' ? false : undefined,
    },
    preview: {
      host: '0.0.0.0',
      port: Number(env.VITE_PREVIEW_PORT) || 5500,
      strictPort: true,
    },
    build: {
      rolldownOptions: {
        output: {
          strictExecutionOrder: true,
          codeSplitting: {
            groups: [
              { name: 'react-vendor', test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/, priority: 30 },
              { name: 'supabase-vendor', test: /node_modules[\\/]@supabase[\\/]/, priority: 20 },
              { name: 'ui-vendor', test: /node_modules[\\/](?:motion|lucide-react|date-fns)[\\/]/, priority: 15 },
              { name: 'vendor', test: /node_modules[\\/]/, priority: 10, maxSize: 250_000 },
            ],
          },
        },
      },
    },
  };
});
