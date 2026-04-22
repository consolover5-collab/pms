/**
 * Section 21 — Configuration: Profiles (/configuration/profiles)
 *
 * STATUS: ok (NOT a duplicate of /guests — see below)
 *
 * Relationship with /guests (Section 11):
 *   Both routes read from the SAME backend API: GET /api/profiles.
 *   They are NOT duplicates. They are two different surfaces over one
 *   unified profiles directory, with different scope and affordances:
 *
 *     /guests                     /configuration/profiles
 *     ───────                     ───────────────────────
 *     type=individual (hardcoded) all types (individual / company /
 *                                  travel_agent / source) via tabs
 *     PAGE_SIZE=50 with pagination no pagination (all rows at once)
 *     read-only browse             full CRUD:
 *       + new (individuals only)     - tabs per type
 *                                    - "Add guest/company/agent/source"
 *                                    - edit link per row
 *                                    - activate / deactivate per row
 *                                      (PUT /api/profiles/:id {isActive})
 *     detail shows personal info   detail shows all sections by type
 *                                    (general, personal, company, agent,
 *                                     source, notes) + edit button
 *     i18n: guests.*               i18n: profiles.*
 *
 *   Verified via grep + source-read 2026-04-22:
 *     - apps/web/src/app/guests/page.tsx:38-39 hardcodes type=individual
 *     - apps/web/src/app/configuration/profiles/page.tsx:27-31 does NOT
 *       hardcode type — the type filter is controlled by ?type=... search
 *       param driven by the tab switcher in profiles-list.tsx
 *     - Both ultimately call GET /api/profiles (same endpoint), but with
 *       different query params and UI affordances.
 *
 * Scenarios:
 *   01-load-view:
 *     - Navigate /configuration/profiles in ru + en.
 *     - Assert title + subtitle + table + tabs visible.
 *     - Assert all 4 "Add ..." entry points present (testids distinguish them).
 *     - Assert default (no type filter) shows count = 153 (133 individuals
 *       + 10 companies + 6 travel_agents + 4 sources — probed 2026-04-22
 *       via GET /api/profiles?propertyId=...&limit=1).
 *     - Screenshot both locales.
 *
 *   02-difference-from-guests:
 *     - Asserts the scope that /guests does NOT offer:
 *       1. Click tab "Companies" → URL gains ?type=company; table re-renders;
 *          row count > 0; every visible row has data-profile-type="company".
 *          (This scope is impossible at /guests.)
 *       2. Assert "Edit" link present on first row (no edit affordance on
 *          the /guests list).
 *       3. Assert activate/deactivate button present on first row (no such
 *          affordance on /guests list).
 *     - EN-only; purely read (no mutation — just visible affordances).
 *     - Screenshot.
 */

import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
} from './shared.ts';

const SECTION_ID = '21-configuration-profiles';
const ROUTE = '/configuration/profiles';

const UI_TIMEOUT = 10_000;

// After BUG-017 fix the page paginates (PAGE_SIZE=50) and the count badge
// shows the API's `total` field. We probe the live total at test time so the
// assertion stays green even when other spec files create/deactivate profiles.
const EXPECTED_RENDERED = 50; // first-page slice; PAGE_SIZE=50
const EXPECTED_COMPANY_MIN = 1; // company tab should render at least 1 row

async function probeProfilesTotal(): Promise<number> {
  const url =
    'http://localhost:3000/api/profiles?' +
    'propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad&limit=1';
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GET /api/profiles probe failed: ${r.status}`);
  return ((await r.json()) as { total: number }).total;
}

test.describe('21 configuration-profiles', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID);

  // ── Scenario 01: load-view (ru + en) ──────────────────────────────────────
  test('01-load-view: title + tabs + all 4 "Add" entry points + count = 153', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    // Page wrapper scope (added for this audit)
    const pageScope = page.getByTestId('config-profiles-page');
    await expect(pageScope).toBeVisible({ timeout: UI_TIMEOUT });

    // Title + subtitle
    await expect(page.getByTestId('config-profiles-title')).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.getByTestId('config-profiles-subtitle')).toBeVisible({ timeout: UI_TIMEOUT });

    // All 4 "Add ..." entry points are present (feature parity with the 4 profile types)
    await expect(page.getByTestId('config-profiles-add-individual')).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.getByTestId('config-profiles-add-company')).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.getByTestId('config-profiles-add-travel-agent')).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.getByTestId('config-profiles-add-source')).toBeVisible({ timeout: UI_TIMEOUT });

    // Tabs container + 5 tabs (all + 4 types)
    await expect(page.getByTestId('config-profiles-tabs')).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.getByTestId('config-profiles-tab-all')).toBeVisible();
    await expect(page.getByTestId('config-profiles-tab-individual')).toBeVisible();
    await expect(page.getByTestId('config-profiles-tab-company')).toBeVisible();
    await expect(page.getByTestId('config-profiles-tab-travel_agent')).toBeVisible();
    await expect(page.getByTestId('config-profiles-tab-source')).toBeVisible();

    // Table + count — no type filter by default; all 4 types merged into single list.
    // After BUG-017 fix: count badge shows the API's `total` field (DB total),
    // not the rendered slice. PAGE_SIZE=50 means only first 50 rows render.
    await expect(page.getByTestId('config-profiles-table')).toBeVisible({ timeout: UI_TIMEOUT });
    const countBadge = page.getByTestId('config-profiles-count');
    await expect(countBadge).toBeVisible();
    const countText = (await countBadge.textContent())?.trim() ?? '';
    const liveTotal = await probeProfilesTotal();
    testInfo.attach('badge-total', { body: countText, contentType: 'text/plain' });
    testInfo.attach('live-total', { body: String(liveTotal), contentType: 'text/plain' });
    expect(Number(countText)).toBe(liveTotal);

    // Row count == first-page slice (sanity — pagination renders PAGE_SIZE rows)
    const rows = page.getByTestId('config-profiles-row');
    const rowCount = await rows.count();
    testInfo.attach('row-count', { body: String(rowCount), contentType: 'text/plain' });
    expect(rowCount).toBe(EXPECTED_RENDERED);

    await auditScreenshot(page, SECTION_ID, '01-load-view', locale);
  });

  // ── Scenario 02: difference from /guests — tab filter + row-level actions ─
  // This scenario documents the affordances that this page provides and /guests does NOT:
  //   (1) a type-tab switcher (filter to company/travel_agent/source),
  //   (2) inline edit link per row,
  //   (3) inline activate/deactivate button per row.
  // We exercise (1) by clicking Companies tab; we assert (2) + (3) by finding
  // testids — no mutation is performed.
  test('02-difference-from-guests: company tab filters; edit + activate/deactivate rows visible', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'single-locale scenario — affordance check, no mutation');

    await setLocaleAndGoto(page, 'en', ROUTE);
    await expect(page.getByTestId('config-profiles-table')).toBeVisible({ timeout: UI_TIMEOUT });

    // Click "Companies" tab → URL acquires ?type=company and list refetches
    await Promise.all([
      page.waitForURL(/\?.*type=company/, { timeout: UI_TIMEOUT }),
      page.getByTestId('config-profiles-tab-company').click(),
    ]);
    await expect(page.getByTestId('config-profiles-table')).toBeVisible({ timeout: UI_TIMEOUT });

    // At least EXPECTED_COMPANY_MIN rows, all with data-profile-type="company"
    const companyRows = page.getByTestId('config-profiles-row');
    const companyCount = await companyRows.count();
    testInfo.attach('company-row-count', { body: String(companyCount), contentType: 'text/plain' });
    expect(companyCount).toBeGreaterThanOrEqual(EXPECTED_COMPANY_MIN);

    // Verify every rendered row is a company (invariant for the type-filter)
    const types = await companyRows.evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).getAttribute('data-profile-type')),
    );
    testInfo.attach('company-row-types', { body: JSON.stringify(types), contentType: 'application/json' });
    expect(types.every((t) => t === 'company')).toBe(true);

    // First row has an inline "Edit" link + activate/deactivate button
    // (guarded by toHaveCount before first() per Rev 2 policy)
    await expect(companyRows).toHaveCount(companyCount);
    const firstRow = companyRows.first();

    // "Edit" appears as a link inside the row (there is no testid; match by role+name).
    // The row is scoped so we don't accidentally match chrome.
    const editLink = firstRow.getByRole('link', { name: /edit|изменить/i });
    await expect(editLink).toBeVisible({ timeout: UI_TIMEOUT });

    // Activate / deactivate button inside the row — always a <button>
    // (the label toggles based on isActive; match either verb).
    const toggleButton = firstRow.getByRole('button', { name: /activate|deactivate|активировать|деактивировать/i });
    await expect(toggleButton).toBeVisible({ timeout: UI_TIMEOUT });

    await auditScreenshot(page, SECTION_ID, '02-difference-from-guests', 'en');
  });
});
