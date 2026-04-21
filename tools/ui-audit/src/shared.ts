import { Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SCREENSHOTS_DIR = path.resolve(__dirname, '../../../docs/ui-audit/screenshots');
export const API_URL = process.env.AUDIT_API_URL ?? 'http://localhost:3001';
export const GBH_PROPERTY_ID = 'ff1d9135-dfb9-4baa-be46-0e739cd26dad';

export async function auditScreenshot(
  page: Page,
  sectionId: string,
  step: string,
  locale: 'ru' | 'en',
): Promise<string> {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const filename = `${sectionId}-${step}-${locale}.png`;
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, filename),
    fullPage: true,
  });
  return filename;
}

export type ConsoleError = { type: 'console' | 'pageerror'; text: string };
export type NetworkError = { status: number; method: string; url: string };

export function wireErrorCollectors(page: Page): {
  console: ConsoleError[];
  network: NetworkError[];
} {
  const consoleErrs: ConsoleError[] = [];
  const networkErrs: NetworkError[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrs.push({ type: 'console', text: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    consoleErrs.push({ type: 'pageerror', text: err.message });
  });
  page.on('response', (res) => {
    const status = res.status();
    if (status >= 400) {
      networkErrs.push({ status, method: res.request().method(), url: res.url() });
    }
  });

  return { console: consoleErrs, network: networkErrs };
}

export async function waitForApi(attempts = 10): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(`${API_URL}/health`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API not healthy after ${attempts} attempts`);
}
