import { Page, test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SEED } from './seed-refs.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SCREENSHOTS_DIR = path.resolve(__dirname, '../../../docs/ui-audit/screenshots');
export const AUDIT_DATA_DIR = path.resolve(__dirname, '../audit-data');
export const API_URL = process.env.AUDIT_API_URL ?? 'http://localhost:3001';
export const WEB_URL = process.env.AUDIT_WEB_URL ?? 'http://localhost:3000';
export const GBH_PROPERTY_ID = SEED.property.GBH;

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

export async function loginAsAdmin(page: Page): Promise<void> {
  const resp = await page.context().request.post(`${WEB_URL}/api/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
    headers: { 'content-type': 'application/json' },
  });
  if (!resp.ok()) {
    throw new Error(`Login failed: ${resp.status()} ${await resp.text()}`);
  }
}

export async function setLocaleAndGoto(
  page: Page,
  locale: 'ru' | 'en',
  urlPath: string,
): Promise<void> {
  await loginAsAdmin(page);
  await page.context().addCookies([{ name: 'locale', value: locale, url: WEB_URL }]);
  await page.goto(urlPath);
  await page.waitForLoadState('networkidle');
}

export async function setNativeValue(
  page: Page,
  selector: string,
  value: string,
  index = 0,
): Promise<void> {
  await page.locator(selector).nth(index).evaluate((el, val) => {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

export async function pickFirstSelectOption(
  page: Page,
  selector: string,
): Promise<string> {
  return page.locator(selector).evaluate((el) => {
    const sel = el as HTMLSelectElement;
    for (const opt of Array.from(sel.options)) {
      if (opt.value && opt.value.length > 0) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return opt.value;
      }
    }
    return '';
  });
}

/**
 * Attaches the standard per-section beforeEach (error collectors + /api/* call
 * log) and afterAll (JSON dump into AUDIT_DATA_DIR/${sectionId}-errors.json)
 * hooks. Must be called from inside a `test.describe(...)` callback so the
 * hooks are scoped to that describe block.
 *
 * `options.extraAfterAll` runs BEFORE the JSON dump inside afterAll; it is
 * wrapped in a try/catch that logs to console without re-throwing so that a
 * failing safety-net never prevents the audit-data file from being written.
 *
 * The read-modify-write on the errors JSON assumes playwright.config.ts pins
 * `workers: 1` and `fullyParallel: false`. Relax either setting and the file
 * needs per-project keying or a lockfile to avoid last-writer-wins races.
 */
export function registerSectionHooks(
  sectionId: string,
  options?: { extraAfterAll?: () => Promise<void> },
): void {
  const errorsByProject: Record<
    string,
    Record<string, { console: ConsoleError[]; network: NetworkError[] }>
  > = {};
  const apiCallsByProject: Record<
    string,
    { method: string; path: string; status: number }[]
  > = {};

  test.beforeEach(async ({ page }, testInfo) => {
    const proj = testInfo.project.name;
    const testName = testInfo.title;
    const errors = wireErrorCollectors(page);
    errorsByProject[proj] ??= {};
    errorsByProject[proj][testName] = { console: errors.console, network: errors.network };

    apiCallsByProject[proj] ??= [];
    page.on('response', (res) => {
      const url = new URL(res.url());
      if (url.pathname.startsWith('/api/')) {
        apiCallsByProject[proj].push({
          method: res.request().method(),
          path: url.pathname + (url.search || ''),
          status: res.status(),
        });
      }
    });
  });

  test.afterAll(async () => {
    if (options?.extraAfterAll) {
      try {
        await options.extraAfterAll();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[registerSectionHooks:${sectionId}] extraAfterAll failed:`, err);
      }
    }

    const out = path.join(AUDIT_DATA_DIR, `${sectionId}-errors.json`);
    fs.mkdirSync(AUDIT_DATA_DIR, { recursive: true });
    let existing: { errors: typeof errorsByProject; api: typeof apiCallsByProject } = {
      errors: {},
      api: {},
    };
    try {
      existing = JSON.parse(fs.readFileSync(out, 'utf8'));
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== 'ENOENT') {
        // eslint-disable-next-line no-console
        console.warn(
          `[registerSectionHooks:${sectionId}] existing audit-data unreadable, discarding:`,
          e.message ?? e,
        );
      }
    }
    const merged = {
      errors: { ...existing.errors, ...errorsByProject },
      api: { ...existing.api, ...apiCallsByProject },
    };
    fs.writeFileSync(out, JSON.stringify(merged, null, 2));
  });
}
