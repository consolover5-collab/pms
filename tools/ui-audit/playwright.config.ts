import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webUrl = process.env.AUDIT_WEB_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './src',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['line']],
  use: {
    baseURL: webUrl,
    headless: true,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'ru',
      use: { ...devices['Desktop Chrome'], locale: 'ru-RU' },
    },
    {
      name: 'en',
      use: { ...devices['Desktop Chrome'], locale: 'en-US' },
    },
  ],
  outputDir: path.resolve(__dirname, './test-results'),
});
