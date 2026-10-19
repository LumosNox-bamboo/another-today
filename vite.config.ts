import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { cloudConfiguration } from './src/cloud/config';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const cloud = cloudConfiguration(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return {
    base: './',
    plugins: [
      react(),
      {
        name: 'cloud-connect-policy',
        transformIndexHtml(html) {
          return cloud
            ? html.replace("connect-src 'self'", `connect-src 'self' ${cloud.url}`)
            : html;
        },
      },
    ],
    test: { include: ['tests/**/*.test.ts'] },
  };
});
