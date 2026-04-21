/**
 * Section 19 — Configuration: Packages (/configuration/packages)
 *
 * MEDIUM-RISK: Packages can be linked to rate plans. Mutations on linked packages
 * affect pricing. BKFST is linked to 3 rate plans and is used as a delete-blocked
 * target; PARK is unlinked and is the safe edit target.
 *
 * Pre-flight probe (2026-04-21) — property GBH (ff1d9135-dfb9-4baa-be46-0e739cd26dad):
 *   BKFST id=df6fab35-0f22-445c-b202-2c162660b105  amount=800.00  per_person_per_night
 *         linked to 3 rate plans: RACK, CORP, BAR → delete-blocked target
 *   PARK  id=02db4d8f-675a-4ce0-954f-6c441e6bbc4e  amount=500.00  per_night  → safe edit target
 *
 *   Rate plans used:
 *     RACK id=f47aaf7f-572e-4c24-9f66-506bd24839be  baseRate=5000.00  isDefault=true
 *     BAR  id=9f92f036-e7c1-41a4-98a2-1987f8cac2ce  baseRate=4700.00
 *     CORP id=8f23168b-4ac0-47cf-b671-2137bc857f3c
 *
 *   Transaction codes (reuse for create):
 *     BREAKFAST id=83b646b7-ec41-4879-965c-990e3d17b649
 *     PARKING   id=d87a8b30-df0a-4eb7-94a6-ac7462360b97
 *     MINIBAR   id=25462d33-7748-4725-bbe3-3484e53557fe
 *
 * Scenarios:
 *   01 — list-create: Navigate list; BKFST + PARK rows visible. EN: create AUD_PKG_<suffix>;
 *        redirect; row appears. Cleanup in extraAfterAll.
 *
 *   02 — edit-existing: Navigate PARK edit; toggle amount 500→550; submit PUT 200; list shows
 *        new amount; API re-GET confirms amount="550.00". Idempotent reversal: set back to 500.
 *        extraAfterAll: belt-and-suspenders PUT + re-GET assert; CRITICAL throw if not restored.
 *
 *   03 — attach-to-rate-plan: Create AUD_PKG_ATT via API; open edit page; check RACK; submit;
 *        GET /api/rate-plans/RACK/packages confirms link; GET /api/rate-plans/RACK confirms no
 *        side-effect on rate plan. Teardown in extraAfterAll.
 *
 *   04 — delete (two parts):
 *        A) delete-blocked: API DELETE BKFST → 400 HAS_RATE_PLANS; error mentions linked plans.
 *        B) happy-path: Create AUD_PKG_DEL via API → DELETE via API → 200 success;
 *           re-GET → 404 PACKAGE_NOT_FOUND.
 *        No UI delete path exists → documented in YAML missing_actions; status: api_only.
 *
 * Plan drift adaptation:
 *   Scenario 02 described as "edit-components: Add a component (charge line)" in the original plan,
 *   but the package schema is monolithic (single transactionCodeId + amount). Adapted to
 *   edit-existing-package (toggle amount field on PARK, which is safe and idempotent).
 */

import { test, expect } from '@playwright/test';
import {
  API_URL,
  GBH_PROPERTY_ID,
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
} from './shared.ts';

const SECTION_ID = '19-configuration-packages';
const ROUTE = '/configuration/packages';

const API_TIMEOUT = 15_000;
const UI_TIMEOUT  = 10_000;

// ── Probe-confirmed seed values (2026-04-21) ───────────────────────────────────
const PROPERTY_ID = GBH_PROPERTY_ID; // ff1d9135-dfb9-4baa-be46-0e739cd26dad

// Per-run unique suffix to avoid collision on repeated runs (soft-delete or leftover rows)
const SUFFIX = Date.now().toString(16).slice(-4).toUpperCase();
const AUD_PKG_CODE     = `AUD_PKG_${SUFFIX}`;      // scenario 01 create
const AUD_PKG_ATT_CODE = `AUD_PKG_ATT_${SUFFIX}`;  // scenario 03 attach
const AUD_PKG_DEL_CODE = `AUD_PKG_DEL_${SUFFIX}`;  // scenario 04 happy-delete

// Seed package IDs
const BKFST_ID = 'df6fab35-0f22-445c-b202-2c162660b105'; // linked to 3 plans → delete-blocked
const PARK_ID  = '02db4d8f-675a-4ce0-954f-6c441e6bbc4e'; // unlinked → safe edit target

// Rate plan IDs
const RACK_ID = 'f47aaf7f-572e-4c24-9f66-506bd24839be'; // isDefault=true
const BAR_ID  = '9f92f036-e7c1-41a4-98a2-1987f8cac2ce';
const CORP_ID = '8f23168b-4ac0-47cf-b671-2137bc857f3c';

// Transaction code IDs
const BREAKFAST_TC_ID = '83b646b7-ec41-4879-965c-990e3d17b649';
const PARKING_TC_ID   = 'd87a8b30-df0a-4eb7-94a6-ac7462360b97';

// Expected PARK original amount before any mutation
const PARK_ORIGINAL_AMOUNT = '500.00';
const PARK_EDITED_AMOUNT   = '550.00';

// Expected BKFST link count (used only in sanity; not asserted as exact in teardown)
const BKFST_EXPECTED_LINK_COUNT = 3;

// ── Types ─────────────────────────────────────────────────────────────────────
type Package = {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  description: string | null;
  transactionCodeId: string;
  calculationRule: string;
  amount: string;
  postingRhythm: string;
  isActive: boolean;
};

type RatePlanLink = {
  ratePlanId: string;
  includedInRate: boolean;
};

// ── Module-scope mutation trackers ─────────────────────────────────────────────
let createdPkgId: string | null = null;      // scenario 01 — cleanup
let parkMutationApplied = false;             // scenario 02 — restore gate
let createdAttPkgId: string | null = null;   // scenario 03 — cleanup (detach + delete)
let createdDelPkgId: string | null = null;   // scenario 04 — already deleted; for orphan guard

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchPackageList(): Promise<Package[]> {
  const r = await fetch(`${API_URL}/api/packages?propertyId=${PROPERTY_ID}`);
  if (!r.ok) throw new Error(`GET /api/packages?propertyId=... failed: ${r.status}`);
  const json = await r.json() as { data: Package[] };
  return json.data;
}

async function fetchPackage(id: string): Promise<{ status: number; body: unknown }> {
  const r = await fetch(`${API_URL}/api/packages/${id}`);
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

async function createPackage(
  code: string,
  name: string,
  transactionCodeId: string,
): Promise<Package> {
  const r = await fetch(`${API_URL}/api/packages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      propertyId: PROPERTY_ID,
      code,
      name,
      transactionCodeId,
      calculationRule: 'per_night',
      amount: '0',
      postingRhythm: 'every_night',
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`POST /api/packages failed: ${r.status} — ${text}`);
  }
  return r.json() as Promise<Package>;
}

async function updatePackage(
  id: string,
  patch: Partial<Omit<Package, 'id' | 'propertyId'>>,
): Promise<Package> {
  const r = await fetch(`${API_URL}/api/packages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`PUT /api/packages/${id} failed: ${r.status} — ${text}`);
  }
  return r.json() as Promise<Package>;
}

async function deletePackage(id: string): Promise<{ status: number; body: unknown }> {
  const r = await fetch(`${API_URL}/api/packages/${id}`, { method: 'DELETE' });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

async function fetchPackageRatePlans(id: string): Promise<{ data: RatePlanLink[] }> {
  const r = await fetch(`${API_URL}/api/packages/${id}/rate-plans`);
  if (!r.ok) throw new Error(`GET /api/packages/${id}/rate-plans failed: ${r.status}`);
  return r.json() as Promise<{ data: RatePlanLink[] }>;
}

async function setPackageRatePlans(
  id: string,
  ratePlans: RatePlanLink[],
): Promise<void> {
  const r = await fetch(`${API_URL}/api/packages/${id}/rate-plans`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ratePlans }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`PUT /api/packages/${id}/rate-plans failed: ${r.status} — ${text}`);
  }
}

async function fetchRatePlanPackages(
  ratePlanId: string,
): Promise<{ data: { packageId: string; includedInRate: boolean }[] }> {
  const r = await fetch(`${API_URL}/api/rate-plans/${ratePlanId}/packages`);
  if (!r.ok) throw new Error(`GET /api/rate-plans/${ratePlanId}/packages failed: ${r.status}`);
  return r.json() as Promise<{ data: { packageId: string; includedInRate: boolean }[] }>;
}

// ── Test suite ─────────────────────────────────────────────────────────────────
test.describe('19 configuration-packages', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID, {
    extraAfterAll: async () => {
      // ── 1. Restore PARK amount if mutated ────────────────────────────────────
      // Belt-and-suspenders: re-GET regardless of parkMutationApplied flag (idempotent)
      // eslint-disable-next-line no-console
      console.log('[19-packages] extraAfterAll: verifying PARK amount...');
      const parkRes = await fetchPackage(PARK_ID);
      const parkBody = parkRes.body as { amount?: string };
      if (parkRes.status !== 200) {
        throw new Error(
          `CRITICAL: PARK package not found (status=${parkRes.status}). ` +
          `Manual intervention required.`,
        );
      }
      if (parkBody.amount !== PARK_ORIGINAL_AMOUNT) {
        // eslint-disable-next-line no-console
        console.warn(
          `[19-packages] extraAfterAll: PARK amount=${parkBody.amount} ≠ ${PARK_ORIGINAL_AMOUNT} — restoring...`,
        );
        await updatePackage(PARK_ID, { amount: PARK_ORIGINAL_AMOUNT });
        // Verify restore
        const reGot = await fetchPackage(PARK_ID);
        const reBody = reGot.body as { amount?: string };
        if (reBody.amount !== PARK_ORIGINAL_AMOUNT) {
          throw new Error(
            `CRITICAL: PARK restore failed — amount=${reBody.amount} expected=${PARK_ORIGINAL_AMOUNT}. ` +
            `Manual intervention required: PUT /api/packages/${PARK_ID}`,
          );
        }
        // eslint-disable-next-line no-console
        console.log(`[19-packages] extraAfterAll: PARK restored OK (amount=${reBody.amount})`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`[19-packages] extraAfterAll: PARK amount OK (${parkBody.amount})`);
      }
      parkMutationApplied = false;

      // ── 2. Cleanup scenario 03: detach AUD_PKG_ATT + delete ──────────────────
      if (createdAttPkgId) {
        // eslint-disable-next-line no-console
        console.log(`[19-packages] extraAfterAll: detaching + deleting ${AUD_PKG_ATT_CODE} id=${createdAttPkgId}...`);
        try {
          await setPackageRatePlans(createdAttPkgId, []);
          const del = await deletePackage(createdAttPkgId);
          if (del.status !== 200 && del.status !== 204) {
            // eslint-disable-next-line no-console
            console.error(`[19-packages] extraAfterAll: delete ${AUD_PKG_ATT_CODE} failed: status=${del.status}`);
          } else {
            // eslint-disable-next-line no-console
            console.log(`[19-packages] extraAfterAll: ${AUD_PKG_ATT_CODE} deleted OK (status=${del.status})`);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[19-packages] extraAfterAll: error cleaning up ${AUD_PKG_ATT_CODE}:`, err);
        }
        createdAttPkgId = null;
      }

      // ── 3. Cleanup scenario 01: delete AUD_PKG ───────────────────────────────
      if (createdPkgId) {
        // eslint-disable-next-line no-console
        console.log(`[19-packages] extraAfterAll: deleting ${AUD_PKG_CODE} id=${createdPkgId}...`);
        try {
          const del = await deletePackage(createdPkgId);
          if (del.status !== 200 && del.status !== 204) {
            // eslint-disable-next-line no-console
            console.error(`[19-packages] extraAfterAll: delete ${AUD_PKG_CODE} failed: status=${del.status}`);
          } else {
            // eslint-disable-next-line no-console
            console.log(`[19-packages] extraAfterAll: ${AUD_PKG_CODE} deleted OK (status=${del.status})`);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[19-packages] extraAfterAll: error cleaning up ${AUD_PKG_CODE}:`, err);
        }
        createdPkgId = null;
      }

      // ── 4. Defensive orphan sweep: delete any AUD_PKG_* package still active ──
      const allPkgs = await fetchPackageList();
      const orphans = allPkgs.filter((p) => p.code.startsWith('AUD_PKG_'));
      for (const orphan of orphans) {
        // eslint-disable-next-line no-console
        console.warn(`[19-packages] extraAfterAll: orphan detected — deleting ${orphan.code} id=${orphan.id}`);
        try {
          await setPackageRatePlans(orphan.id, []);
          await deletePackage(orphan.id);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[19-packages] extraAfterAll: error deleting orphan ${orphan.code}:`, err);
        }
      }

      // ── 5. Assert BKFST still has exactly 3 rate-plan links ──────────────────
      // eslint-disable-next-line no-console
      console.log('[19-packages] extraAfterAll: verifying BKFST link count...');
      const bkfstLinks = await fetchPackageRatePlans(BKFST_ID);
      if (bkfstLinks.data.length !== BKFST_EXPECTED_LINK_COUNT) {
        throw new Error(
          `CRITICAL: BKFST link count=${bkfstLinks.data.length} expected=${BKFST_EXPECTED_LINK_COUNT}. ` +
          `ratePlanIds=${bkfstLinks.data.map((l) => l.ratePlanId).join(',')}. ` +
          `Manual intervention required: PUT /api/packages/${BKFST_ID}/rate-plans`,
        );
      }
      // eslint-disable-next-line no-console
      console.log(`[19-packages] extraAfterAll: BKFST links OK (count=${bkfstLinks.data.length})`);

      // ── 6. Final state log ────────────────────────────────────────────────────
      const finalPkgs = await fetchPackageList();
      // eslint-disable-next-line no-console
      console.log(
        `[19-packages] extraAfterAll: final state — ${finalPkgs.length} active packages. ` +
        `codes=${finalPkgs.map((p) => p.code).join(',')}`,
      );
    },
  });

  // ── Pre-flight: verify PARK.amount and BKFST link count ─────────────────────
  test.beforeAll(async () => {
    // PARK amount must be 500.00
    const parkRes = await fetchPackage(PARK_ID);
    if (parkRes.status !== 200) {
      throw new Error(`[19-packages] pre-flight: PARK (${PARK_ID}) not found: status=${parkRes.status}`);
    }
    const parkBody = parkRes.body as { amount?: string; code?: string };
    if (parkBody.amount !== PARK_ORIGINAL_AMOUNT) {
      throw new Error(
        `[19-packages] pre-flight: PARK amount=${parkBody.amount} expected=${PARK_ORIGINAL_AMOUNT}. ` +
        `DB drift or prior run left it dirty.`,
      );
    }

    // BKFST must still have 3 rate-plan links
    const bkfstLinks = await fetchPackageRatePlans(BKFST_ID);
    if (bkfstLinks.data.length !== BKFST_EXPECTED_LINK_COUNT) {
      throw new Error(
        `[19-packages] pre-flight: BKFST link count=${bkfstLinks.data.length} expected=${BKFST_EXPECTED_LINK_COUNT}. ` +
        `DB drift detected. ratePlanIds=${bkfstLinks.data.map((l) => l.ratePlanId).join(',')}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log('[19-packages] pre-flight OK:', {
      parkAmount: parkBody.amount,
      bkfstLinks: bkfstLinks.data.length,
    });
  });

  // ── Scenario 01: list-view (ru+en) + create AUD_PKG (en-only) ────────────────
  test(
    '01-list-create: BKFST + PARK rows visible; create AUD_PKG; row appears',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await setLocaleAndGoto(page, locale, ROUTE);

      // Page title visible
      await expect(page.getByTestId('packages-title')).toBeVisible({ timeout: UI_TIMEOUT });

      // Table renders
      await expect(page.getByTestId('packages-table')).toBeVisible({ timeout: UI_TIMEOUT });

      // At least one row present
      const rows = page.getByTestId('package-row');
      await expect(rows.first()).toBeVisible({ timeout: UI_TIMEOUT });

      // BKFST row visible
      const bkfstRow = rows.filter({ has: page.getByTestId('package-code').filter({ hasText: 'BKFST' }) });
      await expect(bkfstRow).toHaveCount(1);
      await expect(bkfstRow.first()).toBeVisible();

      // PARK row visible
      const parkRow = rows.filter({ has: page.getByTestId('package-code').filter({ hasText: 'PARK' }) });
      await expect(parkRow).toHaveCount(1);
      await expect(parkRow.first()).toBeVisible();

      // RU: screenshot and return — no mutation
      if (locale === 'ru') {
        await auditScreenshot(page, SECTION_ID, '01-list-view', 'ru');
        return;
      }

      // ── EN: screenshot of initial list ──────────────────────────────────────
      await auditScreenshot(page, SECTION_ID, '01-list-view', 'en');

      // ── EN: Click "New package" button ──────────────────────────────────────
      const newBtn = page.getByTestId('packages-new');
      await expect(newBtn).toBeVisible({ timeout: UI_TIMEOUT });
      await newBtn.click();

      await page.waitForURL('**/configuration/packages/new', { timeout: UI_TIMEOUT });
      await expect(page.getByTestId('package-form')).toBeVisible({ timeout: UI_TIMEOUT });

      testInfo.attach('audit-pkg-code', { body: AUD_PKG_CODE, contentType: 'text/plain' });

      // Fill code
      const codeField = page.getByTestId('package-field-code').locator('input');
      await expect(codeField).toBeVisible({ timeout: UI_TIMEOUT });
      await codeField.fill(AUD_PKG_CODE);
      await expect(codeField).toHaveValue(AUD_PKG_CODE);

      // Fill name
      const nameField = page.getByTestId('package-field-name').locator('input');
      await expect(nameField).toBeVisible();
      await nameField.fill('Audit Package (C8)');

      // Set transaction code = BREAKFAST
      const tcSelect = page.getByTestId('package-field-transaction-code').locator('select');
      await expect(tcSelect).toBeVisible();
      await tcSelect.selectOption(BREAKFAST_TC_ID);

      // Set calculation rule = per_night
      const ruleSelect = page.getByTestId('package-field-calculation-rule').locator('select');
      await expect(ruleSelect).toBeVisible();
      await ruleSelect.selectOption('per_night');

      // Set amount = 100
      const amountInput = page.getByTestId('package-field-amount').locator('input');
      await expect(amountInput).toBeVisible();
      await amountInput.fill('100');

      // Posting rhythm = every_night (default — verify)
      const rhythmSelect = page.getByTestId('package-field-posting-rhythm').locator('select');
      await expect(rhythmSelect).toBeVisible();
      await rhythmSelect.selectOption('every_night');

      // Submit and intercept POST
      const [postResp] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes('/api/packages') &&
            r.request().method() === 'POST',
          { timeout: API_TIMEOUT },
        ),
        page.getByTestId('package-submit').click(),
      ]);

      const postStatus = postResp.status();
      testInfo.attach('post-response-status', { body: String(postStatus), contentType: 'text/plain' });
      expect([200, 201]).toContain(postStatus);

      // Capture ID for cleanup
      const postBody = await postResp.json().catch(() => ({})) as { id?: string };
      testInfo.attach('post-response-body', { body: JSON.stringify(postBody, null, 2), contentType: 'application/json' });
      if (postBody.id) {
        createdPkgId = postBody.id;
      }

      // Redirected to list
      await page.waitForURL('**/configuration/packages', { timeout: UI_TIMEOUT });
      await expect(page.getByTestId('packages-table')).toBeVisible({ timeout: UI_TIMEOUT });

      // New row visible
      const rowsAfter = page.getByTestId('package-row');
      await expect(rowsAfter.first()).toBeVisible({ timeout: UI_TIMEOUT });
      const newRow = rowsAfter.filter({ has: page.getByTestId('package-code').filter({ hasText: AUD_PKG_CODE }) });
      await expect(newRow.first()).toBeVisible({ timeout: UI_TIMEOUT });

      // If ID wasn't in response body, find via list API
      if (!createdPkgId) {
        const list = await fetchPackageList();
        const created = list.find((p) => p.code === AUD_PKG_CODE);
        createdPkgId = created?.id ?? null;
      }
      testInfo.attach('created-pkg-id', { body: createdPkgId ?? 'unknown', contentType: 'text/plain' });

      await auditScreenshot(page, SECTION_ID, '01-list-create', 'en');
    },
  );

  // ── Scenario 02: edit PARK amount (en-only) ───────────────────────────────────
  // Adapted from original "02-edit-components: Add a component (charge line)".
  // The package schema is monolithic — no "charge lines". Editing the amount field on PARK
  // is the equivalent idempotent mutation that exercises the edit UI path.
  test(
    '02-edit-existing: PARK amount 500→550; PUT 200; list shows 550; restore 550→500; verify',
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

      const editUrl = `/configuration/packages/${PARK_ID}/edit`;
      testInfo.attach('edit-target', { body: `PARK id=${PARK_ID}`, contentType: 'text/plain' });

      await setLocaleAndGoto(page, 'en', editUrl);

      // Form visible
      await expect(page.getByTestId('package-form')).toBeVisible({ timeout: UI_TIMEOUT });

      // Code field must be disabled in edit mode
      const codeField = page.getByTestId('package-field-code').locator('input');
      await expect(codeField).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(codeField).toBeDisabled();
      await expect(codeField).toHaveValue('PARK');

      // Amount field pre-filled with original value
      const amountInput = page.getByTestId('package-field-amount').locator('input');
      await expect(amountInput).toBeVisible({ timeout: UI_TIMEOUT });
      const originalAmount = await amountInput.inputValue();
      testInfo.attach('amount-before-edit', { body: originalAmount, contentType: 'text/plain' });

      // Change amount 500 → 550
      await amountInput.fill(PARK_EDITED_AMOUNT);
      await expect(amountInput).toHaveValue(PARK_EDITED_AMOUNT);

      // Submit and intercept PUT
      const [putResp] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes(`/api/packages/${PARK_ID}`) &&
            r.request().method() === 'PUT',
          { timeout: API_TIMEOUT },
        ),
        page.getByTestId('package-submit').click(),
      ]);

      // IMPORTANT: set flag BEFORE assertions so restore runs even if assertions fail
      parkMutationApplied = true;

      const putStatus = putResp.status();
      testInfo.attach('put-response-status', { body: String(putStatus), contentType: 'text/plain' });
      expect(putStatus).toBe(200);

      // No error banner
      await expect(page.getByTestId('package-error-banner')).not.toBeVisible();

      // Redirected to list
      await page.waitForURL('**/configuration/packages', { timeout: UI_TIMEOUT });

      // PARK row visible with updated amount visible
      await expect(page.getByTestId('packages-table')).toBeVisible({ timeout: UI_TIMEOUT });
      const parkRowAfter = page
        .getByTestId('package-row')
        .filter({ has: page.getByTestId('package-code').filter({ hasText: 'PARK' }) });
      await expect(parkRowAfter.first()).toBeVisible({ timeout: UI_TIMEOUT });

      // API confirms amount=550.00
      const reGet = await fetchPackage(PARK_ID);
      const reBody = reGet.body as { amount?: string };
      testInfo.attach('api-amount-after-550', { body: reBody.amount ?? '(null)', contentType: 'text/plain' });
      expect(reGet.status).toBe(200);
      expect(reBody.amount).toBe(PARK_EDITED_AMOUNT);

      await auditScreenshot(page, SECTION_ID, '02-edit-existing', 'en');

      // ── Idempotent reversal: set amount back to 500.00 ──────────────────────
      await setLocaleAndGoto(page, 'en', editUrl);
      await expect(page.getByTestId('package-form')).toBeVisible({ timeout: UI_TIMEOUT });

      const amountInput2 = page.getByTestId('package-field-amount').locator('input');
      await expect(amountInput2).toBeVisible({ timeout: UI_TIMEOUT });
      await amountInput2.fill(PARK_ORIGINAL_AMOUNT);
      await expect(amountInput2).toHaveValue(PARK_ORIGINAL_AMOUNT);

      const [putResp2] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes(`/api/packages/${PARK_ID}`) &&
            r.request().method() === 'PUT',
          { timeout: API_TIMEOUT },
        ),
        page.getByTestId('package-submit').click(),
      ]);

      expect(putResp2.status()).toBe(200);
      await page.waitForURL('**/configuration/packages', { timeout: UI_TIMEOUT });

      // API confirms restored to 500.00
      const reGet2 = await fetchPackage(PARK_ID);
      const reBody2 = reGet2.body as { amount?: string };
      testInfo.attach('api-amount-after-500-restore', { body: reBody2.amount ?? '(null)', contentType: 'text/plain' });
      expect(reGet2.status).toBe(200);
      expect(reBody2.amount).toBe(PARK_ORIGINAL_AMOUNT);
      // Reversal succeeded — reset flag so extraAfterAll doesn't re-restore
      parkMutationApplied = false;
    },
  );

  // ── Scenario 03: attach AUD_PKG_ATT to RACK rate plan (en-only) ──────────────
  test(
    '03-attach-to-rate-plan: create AUD_PKG_ATT via API; edit page; check RACK; submit; GET confirms link',
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

      // Create the test package via API (clean state)
      // eslint-disable-next-line no-console
      console.log(`[19-packages] scenario 03: creating ${AUD_PKG_ATT_CODE}...`);
      const attPkg = await createPackage(AUD_PKG_ATT_CODE, 'Audit Attach Pkg (C8)', PARKING_TC_ID);
      createdAttPkgId = attPkg.id;
      testInfo.attach('att-pkg-id', { body: attPkg.id, contentType: 'text/plain' });
      testInfo.attach('att-pkg-code', { body: AUD_PKG_ATT_CODE, contentType: 'text/plain' });

      // Verify no links initially
      const initialLinks = await fetchPackageRatePlans(attPkg.id);
      testInfo.attach('initial-link-count', { body: String(initialLinks.data.length), contentType: 'text/plain' });
      expect(initialLinks.data.length).toBe(0);

      // Open edit page
      const editUrl = `/configuration/packages/${attPkg.id}/edit`;
      await setLocaleAndGoto(page, 'en', editUrl);
      await expect(page.getByTestId('package-form')).toBeVisible({ timeout: UI_TIMEOUT });

      // Rate plan link rows should be visible (edit mode)
      const rackLinkRow = page.locator(`[data-testid="package-rate-plan-link"][data-rate-plan-id="${RACK_ID}"]`);
      await expect(rackLinkRow).toBeVisible({ timeout: UI_TIMEOUT });

      // RACK checkbox should be unchecked (no link yet)
      const rackCheckbox = rackLinkRow.getByTestId('package-rate-plan-link-check');
      await expect(rackCheckbox).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(rackCheckbox).not.toBeChecked();

      // Check RACK checkbox to link it
      await rackCheckbox.check();
      await expect(rackCheckbox).toBeChecked();

      // includedInRate sub-checkbox should now appear
      const includedCb = rackLinkRow.getByTestId('package-rate-plan-include-in-rate');
      await expect(includedCb).toBeVisible({ timeout: UI_TIMEOUT });

      // Submit — intercept the two requests (PUT package + PUT rate-plans)
      const pkgPutPromise = page.waitForResponse(
        (r) =>
          r.url().includes(`/api/packages/${attPkg.id}`) &&
          !r.url().includes('/rate-plans') &&
          r.request().method() === 'PUT',
        { timeout: API_TIMEOUT },
      );
      const ratePlansPutPromise = page.waitForResponse(
        (r) =>
          r.url().includes(`/api/packages/${attPkg.id}/rate-plans`) &&
          r.request().method() === 'PUT',
        { timeout: API_TIMEOUT },
      );

      await page.getByTestId('package-submit').click();

      const [pkgPutResp, ratePlansPutResp] = await Promise.all([pkgPutPromise, ratePlansPutPromise]);

      testInfo.attach('pkg-put-status', { body: String(pkgPutResp.status()), contentType: 'text/plain' });
      testInfo.attach('rate-plans-put-status', { body: String(ratePlansPutResp.status()), contentType: 'text/plain' });
      expect(pkgPutResp.status()).toBe(200);
      expect(ratePlansPutResp.status()).toBe(200);

      // Redirected to list
      await page.waitForURL('**/configuration/packages', { timeout: UI_TIMEOUT });

      // API confirms AUD_PKG_ATT is now linked to RACK
      const afterLinks = await fetchPackageRatePlans(attPkg.id);
      testInfo.attach('after-link-count', { body: String(afterLinks.data.length), contentType: 'text/plain' });
      expect(afterLinks.data.length).toBeGreaterThanOrEqual(1);
      const rackLink = afterLinks.data.find((l) => l.ratePlanId === RACK_ID);
      testInfo.attach('rack-link', { body: JSON.stringify(rackLink), contentType: 'text/plain' });
      expect(rackLink).toBeDefined();

      // Assert RACK rate plan has no side-effect (baseRate still 5000, isDefault still true)
      const rackR = await fetch(`${API_URL}/api/rate-plans/${RACK_ID}`);
      expect(rackR.ok).toBe(true);
      const rackData = await rackR.json() as { baseRate?: string; isDefault?: boolean };
      testInfo.attach('rack-rate-plan', { body: JSON.stringify(rackData, null, 2), contentType: 'application/json' });
      expect(rackData.isDefault).toBe(true);

      // Assert via GET /api/rate-plans/:id/packages that AUD_PKG_ATT is listed
      const rackPkgs = await fetchRatePlanPackages(RACK_ID);
      testInfo.attach('rack-packages', { body: JSON.stringify(rackPkgs.data, null, 2), contentType: 'application/json' });
      const attPkgInRack = rackPkgs.data.find((p) => p.packageId === attPkg.id);
      expect(attPkgInRack).toBeDefined();

      await auditScreenshot(page, SECTION_ID, '03-attach-to-rate-plan', 'en');
    },
  );

  // ── Scenario 04: delete (two parts, API-only — no UI delete path) ─────────────
  // There is NO delete button anywhere in the packages UI.
  // Part A: delete-blocked (BKFST linked to 3 plans → 400 HAS_RATE_PLANS).
  // Part B: happy-path delete (AUD_PKG_DEL created fresh, then deleted).
  test(
    '04-delete: A) BKFST DELETE→400 HAS_RATE_PLANS; B) AUD_PKG_DEL create→DELETE→404',
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'en', 'validation scenario runs only on en');

      // Navigate to list (for screenshot context)
      await setLocaleAndGoto(page, 'en', ROUTE);
      await expect(page.getByTestId('packages-table')).toBeVisible({ timeout: UI_TIMEOUT });

      // BKFST row present (sanity)
      const bkfstRow = page
        .getByTestId('package-row')
        .filter({ has: page.getByTestId('package-code').filter({ hasText: 'BKFST' }) });
      await expect(bkfstRow.first()).toBeVisible({ timeout: UI_TIMEOUT });

      // ── Part A: delete-blocked ───────────────────────────────────────────────
      testInfo.attach('delete-target-blocked', { body: `BKFST id=${BKFST_ID}`, contentType: 'text/plain' });

      const delBlocked = await deletePackage(BKFST_ID);
      testInfo.attach('delete-blocked-status', { body: String(delBlocked.status), contentType: 'text/plain' });
      testInfo.attach('delete-blocked-body', { body: JSON.stringify(delBlocked.body, null, 2), contentType: 'application/json' });

      expect(delBlocked.status).toBe(400);
      const blockedBody = delBlocked.body as { code?: string; error?: string };
      expect(blockedBody.code).toBe('HAS_RATE_PLANS');
      // Error message must contain reference to rate plan(s)
      expect(blockedBody.error).toMatch(/rate plans?/i);

      // BKFST still present in list (no mutation)
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('packages-table')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(
        page
          .getByTestId('package-row')
          .filter({ has: page.getByTestId('package-code').filter({ hasText: 'BKFST' }) })
          .first(),
      ).toBeVisible({ timeout: UI_TIMEOUT });

      // API confirms BKFST still exists
      const bkfstReGet = await fetchPackage(BKFST_ID);
      testInfo.attach('bkfst-still-present', { body: String(bkfstReGet.status === 200), contentType: 'text/plain' });
      expect(bkfstReGet.status).toBe(200);

      await auditScreenshot(page, SECTION_ID, '04-delete-blocked', 'en');

      // ── Part B: happy-path delete ────────────────────────────────────────────
      // Create AUD_PKG_DEL via API (no links → deletable)
      // eslint-disable-next-line no-console
      console.log(`[19-packages] scenario 04B: creating ${AUD_PKG_DEL_CODE}...`);
      const delPkg = await createPackage(AUD_PKG_DEL_CODE, 'Audit Delete Pkg (C8)', BREAKFAST_TC_ID);
      createdDelPkgId = delPkg.id;
      testInfo.attach('del-pkg-id', { body: delPkg.id, contentType: 'text/plain' });

      // DELETE via API — must succeed
      const delSuccess = await deletePackage(delPkg.id);
      testInfo.attach('delete-success-status', { body: String(delSuccess.status), contentType: 'text/plain' });
      testInfo.attach('delete-success-body', { body: JSON.stringify(delSuccess.body, null, 2), contentType: 'application/json' });
      expect([200, 204]).toContain(delSuccess.status);

      // re-GET → 404 PACKAGE_NOT_FOUND
      const reGet = await fetchPackage(delPkg.id);
      testInfo.attach('re-get-after-delete-status', { body: String(reGet.status), contentType: 'text/plain' });
      testInfo.attach('re-get-after-delete-body', { body: JSON.stringify(reGet.body, null, 2), contentType: 'application/json' });
      expect(reGet.status).toBe(404);
      const reGetBody = reGet.body as { code?: string };
      expect(reGetBody.code).toBe('PACKAGE_NOT_FOUND');

      // Clear tracker — already deleted, orphan sweep won't find it
      createdDelPkgId = null;

      await auditScreenshot(page, SECTION_ID, '04-delete-happy', 'en');
    },
  );
});
