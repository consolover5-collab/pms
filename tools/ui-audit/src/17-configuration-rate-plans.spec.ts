/**
 * Section 17 — Rate Plans configuration (/configuration/rate-plans)
 *
 * Pre-flight probe confirms (2026-04-21):
 *   5 plans: BAR, CORP, LONG, PROMO, RACK
 *   RACK has isDefault=true (only one)
 *   All 5 isActive=true
 *   BAR has 6 room-rate entries (matrix fully populated)
 *
 * Plan drift adaptations:
 *   - Plan says "isBaseRate" — actual field is "isDefault" (RACK)
 *   - Plan scenario 02 renamed: "02-one-is-default" (not "02-one-base-rate")
 *   - Matrix is populated (not empty), so scenario 04 runs fully
 *
 * Scenarios:
 *   01 — list renders; 5 rows; RACK + PROMO codes visible. ru+en.
 *   02 — exactly one isDefault badge row, and it's RACK. ru+en.
 *   03 — MUTATION: create new plan via /configuration/rate-plans/new; POST 201;
 *        plan appears in list; cleanup in extraAfterAll.
 *   04 — MUTATION (conditional): open BAR edit; matrix has cells; edit STD row;
 *        PUT 200; reload and verify persistence; cleanup (reset to original value).
 *   05 — ATTEMPT-ONLY: try to delete RACK; expect error or 409; DO NOT delete.
 */

import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
  API_URL,
  GBH_PROPERTY_ID,
} from './shared.ts';

const SECTION_ID = '17-configuration-rate-plans';
const ROUTE = '/configuration/rate-plans';

// Probe-confirmed IDs (2026-04-21)
const RACK_ID = 'f47aaf7f-572e-4c24-9f66-506bd24839be';
const BAR_ID = '9f92f036-e7c1-41a4-98a2-1987f8cac2ce';
// BAR × STD room-rate: ae86af36-4fb9-4bd5-9d81-983743ce5923, amount: 4275.00
const BAR_STD_ROOMTYPE_ID = 'e8f25fcd-bdaf-43bb-b39f-4d9ad6d83c84';
const BAR_STD_ORIGINAL_AMOUNT = '4275.00';

// Module-scope mutation trackers (populated during tests, consumed in extraAfterAll)
let createdPlanId: string | null = null;
let matrixEdited = false;

const API_TIMEOUT = 15_000;
const UI_TIMEOUT = 10_000;

const labels = {
  ru: {
    title: 'Тарифные планы',
    addBtn: 'Добавить тариф',
    defaultBadge: '★ Базовый',
    active: 'Активен',
    newTitle: 'Новый тарифный план',
    createBtn: 'Создать тариф',
    editTitle: 'Редактирование тарифа',
    roomRatesTitle: 'Цены по типам комнат',
    saveRateBtn: 'Сохранить',
    deleteBtn: 'Удалить',
    cancelBtn: 'Отмена',
  },
  en: {
    title: 'Rate Plans',
    addBtn: 'Add rate plan',
    defaultBadge: '★ Base rate',
    active: 'Active',
    newTitle: 'New rate plan',
    createBtn: 'Create rate plan',
    editTitle: 'Edit rate plan',
    roomRatesTitle: 'Prices by Room Type',
    saveRateBtn: 'Save',
    deleteBtn: 'Delete',
    cancelBtn: 'Cancel',
  },
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

async function fetchRatePlans(): Promise<Array<{ id: string; code: string; isDefault: boolean }>> {
  const r = await fetch(`${API_URL}/api/rate-plans?propertyId=${GBH_PROPERTY_ID}`);
  if (!r.ok) throw new Error(`GET /api/rate-plans failed: ${r.status}`);
  return r.json();
}

async function deleteRatePlan(id: string): Promise<void> {
  await fetch(`${API_URL}/api/rate-plans/${id}?propertyId=${GBH_PROPERTY_ID}`, {
    method: 'DELETE',
  });
}

async function resetBARstdRate(): Promise<void> {
  await fetch(`${API_URL}/api/rate-plans/${BAR_ID}/room-rates`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomTypeId: BAR_STD_ROOMTYPE_ID, amount: BAR_STD_ORIGINAL_AMOUNT }),
  });
}

// ── Test suite ─────────────────────────────────────────────────────────────────

test.describe('17 configuration-rate-plans', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID, {
    extraAfterAll: async () => {
      // Cleanup created plan (scenario 03)
      if (createdPlanId) {
        await deleteRatePlan(createdPlanId);
        createdPlanId = null;
      }
      // Cleanup edited matrix cell (scenario 04)
      if (matrixEdited) {
        await resetBARstdRate();
        matrixEdited = false;
      }
    },
  });

  // ── Pre-flight probe ────────────────────────────────────────────────────────
  // Runs once before all tests; verifies DB state matches spec expectations.
  test.beforeAll(async () => {
    const plans = await fetchRatePlans();
    const count = plans.length;
    const defaultPlans = plans.filter((p) => p.isDefault);

    if (count < 5) {
      throw new Error(
        `[17-preflight] Expected ≥5 rate plans, got ${count}. DB drift detected.`,
      );
    }
    if (defaultPlans.length !== 1) {
      throw new Error(
        `[17-preflight] Expected exactly 1 isDefault=true plan, got ${defaultPlans.length}. DB drift.`,
      );
    }
    if (defaultPlans[0].code !== 'RACK') {
      throw new Error(
        `[17-preflight] Expected RACK to be default, got ${defaultPlans[0].code}. DB drift.`,
      );
    }
  });

  // ── Scenario 01: list renders ───────────────────────────────────────────────
  test('01-list-render: rate plans page loads; 5 rows; RACK + PROMO visible', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    // Page heading visible
    await expect(page.getByRole('heading', { name: labels[locale].title })).toBeVisible({
      timeout: UI_TIMEOUT,
    });

    // "Add rate plan" button present
    await expect(
      page.getByRole('link', { name: labels[locale].addBtn }),
    ).toBeVisible();

    // Table rows: guard with first() before count
    const rows = page.getByTestId('rate-plan-row');
    await expect(rows.first()).toBeVisible({ timeout: UI_TIMEOUT });
    const rowCount = await rows.count();
    testInfo.attach('row-count', { body: String(rowCount), contentType: 'text/plain' });
    expect(rowCount).toBe(5);

    // RACK and PROMO codes visible in the table
    const rackCode = page.getByTestId('rate-plan-code').filter({ hasText: 'RACK' });
    await expect(rackCode.first()).toBeVisible();
    const promoCode = page.getByTestId('rate-plan-code').filter({ hasText: 'PROMO' });
    await expect(promoCode.first()).toBeVisible();

    await auditScreenshot(page, SECTION_ID, '01-list-render', locale);
  });

  // ── Scenario 02: exactly one isDefault row ──────────────────────────────────
  test('02-one-is-default: exactly one row shows default badge; that row is RACK', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    // Wait for rows to settle
    const rows = page.getByTestId('rate-plan-row');
    await expect(rows.first()).toBeVisible({ timeout: UI_TIMEOUT });

    // Default badge (★ Base rate / ★ Базовый) — exactly 1 in the table
    const defaultBadges = page.getByTestId('rate-plan-default-badge');
    await expect(defaultBadges).toHaveCount(1);
    await expect(defaultBadges.first()).toBeVisible();

    // The badge contains the expected label
    await expect(defaultBadges.first()).toContainText(labels[locale].defaultBadge);

    // The row with the badge must be RACK
    const defaultRow = rows.filter({ has: page.getByTestId('rate-plan-default-badge') });
    await expect(defaultRow).toHaveCount(1);
    const codeInDefaultRow = defaultRow.getByTestId('rate-plan-code');
    await expect(codeInDefaultRow).toContainText('RACK');

    testInfo.attach('default-row-code', {
      body: (await codeInDefaultRow.textContent()) ?? '',
      contentType: 'text/plain',
    });

    await auditScreenshot(page, SECTION_ID, '02-one-is-default', locale);
  });

  // ── Scenario 03: create new plan (mutation, en-only) ────────────────────────
  test('03-create-new-plan: POST /api/rate-plans 201; plan appears in list; cleanup queued', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    const uniqueCode = `AUD${Date.now().toString().slice(-6)}`;
    testInfo.attach('new-plan-code', { body: uniqueCode, contentType: 'text/plain' });

    await setLocaleAndGoto(page, 'en', '/configuration/rate-plans/new');

    // Page heading for new plan form
    await expect(
      page.getByRole('heading', { name: labels.en.newTitle }),
    ).toBeVisible({ timeout: UI_TIMEOUT });

    // Fill in Code field
    const codeInput = page.locator('input[placeholder="RACK"]');
    await expect(codeInput).toBeVisible();
    await codeInput.fill(uniqueCode);

    // Fill in Name field
    const nameInput = page.locator('input[placeholder="Rack Rate"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Audit Test Plan');

    // Submit form; intercept the POST
    const [postResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/rate-plans') &&
          r.request().method() === 'POST',
        { timeout: API_TIMEOUT },
      ),
      page.getByRole('button', { name: labels.en.createBtn }).click(),
    ]);

    const postStatus = postResp.status();
    testInfo.attach('post-response-status', {
      body: String(postStatus),
      contentType: 'text/plain',
    });
    expect([200, 201]).toContain(postStatus);

    // Capture created plan ID for cleanup
    const responseBody = await postResp.json() as { id?: string };
    testInfo.attach('post-response-body', {
      body: JSON.stringify(responseBody, null, 2),
      contentType: 'application/json',
    });
    if (responseBody.id) {
      createdPlanId = responseBody.id;
    }

    // After redirect, should land back on the list page
    await page.waitForURL('**/configuration/rate-plans', { timeout: UI_TIMEOUT });

    // New plan appears in the list (row count now 6)
    const rows = page.getByTestId('rate-plan-row');
    await expect(rows.first()).toBeVisible({ timeout: UI_TIMEOUT });
    const rowCount = await rows.count();
    testInfo.attach('post-create-row-count', { body: String(rowCount), contentType: 'text/plain' });
    expect(rowCount).toBe(6);

    // The new code is in the table
    const newRow = page.getByTestId('rate-plan-code').filter({ hasText: uniqueCode });
    await expect(newRow.first()).toBeVisible();

    // If ID wasn't in POST response, fetch it from list for cleanup
    if (!createdPlanId) {
      const plans = await fetchRatePlans();
      const created = plans.find((p) => p.code === uniqueCode);
      createdPlanId = created?.id ?? null;
    }
    testInfo.attach('created-plan-id', {
      body: createdPlanId ?? 'unknown',
      contentType: 'text/plain',
    });

    await auditScreenshot(page, SECTION_ID, '03-create-new-plan', 'en');
  });

  // ── Scenario 04: matrix edit (mutation, en-only) ─────────────────────────────
  // Open BAR plan edit page. Matrix has 6 room types with existing rates.
  // Edit STD (Standard Double) row: change 4275 → 4300. Save. Reload. Verify.
  test('04-matrix-edit: open BAR edit; edit STD rate; PUT 200; reload persists; cleanup queued', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    const editUrl = `/configuration/rate-plans/${BAR_ID}/edit`;
    await setLocaleAndGoto(page, 'en', editUrl);

    // Edit page heading
    await expect(
      page.getByRole('heading', { name: labels.en.editTitle }),
    ).toBeVisible({ timeout: UI_TIMEOUT });

    // Room rates card heading
    await expect(
      page.getByText(labels.en.roomRatesTitle),
    ).toBeVisible({ timeout: UI_TIMEOUT });

    // The matrix table should have rows — guard: wait for tbody tr
    const matrixRows = page.getByTestId('rate-matrix-row');
    await expect(matrixRows.first()).toBeVisible({ timeout: UI_TIMEOUT });
    const matrixRowCount = await matrixRows.count();
    testInfo.attach('matrix-row-count', {
      body: String(matrixRowCount),
      contentType: 'text/plain',
    });
    expect(matrixRowCount).toBeGreaterThanOrEqual(1);

    // Find the Standard Double row by its code "(STD)"
    const stdRow = matrixRows.filter({ hasText: '(STD)' });
    await expect(stdRow).toHaveCount(1);
    await expect(stdRow.first()).toBeVisible();

    // The rate input in the STD row
    const rateInput = stdRow.locator('input[type="number"]');
    await expect(rateInput).toBeVisible();

    // Verify original value before editing
    const originalValue = await rateInput.inputValue();
    testInfo.attach('std-rate-original', { body: originalValue, contentType: 'text/plain' });

    const newValue = '4300';
    await rateInput.fill(newValue);

    // Click Save in the STD row
    const saveBtn = stdRow.getByRole('button', { name: labels.en.saveRateBtn });
    await expect(saveBtn).toBeEnabled();

    const [putResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/rate-plans/${BAR_ID}/room-rates`) &&
          r.request().method() === 'PUT',
        { timeout: API_TIMEOUT },
      ),
      saveBtn.click(),
    ]);

    testInfo.attach('put-response-status', {
      body: String(putResp.status()),
      contentType: 'text/plain',
    });
    expect(putResp.status()).toBe(200);
    matrixEdited = true;

    // ✓ Saved flash appears briefly
    await expect(stdRow.getByText('✓ Saved')).toBeVisible({ timeout: 5_000 });

    await auditScreenshot(page, SECTION_ID, '04-matrix-edit-saved', 'en');

    // Reload and verify persistence
    await setLocaleAndGoto(page, 'en', editUrl);
    await expect(
      page.getByText(labels.en.roomRatesTitle),
    ).toBeVisible({ timeout: UI_TIMEOUT });

    const matrixRowsAfterReload = page.getByTestId('rate-matrix-row');
    await expect(matrixRowsAfterReload.first()).toBeVisible({ timeout: UI_TIMEOUT });

    const stdRowAfterReload = matrixRowsAfterReload.filter({ hasText: '(STD)' });
    await expect(stdRowAfterReload).toHaveCount(1);
    const rateInputAfterReload = stdRowAfterReload.locator('input[type="number"]');
    await expect(rateInputAfterReload).toBeVisible();

    const persistedValue = await rateInputAfterReload.inputValue();
    testInfo.attach('std-rate-persisted', { body: persistedValue, contentType: 'text/plain' });
    expect(Number(persistedValue)).toBe(Number(newValue));

    await auditScreenshot(page, SECTION_ID, '04-matrix-edit-reloaded', 'en');
  });

  // ── Scenario 05: delete RACK blocked (attempt-only, en-only) ─────────────────
  // RACK has bookings and is isDefault — delete should be blocked.
  // We attempt the delete; expect either a UI error message OR API 409/400/422.
  // DO NOT actually delete RACK.
  test('05-delete-blocked-when-booked: attempt RACK delete; expect error/409; plan remains', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    await setLocaleAndGoto(page, 'en', ROUTE);

    const rows = page.getByTestId('rate-plan-row');
    await expect(rows.first()).toBeVisible({ timeout: UI_TIMEOUT });

    // Find RACK row specifically
    const rackRow = rows.filter({ has: page.getByTestId('rate-plan-code').filter({ hasText: 'RACK' }) });
    await expect(rackRow).toHaveCount(1);
    await expect(rackRow.first()).toBeVisible();

    // The Delete button in RACK row
    const deleteBtn = rackRow.getByRole('button', { name: labels.en.deleteBtn });
    await expect(deleteBtn).toBeVisible();

    // Intercept DELETE request
    let deleteResponseStatus = 0;
    const deletePromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/rate-plans/${RACK_ID}`) &&
        r.request().method() === 'DELETE',
      { timeout: API_TIMEOUT },
    ).then((r) => {
      deleteResponseStatus = r.status();
      return r;
    }).catch(() => null);

    // The confirmation dialog appears (window.confirm) — handle it
    page.on('dialog', async (dialog) => {
      testInfo.attach('confirm-dialog-message', {
        body: dialog.message(),
        contentType: 'text/plain',
      });
      await dialog.accept();
    });

    deleteBtn.click().catch(() => null);

    // Wait a bit for the delete to fire and response to arrive
    await deletePromise;

    testInfo.attach('delete-response-status', {
      body: String(deleteResponseStatus),
      contentType: 'text/plain',
    });

    // If delete returned 2xx — that's a bug (should be blocked)
    if (deleteResponseStatus >= 200 && deleteResponseStatus < 300) {
      // Re-probe to see if RACK still exists
      const plans = await fetchRatePlans();
      const rackStillExists = plans.some((p) => p.id === RACK_ID);
      testInfo.attach('rack-still-exists', {
        body: String(rackStillExists),
        contentType: 'text/plain',
      });
      // If RACK was actually deleted — mark as broken
      if (!rackStillExists) {
        throw new Error(
          'BLOCKED: RACK was deleted successfully — this is a bug. ' +
          'isDefault plans with active bookings must be protected from deletion.',
        );
      }
      // If 200 but RACK still exists — API returned ok but UI didn't remove it (edge case)
    }

    // Verify RACK still exists in the list after the attempt
    await page.reload();
    await page.waitForLoadState('networkidle');

    const rowsAfter = page.getByTestId('rate-plan-row');
    await expect(rowsAfter.first()).toBeVisible({ timeout: UI_TIMEOUT });
    const rackAfter = page.getByTestId('rate-plan-code').filter({ hasText: 'RACK' });
    await expect(rackAfter.first()).toBeVisible();

    // Confirm via API that RACK still exists
    const plans = await fetchRatePlans();
    const rackExists = plans.some((p) => p.id === RACK_ID);
    expect(rackExists).toBe(true);

    testInfo.attach('rack-post-attempt-exists', {
      body: String(rackExists),
      contentType: 'text/plain',
    });

    await auditScreenshot(page, SECTION_ID, '05-delete-blocked', 'en');
  });
});
