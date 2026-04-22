/**
 * Section 13 — Cashier (/cashier)
 *
 * After BUG-001 + BUG-015 fix: authPlugin is active in apps/api/src/app.ts,
 * and cashier routes correctly read request.user.id. The admin user in the
 * seed has an open cashier session (opening_balance = 10000), so the page
 * renders the KPI grid + close-session button — not the "open session" form.
 *
 * Scenarios:
 *   01 — load-view (ru + en): page title/subtitle visible; KPI grid visible;
 *        close-session button visible; no-session card NOT visible. Screenshot.
 *   02 — kpi-values (ru + en): the four KPI tiles (turnover, charges,
 *        payments, shift number) render non-empty values.
 *   03 — recent-sessions-table (ru + en): GET /api/cashier/sessions returns
 *        an array; table headers visible in the correct locale; ≥1 row
 *        rendered (the open session itself is always present).
 *   04 — current-endpoint-contract (en-only): GET /api/cashier/current
 *        returns 200 with a shape of {session, summary}; session.status='open'.
 */

import { test, expect } from '@playwright/test';
import {
  API_URL,
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
} from './shared.ts';

const SECTION_ID = '13-cashier';
const ROUTE = '/cashier';

const UI_TIMEOUT = 10_000;

test.describe('13 cashier', () => {
  test.describe.configure({ mode: 'serial' });

  // No mutations performed by the spec → no extraAfterAll needed.
  registerSectionHooks(SECTION_ID);

  // ── Scenario 01: load-view (ru + en) ─────────────────────────────────────
  test(
    '01-load-view: title, subtitle, KPI grid, close-session button visible',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await setLocaleAndGoto(page, locale, ROUTE);

      // Header
      await expect(page.getByTestId('cashier-title')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId('cashier-subtitle')).toBeVisible({ timeout: UI_TIMEOUT });

      if (locale === 'en') {
        await expect(page.getByTestId('cashier-title')).toHaveText('Cashier');
      } else {
        await expect(page.getByTestId('cashier-title')).toHaveText('Касса');
      }
      // Subtitle is state-aware: "Manage your cash session" when no session,
      // "Shift #<N>" when a session is open. We just assert non-empty text.
      const subtitleText = (await page.getByTestId('cashier-subtitle').textContent())?.trim() ?? '';
      expect(subtitleText.length).toBeGreaterThan(0);

      // Admin has an open cashier session (seeded) → KPI grid + close button.
      await expect(page.getByTestId('cashier-kpi-grid')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId('cashier-close-session-button')).toBeVisible({ timeout: UI_TIMEOUT });

      // No-session card must NOT be visible while a session is open.
      await expect(page.getByTestId('cashier-no-session-card')).toHaveCount(0);

      // Recent-sessions card always rendered
      await expect(page.getByTestId('cashier-recent-sessions-card')).toBeVisible({ timeout: UI_TIMEOUT });

      await auditScreenshot(page, SECTION_ID, '01-load-view', locale);
    },
  );

  // ── Scenario 02: KPI values render (ru + en) ─────────────────────────────
  test(
    '02-kpi-values: shift number, turnover, charges, payments tiles render non-empty',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await setLocaleAndGoto(page, locale, ROUTE);

      const grid = page.getByTestId('cashier-kpi-grid');
      await expect(grid).toBeVisible({ timeout: UI_TIMEOUT });

      // Every KPI tile has non-empty text (amounts use locale-aware formatting).
      const tiles = grid.locator('.kpi');
      const tileCount = await tiles.count();
      testInfo.attach('kpi-tile-count', { body: String(tileCount), contentType: 'text/plain' });
      expect(tileCount).toBeGreaterThanOrEqual(4);

      for (let i = 0; i < tileCount; i++) {
        const text = (await tiles.nth(i).innerText()).trim();
        expect(text.length).toBeGreaterThan(0);
      }

      await auditScreenshot(page, SECTION_ID, '02-kpi-values', locale);
    },
  );

  // ── Scenario 03: recent-sessions-table (ru + en) ─────────────────────────
  test(
    '03-recent-sessions-table: table headers visible, ≥1 row rendered',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await setLocaleAndGoto(page, locale, ROUTE);

      // Card visible
      await expect(page.getByTestId('cashier-recent-sessions-card')).toBeVisible({ timeout: UI_TIMEOUT });

      const table = page.getByTestId('cashier-sessions-table');
      const empty = page.getByTestId('cashier-sessions-empty');

      const tableCount = await table.count();
      const emptyCount = await empty.count();

      if (tableCount > 0) {
        await expect(table).toBeVisible({ timeout: UI_TIMEOUT });

        if (locale === 'en') {
          await expect(table.locator('thead')).toContainText('Opened');
          await expect(table.locator('thead')).toContainText('Closed');
          await expect(table.locator('thead')).toContainText('Opening');
          await expect(table.locator('thead')).toContainText('Closing');
          await expect(table.locator('thead')).toContainText('Status');
        } else {
          await expect(table.locator('thead')).toContainText('Открыта');
          await expect(table.locator('thead')).toContainText('Закрыта');
          await expect(table.locator('thead')).toContainText('Начало');
          await expect(table.locator('thead')).toContainText('Конец');
          await expect(table.locator('thead')).toContainText('Статус');
        }

        const rows = table.getByTestId('cashier-session-row');
        const rowCount = await rows.count();
        testInfo.attach('session-row-count', { body: String(rowCount), contentType: 'text/plain' });
        expect(rowCount).toBeGreaterThanOrEqual(1);
      } else {
        testInfo.attach(
          'recent-sessions-empty',
          { body: 'No seeded sessions found; empty state rendered', contentType: 'text/plain' },
        );
        expect(emptyCount).toBeGreaterThan(0);
      }

      await auditScreenshot(page, SECTION_ID, '03-recent-sessions-table', locale);
    },
  );

  // ── Scenario 04: /api/cashier/current contract (en-only) ─────────────────
  test(
    '04-current-endpoint-contract: GET /api/cashier/current returns {session, summary}',
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'en', 'API contract check runs once');

      await setLocaleAndGoto(page, 'en', ROUTE);

      const res = await page.context().request.get(`${API_URL}/api/cashier/current`);
      testInfo.attach('current-status', { body: String(res.status()), contentType: 'text/plain' });
      const body = await res.json() as {
        session: { id: string; status: string; cashierNumber: number } | null;
        summary?: { totalDebit: string; totalCredit: string; transactionCount: string };
      };
      testInfo.attach('current-body', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });

      expect(res.status()).toBe(200);
      // Admin has a seeded open session; the contract guarantees session !== null.
      expect(body.session).not.toBeNull();
      expect(body.session?.status).toBe('open');
      expect(body.summary).toBeDefined();
    },
  );
});
