import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 15 * 1000,
  expect: {
    timeout: 5000,
  },
  use: {
    browserName: 'chromium',
    headless: true,
  },
});
