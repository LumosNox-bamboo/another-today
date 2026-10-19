import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/cloud.e2e.ts',
  outputDir: 'test-results/cloud',
  workers: 1,
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
  projects: [
    { name: 'cloud-chromium', use: { channel: process.env.CI ? undefined : 'chrome' } },
    { name: 'cloud-webkit', use: { ...devices['iPhone 13'], channel: undefined } },
  ],
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4175 --strictPort',
    env: {
      VITE_SUPABASE_URL: 'https://sync-test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
    },
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
  },
});
