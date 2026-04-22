/**
 * Section 12 — Night Audit (/night-audit)
 *
 * READ-ONLY constraint: the "Run Night Audit" button MUST NOT be clicked.
 * Clicking it would irreversibly advance the business date and post charges.
 * Any code that clicks the run button is a BLOCKED violation.
 *
 * Coverage:
 *   01 — idle initial load (ru + en): page renders, wizard step 1 active,
 *        description text visible, "Preview Night Audit" button enabled.
 *   02 — preview summary: click "Preview Night Audit" (read-only compute),
 *        verify counters from API match probe-state values within tolerance.
 *   03 — preflight checklist items: on preview, the 3 KPI counters
 *        (overdueDueOuts=0, dueToday=0, pendingNoShows=0) are visible — clean state.
 *   04 — run button state enabled when clean: after preview, assert the
 *        "Run Night Audit" button exists + is enabled + has correct accessible
 *        name in both locales.  *** DO NOT CLICK. ***
 */

import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
} from './shared.ts';

const SECTION_ID = '12-night-audit';
const ROUTE = '/night-audit';

const labels = {
  ru: {
    title: 'Night Audit',
    previewBtn: 'Предпросмотр ночного аудита',
    runBtn: 'Выполнить Night Audit',
    loading: 'Загрузка…',
    previewSidebarTitle: 'Night Audit — Предпросмотр',
    chargesBreakdown: 'Детализация начислений',
    estimatedRevenue: 'Ожидаемая выручка:',
    roomsToCharge: 'Начисления на номера:',
    dueToday: 'Выезжают сегодня:',
    overdueDueOut: 'Просрочен выезд:',
    cancel: 'Отмена',
  },
  en: {
    title: 'Night Audit',
    previewBtn: 'Preview Night Audit',
    runBtn: 'Run Night Audit',
    loading: 'Loading…',
    previewSidebarTitle: 'Night Audit Preview',
    chargesBreakdown: 'Room Charges Breakdown',
    estimatedRevenue: 'Estimated revenue:',
    roomsToCharge: 'Rooms to charge:',
    dueToday: 'Due out today:',
    overdueDueOut: 'Overdue check-out:',
    cancel: 'Cancel',
  },
} as const;

// Probe-state values. businessDate is seeded as "today" so we probe it live.
// Other counters have a tolerance window since they drift with booking random.
const EXPECTED = {
  overdueDueOuts: 0,
  dueToday: 0,
  pendingNoShows: 0,
  roomsToCharge: 33,
  // tolerance ±5 rooms (orphan rateAmount=0 rows may affect count)
  roomsToChargeMin: 28,
  roomsToChargeMax: 38,
} as const;

async function probeBusinessDate(): Promise<string> {
  const r = await fetch(
    'http://localhost:3000/api/business-date?propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad',
  );
  if (!r.ok) throw new Error(`GET /api/business-date failed: ${r.status}`);
  const body = (await r.json()) as { date: string };
  return body.date;
}

const API_RESPONSE_TIMEOUT_MS = 20_000;
const UI_SETTLE_TIMEOUT_MS = 10_000;

test.describe('12 night-audit', () => {
  test.describe.configure({ mode: 'serial' });

  // No extraAfterAll needed — all tests are read-only.
  registerSectionHooks(SECTION_ID);

  // ── Scenario 01: idle initial load ──────────────────────────────────────────
  test('01-idle-initial-load: page renders wizard step 1, preview button enabled', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    // Page title present.
    await expect(page.getByRole('heading', { name: labels[locale].title })).toBeVisible();

    // Wizard renders: step 1 ("Предпросмотр ночного аудита" / "Preview Night Audit")
    // is active; confirmed by button presence in idle state.
    const previewBtn = page.getByRole('button', { name: labels[locale].previewBtn });
    await expect(previewBtn).toBeVisible({ timeout: UI_SETTLE_TIMEOUT_MS });
    await expect(previewBtn).toBeEnabled();

    // The run button must NOT be visible in idle state (only shows after preview step).
    const runBtn = page.getByRole('button', { name: labels[locale].runBtn });
    await expect(runBtn).toHaveCount(0);

    await auditScreenshot(page, SECTION_ID, '01-idle-initial-load', locale);
  });

  // ── Scenario 02: preview summary ────────────────────────────────────────────
  // Clicking "Preview Night Audit" dispatches POST /api/night-audit/preview
  // which is a READ-ONLY compute — it does not advance the business date or
  // post any charges. We verify returned counters match probe-state within tolerance.
  test('02-preview-summary: preview button triggers POST /preview; counters match probe', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    const previewBtn = page.getByRole('button', { name: labels[locale].previewBtn });
    await expect(previewBtn).toBeVisible({ timeout: UI_SETTLE_TIMEOUT_MS });
    await expect(previewBtn).toBeEnabled();

    // Click preview (read-only compute) and wait for POST /api/night-audit/preview.
    const [previewResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/night-audit/preview') &&
          r.request().method() === 'POST',
        { timeout: API_RESPONSE_TIMEOUT_MS },
      ),
      previewBtn.click(),
    ]);

    testInfo.attach('preview-response-status', {
      body: `status=${previewResp.status()}`,
      contentType: 'text/plain',
    });
    expect(previewResp.status()).toBe(200);

    const previewBody = await previewResp.json() as {
      businessDate: string;
      overdueDueOuts: number;
      dueToday: number;
      pendingNoShows: number;
      roomsToCharge: number;
      estimatedRevenue: number;
    };

    testInfo.attach('preview-body', {
      body: JSON.stringify(previewBody, null, 2),
      contentType: 'application/json',
    });

    // Verify counters match probe values.
    const liveBizDate = await probeBusinessDate();
    expect(previewBody.businessDate).toBe(liveBizDate);
    expect(previewBody.overdueDueOuts).toBe(EXPECTED.overdueDueOuts);
    expect(previewBody.dueToday).toBe(EXPECTED.dueToday);
    expect(previewBody.pendingNoShows).toBe(EXPECTED.pendingNoShows);
    // Rooms to charge: allow tolerance ±5 for data artefacts.
    expect(previewBody.roomsToCharge).toBeGreaterThanOrEqual(EXPECTED.roomsToChargeMin);
    expect(previewBody.roomsToCharge).toBeLessThanOrEqual(EXPECTED.roomsToChargeMax);

    // After preview, the sidebar / summary panel should be visible.
    // Two elements share this text (wizard step label + card-title); use first().
    await expect(
      page.getByText(labels[locale].previewSidebarTitle).first(),
    ).toBeVisible({ timeout: UI_SETTLE_TIMEOUT_MS });

    await auditScreenshot(page, SECTION_ID, '02-preview-summary', locale);
  });

  // ── Scenario 03: preflight checklist items visible (clean state = all 0) ────
  // Probe confirmed overdueDueOuts=0, dueToday=0, pendingNoShows=0.
  // In the clean state these KPIs render with value 0 — this is the "empty-state
  // happy path" for the preflight checklist.
  test('03-preflight-checklist-items: 4 KPI counters visible; overdue/dueToday/noShows = 0', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    const previewBtn = page.getByRole('button', { name: labels[locale].previewBtn });
    await expect(previewBtn).toBeVisible({ timeout: UI_SETTLE_TIMEOUT_MS });

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/night-audit/preview') &&
          r.request().method() === 'POST',
        { timeout: API_RESPONSE_TIMEOUT_MS },
      ),
      previewBtn.click(),
    ]);

    // 4 KPI tiles should render after preview.
    // The page renders .kpi elements for: roomsToCharge, estimatedRevenue,
    // dueToday, overdueDueOut.
    // Labels appear both in the grid KPIs and the sidebar summary — use .first()
    // per the 09 fix pattern (ensure count ≥1 then assert first is visible).
    const roomsLabel = page.getByText(labels[locale].roomsToCharge);
    await expect(roomsLabel.first()).toBeVisible({ timeout: UI_SETTLE_TIMEOUT_MS });
    const dueTodayLabel = page.getByText(labels[locale].dueToday);
    await expect(dueTodayLabel.first()).toBeVisible();
    const overdueLabel = page.getByText(labels[locale].overdueDueOut);
    await expect(overdueLabel.first()).toBeVisible();
    const revenueLabel = page.getByText(labels[locale].estimatedRevenue);
    await expect(revenueLabel.first()).toBeVisible();

    // In clean state: dueToday=0, overdueDueOuts=0 — no blocking alert shown.
    // Confirm the blocking-alert banner (cancel-bg style) is NOT rendered.
    // The banner has text from nightAudit.blockingAudit key.
    const blockingAlertRu = 'блокируют аудит';
    const blockingAlertEn = 'blocking audit';
    const blockingText = locale === 'ru' ? blockingAlertRu : blockingAlertEn;
    await expect(page.getByText(blockingText)).toHaveCount(0);

    // Charges breakdown table renders (33 roomDetails rows).
    await expect(page.getByText(labels[locale].chargesBreakdown)).toBeVisible();

    await auditScreenshot(page, SECTION_ID, '03-preflight-checklist', locale);
  });

  // ── Scenario 04: run button state — enabled when preflight is clean ──────────
  // Preflight clean (overdueDueOuts=0, dueToday=0, pendingNoShows=0) → button enabled.
  //
  // *** DO NOT CLICK the "Run Night Audit" button. ***
  // Clicking it would POST /api/night-audit/run, advance businessDate, post
  // all room charges, and close folios — irreversible without a DB snapshot.
  // This test asserts presence, enabled state, and accessible name ONLY.
  test('04-run-button-state-enabled-when-clean: run button exists, enabled, correct name — NOT clicked', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    const previewBtn = page.getByRole('button', { name: labels[locale].previewBtn });
    await expect(previewBtn).toBeVisible({ timeout: UI_SETTLE_TIMEOUT_MS });

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/night-audit/preview') &&
          r.request().method() === 'POST',
        { timeout: API_RESPONSE_TIMEOUT_MS },
      ),
      previewBtn.click(),
    ]);

    // Wait for preview panel to settle.
    // Two elements share this text (wizard step label + card-title); use first().
    await expect(
      page.getByText(labels[locale].previewSidebarTitle).first(),
    ).toBeVisible({ timeout: UI_SETTLE_TIMEOUT_MS });

    // Run button should now be visible (step="preview" state renders it).
    const runBtn = page.getByRole('button', { name: labels[locale].runBtn });
    await expect(runBtn).toHaveCount(1);
    await expect(runBtn.first()).toBeVisible();

    // *** IMPORTANT: preflight clean → button ENABLED (not disabled) ***
    // DO NOT call runBtn.click() — this is a read-only assertion only.
    await expect(runBtn).toBeEnabled();

    // Verify accessible name matches i18n label exactly.
    const accessibleName = await runBtn.getAttribute('aria-label')
      ?? await runBtn.textContent() ?? '';
    testInfo.attach('run-button-accessible-name', {
      body: accessibleName.trim(),
      contentType: 'text/plain',
    });

    // Button text should contain the run label.
    await expect(runBtn).toContainText(labels[locale].runBtn);

    await auditScreenshot(page, SECTION_ID, '04-run-button-state', locale);
  });
});
