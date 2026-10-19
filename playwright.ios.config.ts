import { defineConfig, devices } from '@playwright/test';
import web from './playwright.web.config';

export default defineConfig({
  ...web,
  outputDir: 'test-results/ios',
  use: { ...web.use, channel: undefined },
  projects: [{ name: 'iphone-webkit', use: { ...devices['iPhone 13'], channel: undefined } }],
});
