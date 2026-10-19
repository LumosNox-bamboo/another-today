import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/web',
  testMatch: '**/{web,pwa}.e2e.ts',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.WEB_URL || 'http://127.0.0.1:4173/another-today/',
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: process.env.WEB_URL
    ? undefined
    : {
        command:
          'npx vite preview --host 127.0.0.1 --port 4173 --strictPort --base /another-today/',
        url: 'http://127.0.0.1:4173/another-today/',
        reuseExistingServer: !process.env.CI,
      },
});
