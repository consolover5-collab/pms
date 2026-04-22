/**
 * Section 18 — Configuration: Transaction Codes (/configuration/transaction-codes)
 *
 * MEDIUM-RISK: Transaction codes reference folio charge/payment postings.
 * Accidental deletion of a seeded code with folio references is blocked at API level.
 * Snapshot-restore discipline is used for all mutations.
 *
 * Pre-flight probe (2026-04-21) — property GBH (ff1d9135-dfb9-4baa-be46-0e739cd26dad):
 *   Charges (11): ADJ_ROOM, ADJ_FB, ROOM, ROOM_TAX, EXTRA_BED, NO_SHOW,
 *                  FB_REST, FB_BAR, MINIBAR, BREAKFAST, PARKING
 *   Payments (3): PAY_CASH, PAY_CARD, PAY_TRANSFER
 *   Total: 14 codes
 *
 *   MINIBAR id=25462d33-7748-4725-bbe3-3484e53557fe  manual=true  → scenario 02 target
 *   BREAKFAST id=83b646b7-ec41-4879-965c-990e3d17b649 manual=true  → scenario 03 target
 *   ROOM id=c4d15cc0-d75e-4d3c-ae5c-a38fcc4f6a2e      manual=false → scenario 04 delete-blocked
 *
 * i18n gap filed as BUG-010:
 *   - page.tsx badges "charge"/"payment" hardcoded (not localised)
 *   - transaction-code-form.tsx CHARGE_GROUP_CODES options rendered as raw snake_case strings
 *
 * DELETE behaviour (verified 2026-04-21):
 *   - No UI delete path exists (confirmed via grep — no delete button anywhere)
 *   - API DELETE /api/transaction-codes/:id returns 400 { code: 'HAS_FOLIO_TRANSACTIONS', error: '...' }
 *     when code is referenced by folio transactions. The error string contains the count.
 *     NOTE: The brief described a `cnt` field but the actual API response omits it;
 *     only `code` and `error` are returned. Scenario 04 asserts accordingly.
 *
 * Scenarios:
 *   01 — list-create: Navigate list; assert both cards visible (11 charges + 3 payments);
 *        assert seed codes present; click "New code" → form; fill AUD_TC; submit POST;
 *        redirect + row visible. EN mutation only; RU read-only.
 *        Cleanup in extraAfterAll: DELETE AUD_TC (no folio usage → succeeds).
 *
 *   02 — toggle-manual-post: MINIBAR manual=true; navigate edit; uncheck manual-post;
 *        submit PUT; API re-GET confirms isManualPostAllowed=false. EN-only.
 *        Restore in extraAfterAll: PUT MINIBAR back to original snapshot; re-GET verify.
 *
 *   03 — edit: BREAKFAST; navigate edit; change description; submit PUT; re-GET verify.
 *        EN-only. Restore in extraAfterAll.
 *
 *   04 — delete-blocked: API-only; DELETE ROOM code → 400 HAS_FOLIO_TRANSACTIONS.
 *        No UI path exists (documented in YAML missing_actions).
 */

import { test, expect } from '@playwright/test';
import {
  API_URL,
  GBH_PROPERTY_ID,
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
} from './shared.ts';

const SECTION_ID = '18-configuration-transaction-codes';
const ROUTE = '/configuration/transaction-codes';

const API_TIMEOUT = 15_000;
const UI_TIMEOUT  = 10_000;

// ── Probe-confirmed seed values (2026-04-21) ───────────────────────────────────
const PROPERTY_ID = GBH_PROPERTY_ID; // ff1d9135-dfb9-4baa-be46-0e739cd26dad

// Use a unique code per run to avoid unique-constraint collisions on repeated runs.
// DELETE is soft-delete (isActive=false) so re-inserting same (propertyId, code) fails.
// Suffix is 4 hex chars from timestamp — short enough for 20-char limit (AUD_TC_XXXX = 11 chars).
const TC_RUN_SUFFIX = Date.now().toString(16).slice(-4).toUpperCase();
const AUDIT_TC_CODE = `AUD_TC_${TC_RUN_SUFFIX}`; // e.g. "AUD_TC_1A2B"

const MINIBAR_ID   = '25462d33-7748-4725-bbe3-3484e53557fe'; // charge, manual=true  → scenario 02
const BREAKFAST_ID = '83b646b7-ec41-4879-965c-990e3d17b649'; // charge, manual=true  → scenario 03
const ROOM_ID      = 'c4d15cc0-d75e-4d3c-ae5c-a38fcc4f6a2e'; // charge, manual=false → scenario 04 delete-blocked

const EXPECTED_CHARGES  = 11;
const EXPECTED_PAYMENTS = 3;
const EXPECTED_TOTAL    = 14;

// Seed codes to assert visible on the list (representative sample):
const SEED_CHARGE_CODES  = ['ADJ_ROOM', 'ROOM', 'MINIBAR'] as const;
const SEED_PAYMENT_CODES = ['PAY_CASH', 'PAY_CARD', 'PAY_TRANSFER'] as const;

// ── Types ─────────────────────────────────────────────────────────────────────
type TransactionCode = {
  id: string;
  propertyId: string;
  code: string;
  description: string;
  groupCode: string;
  transactionType: string;
  isManualPostAllowed: boolean;
  isActive: boolean;
  sortOrder: number;
  adjustmentCodeId?: string | null;
  createdAt?: string;
};

type TcUpdateBody = Omit<TransactionCode, 'id' | 'createdAt'>;

// ── Module-scope mutation trackers ─────────────────────────────────────────────
let createdTcId: string | null = null;           // set by scenario 01
let minibarSnapshot: TransactionCode | null = null;   // set in beforeAll
let breakfastSnapshot: TransactionCode | null = null; // set in beforeAll
let minibarMutationApplied  = false;             // set in scenario 02
let breakfastMutationApplied = false;            // set in scenario 03

// ── API helpers ───────────────────────────────────────────────────────────────
async function fetchTcList(): Promise<TransactionCode[]> {
  const r = await fetch(`${API_URL}/api/transaction-codes?propertyId=${PROPERTY_ID}`);
  if (!r.ok) throw new Error(`GET /api/transaction-codes?propertyId=... failed: ${r.status}`);
  return r.json();
}

async function putTc(id: string, body: TcUpdateBody): Promise<TransactionCode> {
  const r = await fetch(`${API_URL}/api/transaction-codes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`PUT /api/transaction-codes/${id} failed: ${r.status} — ${text}`);
  }
  return r.json();
}

async function deleteTc(id: string): Promise<{ status: number; body: unknown }> {
  const r = await fetch(
    `${API_URL}/api/transaction-codes/${id}?propertyId=${PROPERTY_ID}`,
    { method: 'DELETE' },
  );
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

// ── Test suite ─────────────────────────────────────────────────────────────────
test.describe('18 configuration-transaction-codes', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID, {
    extraAfterAll: async () => {
      // ── 1. Cleanup scenario 01: soft-delete audit TC ──────────────────────
      // NOTE: API DELETE is soft-delete (sets isActive=false). The code stays in DB
      // but is excluded from the list query (which filters isActive=true).
      // We use a per-run unique code (AUDIT_TC_CODE) so soft-deleted rows from prior
      // runs don't trigger unique-constraint errors on re-insert.
      if (createdTcId) {
        // eslint-disable-next-line no-console
        console.log(`[18-tx-codes] extraAfterAll: soft-deleting ${AUDIT_TC_CODE} id=${createdTcId}...`);
        const del = await deleteTc(createdTcId);
        // API returns 204 on successful soft-delete
        if (del.status !== 200 && del.status !== 204) {
          // eslint-disable-next-line no-console
          console.error(`[18-tx-codes] extraAfterAll: delete ${AUDIT_TC_CODE} failed: status=${del.status} body=${JSON.stringify(del.body)}`);
        } else {
          // eslint-disable-next-line no-console
          console.log(`[18-tx-codes] extraAfterAll: ${AUDIT_TC_CODE} soft-deleted OK (status=${del.status})`);
        }
        createdTcId = null;
      }

      // ── 2. Restore scenario 02: PUT MINIBAR back ──────────────────────────
      if (minibarMutationApplied && minibarSnapshot) {
        // eslint-disable-next-line no-console
        console.log('[18-tx-codes] extraAfterAll: restoring MINIBAR snapshot...');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, createdAt, ...snapshotBody } = minibarSnapshot;
        await putTc(MINIBAR_ID, snapshotBody);

        // Independent re-GET via list (no direct GET endpoint)
        const reList = await fetchTcList();
        const reGotten = reList.find((c) => c.id === MINIBAR_ID);
        if (!reGotten) {
          throw new Error(`CRITICAL: MINIBAR missing from list after restore. Manual intervention required.`);
        }
        const fieldsToCheck: Array<keyof typeof snapshotBody> = [
          'code', 'description', 'groupCode', 'transactionType',
          'isManualPostAllowed', 'isActive', 'sortOrder',
        ];
        for (const field of fieldsToCheck) {
          const expected = String(snapshotBody[field]);
          const actual   = String((reGotten as Record<string, unknown>)[field]);
          if (expected !== actual) {
            throw new Error(
              `CRITICAL: MINIBAR restore failed (re-GET mismatch) — field=${field} ` +
              `expected="${expected}" actual="${actual}". ` +
              `Manual intervention required: PUT /api/transaction-codes/${MINIBAR_ID}`,
            );
          }
        }
        // eslint-disable-next-line no-console
        console.log(`[18-tx-codes] extraAfterAll: MINIBAR restored OK (isManualPostAllowed=${reGotten.isManualPostAllowed})`);
        minibarMutationApplied = false;
      }

      // ── 3. Restore scenario 03: PUT BREAKFAST back ────────────────────────
      if (breakfastMutationApplied && breakfastSnapshot) {
        // eslint-disable-next-line no-console
        console.log('[18-tx-codes] extraAfterAll: restoring BREAKFAST snapshot...');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, createdAt, ...snapshotBody } = breakfastSnapshot;
        await putTc(BREAKFAST_ID, snapshotBody);

        const reList = await fetchTcList();
        const reGotten = reList.find((c) => c.id === BREAKFAST_ID);
        if (!reGotten) {
          throw new Error(`CRITICAL: BREAKFAST missing from list after restore. Manual intervention required.`);
        }
        if (reGotten.description !== snapshotBody.description) {
          throw new Error(
            `CRITICAL: BREAKFAST restore failed — description mismatch. ` +
            `expected="${snapshotBody.description}" actual="${reGotten.description}". ` +
            `Manual intervention required: PUT /api/transaction-codes/${BREAKFAST_ID}`,
          );
        }
        // eslint-disable-next-line no-console
        console.log(`[18-tx-codes] extraAfterAll: BREAKFAST restored OK (description="${reGotten.description}")`);
        breakfastMutationApplied = false;
      }

      // ── 4. Belt-and-suspenders: assert count still 14 ────────────────────
      const finalList = await fetchTcList();
      if (finalList.length !== EXPECTED_TOTAL) {
        throw new Error(
          `CRITICAL: after extraAfterAll, tx-codes count is ${finalList.length}, expected ${EXPECTED_TOTAL}. ` +
          `codes=${finalList.map((c) => c.code).join(',')}`,
        );
      }
      // AUDIT_TC_CODE must be absent from active list (soft-deleted → isActive=false)
      if (finalList.some((c) => c.code === AUDIT_TC_CODE)) {
        throw new Error(
          `CRITICAL: ${AUDIT_TC_CODE} still active after cleanup! ` +
          `Attempt manual DELETE /api/transaction-codes/:id?propertyId=${PROPERTY_ID}`,
        );
      }
      // eslint-disable-next-line no-console
      console.log(`[18-tx-codes] extraAfterAll: final state OK — 14 active codes, ${AUDIT_TC_CODE} soft-deleted.`);
    },
  });

  // ── Pre-flight: snapshot MINIBAR + BREAKFAST; verify seed ─────────────────
  test.beforeAll(async () => {
    const list = await fetchTcList();

    // Snapshots for restore
    minibarSnapshot   = list.find((c) => c.id === MINIBAR_ID) ?? null;
    breakfastSnapshot = list.find((c) => c.id === BREAKFAST_ID) ?? null;

    if (!minibarSnapshot) {
      throw new Error(`[18-tx-codes] pre-flight: MINIBAR (${MINIBAR_ID}) not found in list`);
    }
    if (!breakfastSnapshot) {
      throw new Error(`[18-tx-codes] pre-flight: BREAKFAST (${BREAKFAST_ID}) not found in list`);
    }

    // Verify expected counts
    const charges  = list.filter((c) => c.transactionType === 'charge');
    const payments = list.filter((c) => c.transactionType === 'payment');
    if (charges.length !== EXPECTED_CHARGES) {
      throw new Error(`[18-tx-codes] pre-flight: expected ${EXPECTED_CHARGES} charges, got ${charges.length}`);
    }
    if (payments.length !== EXPECTED_PAYMENTS) {
      throw new Error(`[18-tx-codes] pre-flight: expected ${EXPECTED_PAYMENTS} payments, got ${payments.length}`);
    }

    // eslint-disable-next-line no-console
    console.log('[18-tx-codes] pre-flight OK:', {
      total: list.length,
      minibarManual: minibarSnapshot.isManualPostAllowed,
      breakfastDesc: breakfastSnapshot.description,
    });
  });

  // ── Scenario 01: list-view (ru+en) + create AUD_TC (en-only) ──────────────
  test('01-list-create: both cards visible; seed codes present; create AUD_TC; row appears', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    // Both cards must be visible
    await expect(page.getByTestId('tx-codes-charges-card')).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.getByTestId('tx-codes-payments-card')).toBeVisible({ timeout: UI_TIMEOUT });

    // Verify rows in charges card
    const chargesCard = page.getByTestId('tx-codes-charges-card');
    const chargeRows = chargesCard.getByTestId('tx-code-row');
    await expect(chargeRows.first()).toBeVisible({ timeout: UI_TIMEOUT });
    const chargeRowCount = await chargeRows.count();
    testInfo.attach('charge-row-count', { body: String(chargeRowCount), contentType: 'text/plain' });
    expect(chargeRowCount).toBe(EXPECTED_CHARGES);

    // Verify rows in payments card
    const paymentsCard = page.getByTestId('tx-codes-payments-card');
    const paymentRows = paymentsCard.getByTestId('tx-code-row');
    await expect(paymentRows.first()).toBeVisible({ timeout: UI_TIMEOUT });
    const paymentRowCount = await paymentRows.count();
    testInfo.attach('payment-row-count', { body: String(paymentRowCount), contentType: 'text/plain' });
    expect(paymentRowCount).toBe(EXPECTED_PAYMENTS);

    // Representative charge codes visible
    for (const code of SEED_CHARGE_CODES) {
      const cell = chargesCard.getByTestId('tx-code-code').filter({ hasText: code });
      await expect(cell.first()).toBeVisible({ timeout: UI_TIMEOUT });
    }

    // All payment codes visible
    for (const code of SEED_PAYMENT_CODES) {
      const cell = paymentsCard.getByTestId('tx-code-code').filter({ hasText: code });
      await expect(cell.first()).toBeVisible({ timeout: UI_TIMEOUT });
    }

    // RU read ends here — mutation only runs in EN
    if (locale === 'ru') {
      await auditScreenshot(page, SECTION_ID, '01-list-view', 'ru');
      return;
    }

    // ── EN: Click "New code" → form page ────────────────────────────────────
    const newBtn = page.getByTestId('tx-codes-new');
    await expect(newBtn).toBeVisible({ timeout: UI_TIMEOUT });
    await newBtn.click();

    await page.waitForURL('**/configuration/transaction-codes/new', { timeout: UI_TIMEOUT });
    await expect(page.getByTestId('tx-code-form')).toBeVisible({ timeout: UI_TIMEOUT });

    // Fill code — use per-run unique suffix to avoid soft-delete unique-constraint collision
    testInfo.attach('audit-tc-code', { body: AUDIT_TC_CODE, contentType: 'text/plain' });
    const codeInput = page.getByTestId('tx-code-field-code');
    await expect(codeInput).toBeVisible({ timeout: UI_TIMEOUT });
    await codeInput.fill(AUDIT_TC_CODE);
    await expect(codeInput).toHaveValue(AUDIT_TC_CODE);

    // Fill description
    const descInput = page.getByTestId('tx-code-field-description');
    await expect(descInput).toBeVisible();
    await descInput.fill('Audit test code (C7)');

    // Set transactionType = charge (already default — verify)
    const typeSelect = page.getByTestId('tx-code-field-type');
    await expect(typeSelect).toBeVisible();
    await typeSelect.selectOption('charge');

    // Set groupCode = misc
    const groupSelect = page.getByTestId('tx-code-field-group');
    await expect(groupSelect).toBeVisible();
    await groupSelect.selectOption('misc');

    // Ensure manual-post is checked (should be default)
    const manualPostCb = page.getByTestId('tx-code-field-manual-post');
    await expect(manualPostCb).toBeVisible();
    if (!(await manualPostCb.isChecked())) {
      await manualPostCb.check();
    }

    // Fill sortOrder = 100
    const sortInput = page.getByTestId('tx-code-field-sort-order');
    await expect(sortInput).toBeVisible();
    await sortInput.fill('100');

    // Submit and intercept POST
    const [postResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/transaction-codes') &&
          r.request().method() === 'POST',
        { timeout: API_TIMEOUT },
      ),
      page.getByTestId('tx-code-submit').click(),
    ]);

    const postStatus = postResp.status();
    testInfo.attach('post-response-status', { body: String(postStatus), contentType: 'text/plain' });
    expect([200, 201]).toContain(postStatus);

    // Capture created ID for cleanup
    const postBody = await postResp.json().catch(() => ({})) as { id?: string };
    testInfo.attach('post-response-body', { body: JSON.stringify(postBody, null, 2), contentType: 'application/json' });
    if (postBody.id) {
      createdTcId = postBody.id;
    }

    // Redirected back to list
    await page.waitForURL('**/configuration/transaction-codes', { timeout: UI_TIMEOUT });
    await expect(page.getByTestId('tx-codes-charges-card')).toBeVisible({ timeout: UI_TIMEOUT });

    // Audit TC row visible in charges card
    const chargesCardAfter = page.getByTestId('tx-codes-charges-card');
    const audRow = chargesCardAfter.getByTestId('tx-code-code').filter({ hasText: AUDIT_TC_CODE });
    await expect(audRow.first()).toBeVisible({ timeout: UI_TIMEOUT });

    // Charge row count = EXPECTED_CHARGES + 1
    const rowsAfter = chargesCardAfter.getByTestId('tx-code-row');
    await expect(rowsAfter.first()).toBeVisible({ timeout: UI_TIMEOUT });
    const rowCountAfter = await rowsAfter.count();
    testInfo.attach('post-create-charge-row-count', { body: String(rowCountAfter), contentType: 'text/plain' });
    expect(rowCountAfter).toBe(EXPECTED_CHARGES + 1);

    // If POST body didn't carry id, find via list API
    if (!createdTcId) {
      const currentList = await fetchTcList();
      const created = currentList.find((c) => c.code === AUDIT_TC_CODE);
      createdTcId = created?.id ?? null;
    }
    testInfo.attach('created-tc-id', { body: createdTcId ?? 'unknown', contentType: 'text/plain' });

    await auditScreenshot(page, SECTION_ID, '01-list-create', 'en');
  });

  // ── Scenario 02: toggle isManualPostAllowed on MINIBAR (en-only) ──────────
  test('02-toggle-manual-post: MINIBAR manual=true → uncheck → PUT 200 → isManualPostAllowed=false', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    const editUrl = `/configuration/transaction-codes/${MINIBAR_ID}/edit`;
    testInfo.attach('edit-target', { body: `MINIBAR id=${MINIBAR_ID}`, contentType: 'text/plain' });
    testInfo.attach('snapshot-isManualPostAllowed', { body: String(minibarSnapshot?.isManualPostAllowed), contentType: 'text/plain' });

    await setLocaleAndGoto(page, 'en', editUrl);

    // Edit title visible
    await expect(page.getByTestId('tx-code-edit-title')).toBeVisible({ timeout: UI_TIMEOUT });

    // Form visible
    await expect(page.getByTestId('tx-code-form')).toBeVisible({ timeout: UI_TIMEOUT });

    // manual-post checkbox should be checked (MINIBAR manual=true)
    const manualPostCb = page.getByTestId('tx-code-field-manual-post');
    await expect(manualPostCb).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(manualPostCb).toBeChecked();

    // Uncheck it
    await manualPostCb.uncheck();
    await expect(manualPostCb).not.toBeChecked();

    // Submit and intercept PUT
    const [putResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/transaction-codes/${MINIBAR_ID}`) &&
          r.request().method() === 'PUT',
        { timeout: API_TIMEOUT },
      ),
      page.getByTestId('tx-code-submit').click(),
    ]);

    // IMPORTANT: set flag BEFORE assertions so restore runs even if assertions fail
    minibarMutationApplied = true;

    const putStatus = putResp.status();
    testInfo.attach('put-response-status', { body: String(putStatus), contentType: 'text/plain' });
    expect(putStatus).toBe(200);

    // No error banner
    await expect(page.getByTestId('tx-code-error-banner')).not.toBeVisible();

    // Redirected to list
    await page.waitForURL('**/configuration/transaction-codes', { timeout: UI_TIMEOUT });

    // API confirms isManualPostAllowed=false via list
    const afterList = await fetchTcList();
    const afterMinibar = afterList.find((c) => c.id === MINIBAR_ID);
    testInfo.attach('api-isManualPostAllowed-after', { body: String(afterMinibar?.isManualPostAllowed), contentType: 'text/plain' });
    expect(afterMinibar).toBeDefined();
    expect(afterMinibar!.isManualPostAllowed).toBe(false);

    await auditScreenshot(page, SECTION_ID, '02-toggle-manual-post', 'en');
  });

  // ── Scenario 03: edit BREAKFAST description (en-only) ─────────────────────
  test('03-edit: BREAKFAST description change → PUT 200 → API confirms; restore queued', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    const editUrl = `/configuration/transaction-codes/${BREAKFAST_ID}/edit`;
    const newDescription = 'Breakfast — edited by UI audit (will be restored)';

    testInfo.attach('edit-target', { body: `BREAKFAST id=${BREAKFAST_ID}`, contentType: 'text/plain' });
    testInfo.attach('snapshot-description', { body: breakfastSnapshot?.description ?? '(null)', contentType: 'text/plain' });
    testInfo.attach('new-description', { body: newDescription, contentType: 'text/plain' });

    await setLocaleAndGoto(page, 'en', editUrl);

    // Edit title visible
    await expect(page.getByTestId('tx-code-edit-title')).toBeVisible({ timeout: UI_TIMEOUT });

    // Form visible
    await expect(page.getByTestId('tx-code-form')).toBeVisible({ timeout: UI_TIMEOUT });

    // Description field pre-filled
    const descInput = page.getByTestId('tx-code-field-description');
    await expect(descInput).toBeVisible({ timeout: UI_TIMEOUT });

    // Change description
    await descInput.fill(newDescription);
    await expect(descInput).toHaveValue(newDescription);

    // Submit and intercept PUT
    const [putResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/transaction-codes/${BREAKFAST_ID}`) &&
          r.request().method() === 'PUT',
        { timeout: API_TIMEOUT },
      ),
      page.getByTestId('tx-code-submit').click(),
    ]);

    // IMPORTANT: set flag BEFORE assertions so restore runs even if assertions fail
    breakfastMutationApplied = true;

    const putStatus = putResp.status();
    testInfo.attach('put-response-status', { body: String(putStatus), contentType: 'text/plain' });
    expect(putStatus).toBe(200);

    // No error banner
    await expect(page.getByTestId('tx-code-error-banner')).not.toBeVisible();

    // Redirected to list
    await page.waitForURL('**/configuration/transaction-codes', { timeout: UI_TIMEOUT });

    // API confirms description updated
    const afterList = await fetchTcList();
    const afterBreakfast = afterList.find((c) => c.id === BREAKFAST_ID);
    testInfo.attach('api-description-after-put', { body: afterBreakfast?.description ?? '(null)', contentType: 'text/plain' });
    expect(afterBreakfast).toBeDefined();
    expect(afterBreakfast!.description).toBe(newDescription);

    await auditScreenshot(page, SECTION_ID, '03-edit', 'en');
  });

  // ── Scenario 04: delete-blocked (API-only — no UI delete path) ────────────
  // There is NO delete button anywhere in the UI for transaction codes.
  // This scenario uses a direct API call to validate the protection gate.
  // The YAML missing_actions block documents this gap.
  test('04-delete-blocked: ROOM code DELETE → 400 HAS_FOLIO_TRANSACTIONS; no mutation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'validation scenario runs only on en');

    // Navigate to the list page first (for screenshot context)
    await setLocaleAndGoto(page, 'en', ROUTE);
    await expect(page.getByTestId('tx-codes-charges-card')).toBeVisible({ timeout: UI_TIMEOUT });

    // Verify ROOM row is present (sanity check before API call)
    const roomRow = page.locator('[data-testid="tx-code-row"][data-tx-code-id="' + ROOM_ID + '"]');
    await expect(roomRow).toBeVisible({ timeout: UI_TIMEOUT });

    testInfo.attach('delete-target', { body: `ROOM id=${ROOM_ID}`, contentType: 'text/plain' });

    // Direct API call — no UI delete path exists
    const del = await deleteTc(ROOM_ID);

    testInfo.attach('delete-response-status', { body: String(del.status), contentType: 'text/plain' });
    testInfo.attach('delete-response-body', { body: JSON.stringify(del.body, null, 2), contentType: 'application/json' });

    // Must be 400 with HAS_FOLIO_TRANSACTIONS
    expect(del.status).toBe(400);
    const body = del.body as { code?: string; error?: string };
    expect(body.code).toBe('HAS_FOLIO_TRANSACTIONS');
    // Error string must contain a count (the API embeds it in the message)
    expect(body.error).toMatch(/\d+/);

    // ROOM row still present in UI (no mutation)
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('tx-codes-charges-card')).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(
      page.locator('[data-testid="tx-code-row"][data-tx-code-id="' + ROOM_ID + '"]'),
    ).toBeVisible({ timeout: UI_TIMEOUT });

    // API confirms ROOM still exists in list
    const finalList = await fetchTcList();
    const roomStillPresent = finalList.some((c) => c.id === ROOM_ID);
    testInfo.attach('room-still-present', { body: String(roomStillPresent), contentType: 'text/plain' });
    expect(roomStillPresent).toBe(true);

    await auditScreenshot(page, SECTION_ID, '04-delete-blocked', 'en');
  });
});
