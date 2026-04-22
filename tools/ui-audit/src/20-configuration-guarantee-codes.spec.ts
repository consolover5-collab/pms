/**
 * Section 20 — Configuration: Guarantee Codes (/configuration/guarantee-codes)
 *
 * STATUS: missing
 *
 * The page at /configuration/guarantee-codes is a READ-ONLY documentation stub.
 * There is no CRUD API (no apps/api/src/routes/guarantee-codes.ts, no
 * /api/guarantee-codes endpoint) and no create/edit/delete UI affordances.
 * The 5 guarantee codes are hardcoded in page.tsx, and the same 5 codes are
 * ALSO hardcoded as <option> elements in apps/web/src/app/bookings/[id]/edit/
 * booking-edit-form.tsx:609-613 — double source-of-truth (BUG-016).
 *
 * Scenarios:
 *   01-render-readonly-table:
 *     - Load page in ru + en.
 *     - Assert title, subtitle, table and 5 rows visible.
 *     - Assert no /api/guarantee-codes request is fired (verified via network log).
 *     - Screenshot in both locales.
 *
 *   02-no-crud-affordances:
 *     - Assert zero buttons/links with accessible name matching create/edit/delete
 *       (ru + en) on the page. Documents the missing CRUD UI as a positive
 *       invariant; if someone adds a "New Code" button in the future, this
 *       scenario flips red and forces a re-audit.
 */

import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
} from './shared.ts';

const SECTION_ID = '20-configuration-guarantee-codes';
const ROUTE = '/configuration/guarantee-codes';

const UI_TIMEOUT = 10_000;

const EXPECTED_CODES = [
  'cc_guaranteed',
  'company_guaranteed',
  'deposit_guaranteed',
  'non_guaranteed',
  'travel_agent_guaranteed',
] as const;

test.describe('20 configuration-guarantee-codes', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID);

  // ── Scenario 01: render read-only table (ru + en) ─────────────────────────
  test('01-render-readonly-table: 5 hardcoded codes visible; no /api/guarantee-codes call', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    // Track any request to /api/guarantee-codes (there is no such endpoint; asserting zero calls).
    const gcApiCalls: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/\/api\/guarantee-codes\b/.test(url)) {
        gcApiCalls.push(`${req.method()} ${url}`);
      }
    });

    await setLocaleAndGoto(page, locale, ROUTE);

    // Title + subtitle visible
    await expect(page.getByTestId('config-guarantee-codes-title')).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.getByTestId('config-guarantee-codes-subtitle')).toBeVisible({ timeout: UI_TIMEOUT });

    // Table visible
    await expect(page.getByTestId('config-guarantee-codes-table')).toBeVisible({ timeout: UI_TIMEOUT });

    // All 5 rows visible, each with their code value rendered
    for (const code of EXPECTED_CODES) {
      const row = page.getByTestId(`config-guarantee-codes-row-${code}`);
      await expect(row).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(row).toContainText(code);
    }

    // No API calls to /api/guarantee-codes (endpoint does not exist — positive invariant)
    testInfo.attach('gc-api-calls', { body: JSON.stringify(gcApiCalls), contentType: 'application/json' });
    expect(gcApiCalls).toHaveLength(0);

    await auditScreenshot(page, SECTION_ID, '01-render-readonly-table', locale);
  });

  // ── Scenario 02: no CRUD affordances on the page (ru + en) ────────────────
  test('02-no-crud-affordances: zero create/edit/delete buttons on the page', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    // Ensure the page has rendered before enumerating buttons
    await expect(page.getByTestId('config-guarantee-codes-table')).toBeVisible({ timeout: UI_TIMEOUT });

    // Patterns covering ru + en CRUD verbs. If a future "New Code" / "Создать" /
    // "Редактировать" / "Удалить" button is added, this regex will match and the
    // scenario flips red — forcing a re-audit.
    const crudPattern = /^(new|create|add|edit|delete|remove|создать|добавить|редактировать|изменить|удалить)\b/i;

    // Scope to the page wrapper (excluding site-wide chrome like topbar's
    // "New Booking" link, which lives outside the page container).
    const pageScope = page.getByTestId('config-guarantee-codes-page');

    // Collect both <button> and link-role elements (New-* affordances are often links to /new).
    const buttonsCount = await pageScope.getByRole('button', { name: crudPattern }).count();
    const linksCount = await pageScope.getByRole('link', { name: crudPattern }).count();

    testInfo.attach('crud-buttons-count', { body: String(buttonsCount), contentType: 'text/plain' });
    testInfo.attach('crud-links-count', { body: String(linksCount), contentType: 'text/plain' });

    expect(buttonsCount).toBe(0);
    expect(linksCount).toBe(0);
  });
});
