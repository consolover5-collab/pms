/**
 * Section 16 — Configuration: Room Types (/configuration/room-types)
 *
 * HIGH-RISK: Room types are referenced by rooms (54) and bookings (103+74+65+5 ≈ 247).
 * Any accidental DELETE on a seeded type destroys downstream data.
 * Snapshot-restore discipline is mandatory for all mutations.
 *
 * Pre-flight probe (2026-04-21) — property GBH (ff1d9135-dfb9-4baa-be46-0e739cd26dad):
 *   STD     Standard Double   maxOcc=2  rooms=24  id=e8f25fcd-bdaf-43bb-b39f-4d9ad6d83c84
 *   STD_TWN Standard Twin     maxOcc=2  rooms=5   id=689f969c-d956-4138-8b63-0490c11e1f90
 *   SUP     Superior          maxOcc=2  rooms=15  id=5c05d667-58c6-4add-b5b9-1ff3409f3305
 *   PRM     Premium           maxOcc=2  rooms=6   id=25d75a4a-2c4c-424c-b4cc-a369315e6dc1
 *   JRS     Junior Suite      maxOcc=3  rooms=2   id=0589e980-b720-4ba1-a29a-ad695865797f
 *   STE     Suite             maxOcc=4  rooms=2   id=9d5ffc7b-64f7-4f4a-aa58-48f3ae29a9a7
 *   Total room count = 54
 *
 * Scenarios:
 *   01 — list-create: Navigate list; assert 6 rows + codes; click Add; fill form
 *        (code=AUD_TYPE, name="Audit Type (C6)", maxOcc=2, sortOrder=99); submit;
 *        assert redirect + row visible. en-only mutation; RU read skipped.
 *        Cleanup in extraAfterAll: DELETE createdId; verify AUD_TYPE gone.
 *        Belt-and-suspenders: after cleanup assert all 6 seed codes still present.
 *
 *   02 — edit: Target JRS (lowest rooms=2). Snapshot beforeAll. Navigate edit page;
 *        change description → "Junior suite — edited by UI audit (will be restored)";
 *        submit; assert redirect; API re-GET confirms change. en-only.
 *        Restore in extraAfterAll: PUT snapshot; re-GET; assert match. Throw CRITICAL on mismatch.
 *
 *   03 — associated-rooms: Navigate STD detail (24 rooms). Assert title contains
 *        "Standard Double". Assert ≥20 room-type-detail-room-row elements. Assert first
 *        row roomNumber non-empty. Read-only; ru+en.
 *        Page labels NOT asserted — see BUG-009 (hardcoded English on detail page).
 *
 *   04 — delete-blocked: Click Delete for STD_TWN (5 rooms). stub window.confirm → accept.
 *        Intercept DELETE response; assert 400 + body.code=HAS_DEPENDENCIES + body.count=5.
 *        NOTE: Plan said "HAS_ROOMS" but actual API code is "HAS_DEPENDENCIES" (verified 2026-04-21).
 *        No cleanup needed (validation runs before any DB mutation).
 */

import { test, expect } from '@playwright/test';
import {
  API_URL,
  GBH_PROPERTY_ID,
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
} from './shared.ts';

const SECTION_ID = '16-configuration-room-types';
const ROUTE = '/configuration/room-types';

const API_TIMEOUT = 15_000;
const UI_TIMEOUT  = 10_000;

// ── Probe-confirmed seed values (2026-04-21) ───────────────────────────────────
const PROPERTY_ID = GBH_PROPERTY_ID; // ff1d9135-dfb9-4baa-be46-0e739cd26dad

const STD_ID     = 'e8f25fcd-bdaf-43bb-b39f-4d9ad6d83c84'; // 24 rooms
const STD_TWN_ID = '689f969c-d956-4138-8b63-0490c11e1f90'; // 5 rooms → delete-blocked target
const JRS_ID     = '0589e980-b720-4ba1-a29a-ad695865797f'; // 2 rooms → edit target

const SEED_CODES = ['STD', 'STD_TWN', 'SUP', 'PRM', 'JRS', 'STE'] as const;

// ── Types ─────────────────────────────────────────────────────────────────────
type RoomTypeListItem = {
  id: string;
  code: string;
  name: string;
  maxOccupancy: number;
  baseRate: string;
  description: string | null;
  sortOrder: number;
  roomCount: number;
};

type RoomTypeSnapshot = {
  id: string;
  code: string;
  name: string;
  maxOccupancy: number;
  baseRate: string;
  description: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

// ── Module-scope mutation trackers ─────────────────────────────────────────────
let createdTypeId: string | null = null;          // set by scenario 01
let jrsSnapshot: RoomTypeSnapshot | null = null;  // set in beforeAll
let editMutationApplied = false;                  // set in scenario 02

// ── API helpers ───────────────────────────────────────────────────────────────
async function fetchRoomTypesList(): Promise<RoomTypeListItem[]> {
  const r = await fetch(`${API_URL}/api/room-types?propertyId=${PROPERTY_ID}`);
  if (!r.ok) throw new Error(`GET /api/room-types?propertyId=... failed: ${r.status}`);
  return r.json();
}

async function fetchRoomType(id: string): Promise<RoomTypeSnapshot> {
  const r = await fetch(`${API_URL}/api/room-types/${id}`);
  if (!r.ok) throw new Error(`GET /api/room-types/${id} failed: ${r.status}`);
  return r.json();
}

async function putRoomType(id: string, body: Omit<RoomTypeSnapshot, 'id' | 'createdAt' | 'updatedAt'>): Promise<RoomTypeSnapshot> {
  const r = await fetch(`${API_URL}/api/room-types/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, propertyId: PROPERTY_ID }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`PUT /api/room-types/${id} failed: ${r.status} — ${text}`);
  }
  return r.json();
}

async function deleteRoomType(id: string): Promise<{ status: number; body: unknown }> {
  const r = await fetch(`${API_URL}/api/room-types/${id}?propertyId=${PROPERTY_ID}`, {
    method: 'DELETE',
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

// ── Test suite ─────────────────────────────────────────────────────────────────
test.describe('16 configuration-room-types', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID, {
    extraAfterAll: async () => {
      // ── 1. Cleanup scenario 01: delete created AUD_TYPE ───────────────────
      if (createdTypeId) {
        // eslint-disable-next-line no-console
        console.log(`[16-room-types] extraAfterAll: deleting created type id=${createdTypeId}...`);
        const del = await deleteRoomType(createdTypeId);
        if (del.status !== 200) {
          // eslint-disable-next-line no-console
          console.error(`[16-room-types] extraAfterAll: delete AUD_TYPE failed: status=${del.status} body=${JSON.stringify(del.body)}`);
        }
        createdTypeId = null;
      }

      // ── 2. Restore scenario 02: PUT JRS back to snapshot ──────────────────
      if (editMutationApplied && jrsSnapshot) {
        // eslint-disable-next-line no-console
        console.log('[16-room-types] extraAfterAll: restoring JRS snapshot...');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, createdAt, updatedAt, ...snapshotBody } = jrsSnapshot;
        const restored = await putRoomType(JRS_ID, snapshotBody);

        // Verify critical fields restored
        const fieldsToCheck: Array<keyof typeof snapshotBody> = ['code', 'name', 'maxOccupancy', 'description', 'sortOrder', 'baseRate'];
        for (const field of fieldsToCheck) {
          const expected = String(snapshotBody[field]);
          const actual   = String((restored as Record<string, unknown>)[field]);
          if (expected !== actual) {
            throw new Error(
              `CRITICAL: JRS restore mismatch — field=${field} expected="${expected}" actual="${actual}". ` +
              `Manual intervention required: PUT /api/room-types/${JRS_ID}`,
            );
          }
        }
        // eslint-disable-next-line no-console
        console.log(`[16-room-types] extraAfterAll: JRS restored OK. description="${restored.description}"`);
        editMutationApplied = false;
      }

      // ── 3. Belt-and-suspenders: assert all 6 seed types still present ─────
      const finalList = await fetchRoomTypesList();
      const finalCodes = finalList.map((rt) => rt.code);

      for (const code of SEED_CODES) {
        if (!finalCodes.includes(code)) {
          throw new Error(
            `CRITICAL: seed room type ${code} is MISSING after extraAfterAll. ` +
            `finalCodes=${finalCodes.join(',')}. Manual intervention required.`,
          );
        }
      }
      // AUD_TYPE must be gone
      if (finalCodes.includes('AUD_TYPE')) {
        throw new Error(
          `CRITICAL: AUD_TYPE still present after cleanup! ` +
          `Attempt manual DELETE /api/room-types/:id?propertyId=${PROPERTY_ID}`,
        );
      }
      // eslint-disable-next-line no-console
      console.log(`[16-room-types] extraAfterAll: final state OK — all 6 seed types present, AUD_TYPE absent.`);
    },
  });

  // ── Pre-flight: snapshot JRS + verify 6 seed types ────────────────────────
  test.beforeAll(async () => {
    // Snapshot JRS for scenario 02 restore
    jrsSnapshot = await fetchRoomType(JRS_ID);
    // eslint-disable-next-line no-console
    console.log('[16-room-types] pre-flight JRS snapshot:', JSON.stringify(jrsSnapshot));

    // Verify all 6 seed types present
    const list = await fetchRoomTypesList();
    const codes = list.map((rt) => rt.code);
    for (const code of SEED_CODES) {
      if (!codes.includes(code)) {
        throw new Error(`[16-room-types] pre-flight: seed type ${code} missing from list. DB drift. codes=${codes.join(',')}`);
      }
    }
    if (list.length < 6) {
      throw new Error(`[16-room-types] pre-flight: expected ≥6 room types, got ${list.length}`);
    }
  });

  // ── Scenario 01: list-view (ru+en) + create + cleanup ─────────────────────
  test('01-list-create: list shows 6 seed rows; create AUD_TYPE; row appears; cleanup queued', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    // Table must be visible
    await expect(page.getByTestId('room-types-list')).toBeVisible({ timeout: UI_TIMEOUT });

    // Exactly 6 seed rows
    const rows = page.getByTestId('room-type-row');
    await expect(rows.first()).toBeVisible({ timeout: UI_TIMEOUT });
    const rowCount = await rows.count();
    testInfo.attach('initial-row-count', { body: String(rowCount), contentType: 'text/plain' });
    expect(rowCount).toBe(6);

    // All seed codes visible in the code column
    for (const code of SEED_CODES) {
      const codeCell = page.getByTestId('room-type-code').filter({ hasText: code });
      await expect(codeCell.first()).toBeVisible({ timeout: UI_TIMEOUT });
    }

    // RU read ends here; mutation only runs in EN
    if (locale === 'ru') {
      await auditScreenshot(page, SECTION_ID, '01-list-view', 'ru');
      return;
    }

    // ── EN: Create new room type AUD_TYPE ────────────────────────────────────
    const addBtn = page.getByTestId('room-types-add');
    await expect(addBtn).toBeVisible({ timeout: UI_TIMEOUT });
    await addBtn.click();

    // Should land on /new
    await page.waitForURL('**/configuration/room-types/new', { timeout: UI_TIMEOUT });

    // Form must be visible
    await expect(page.getByTestId('room-type-form')).toBeVisible({ timeout: UI_TIMEOUT });

    // Fill code
    const codeInput = page.getByTestId('room-type-field-code');
    await expect(codeInput).toBeVisible({ timeout: UI_TIMEOUT });
    await codeInput.fill('AUD_TYPE');
    await expect(codeInput).toHaveValue('AUD_TYPE');

    // Fill name
    const nameInput = page.getByTestId('room-type-field-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Audit Type (C6)');

    // Fill maxOccupancy (already 2; set explicitly)
    const maxOccInput = page.getByTestId('room-type-field-max-occupancy');
    await expect(maxOccInput).toBeVisible();
    await maxOccInput.fill('2');

    // Fill description
    const descInput = page.getByTestId('room-type-field-description');
    await expect(descInput).toBeVisible();
    await descInput.fill('Created by UI audit section 16 (BUG-009 screening)');

    // Fill sortOrder
    const sortInput = page.getByTestId('room-type-field-sort-order');
    await expect(sortInput).toBeVisible();
    await sortInput.fill('99');

    // Submit and intercept POST
    const [postResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/room-types') &&
          r.request().method() === 'POST',
        { timeout: API_TIMEOUT },
      ),
      page.getByTestId('room-type-submit').click(),
    ]);

    const postStatus = postResp.status();
    testInfo.attach('post-response-status', { body: String(postStatus), contentType: 'text/plain' });
    expect([200, 201]).toContain(postStatus);

    // Capture created ID for cleanup
    const postBody = await postResp.json().catch(() => ({})) as { id?: string };
    testInfo.attach('post-response-body', { body: JSON.stringify(postBody, null, 2), contentType: 'application/json' });
    if (postBody.id) {
      createdTypeId = postBody.id;
    }

    // Redirected back to list
    await page.waitForURL('**/configuration/room-types', { timeout: UI_TIMEOUT });
    await expect(page.getByTestId('room-types-list')).toBeVisible({ timeout: UI_TIMEOUT });

    // AUD_TYPE row now visible
    const audRow = page.getByTestId('room-type-code').filter({ hasText: 'AUD_TYPE' });
    await expect(audRow.first()).toBeVisible({ timeout: UI_TIMEOUT });

    // Row count should be 7
    const rowsAfter = page.getByTestId('room-type-row');
    await expect(rowsAfter.first()).toBeVisible({ timeout: UI_TIMEOUT });
    const rowCountAfter = await rowsAfter.count();
    testInfo.attach('post-create-row-count', { body: String(rowCountAfter), contentType: 'text/plain' });
    expect(rowCountAfter).toBe(7);

    // If POST body didn't carry id, fetch from list
    if (!createdTypeId) {
      const currentList = await fetchRoomTypesList();
      const created = currentList.find((rt) => rt.code === 'AUD_TYPE');
      createdTypeId = created?.id ?? null;
    }
    testInfo.attach('created-type-id', { body: createdTypeId ?? 'unknown', contentType: 'text/plain' });

    await auditScreenshot(page, SECTION_ID, '01-list-create', 'en');
  });

  // ── Scenario 02: edit JRS description (mutation, en-only) ─────────────────
  test('02-edit: open JRS edit; change description; PUT 200; API confirms; restore queued', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    const editUrl = `/configuration/room-types/${JRS_ID}/edit`;
    const newDescription = 'Junior suite — edited by UI audit (will be restored)';

    testInfo.attach('edit-target', { body: `JRS id=${JRS_ID}`, contentType: 'text/plain' });
    testInfo.attach('snapshot-description', { body: jrsSnapshot?.description ?? '(null)', contentType: 'text/plain' });
    testInfo.attach('new-description', { body: newDescription, contentType: 'text/plain' });

    await setLocaleAndGoto(page, 'en', editUrl);

    // Form visible
    await expect(page.getByTestId('room-type-form')).toBeVisible({ timeout: UI_TIMEOUT });

    // Description field pre-filled
    const descInput = page.getByTestId('room-type-field-description');
    await expect(descInput).toBeVisible({ timeout: UI_TIMEOUT });

    // Change description
    await descInput.fill(newDescription);
    await expect(descInput).toHaveValue(newDescription);

    // Submit and intercept PUT
    const [putResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/room-types/${JRS_ID}`) &&
          r.request().method() === 'PUT',
        { timeout: API_TIMEOUT },
      ),
      page.getByTestId('room-type-submit').click(),
    ]);

    // IMPORTANT: set flag BEFORE assertions so restore runs even if assertions fail
    editMutationApplied = true;

    const putStatus = putResp.status();
    testInfo.attach('put-response-status', { body: String(putStatus), contentType: 'text/plain' });
    expect(putStatus).toBe(200);

    // No error banner
    await expect(page.getByTestId('room-type-error-banner')).not.toBeVisible();

    // Redirected back to list
    await page.waitForURL('**/configuration/room-types', { timeout: UI_TIMEOUT });

    // API confirms description updated
    const afterPut = await fetchRoomType(JRS_ID);
    testInfo.attach('api-description-after-put', { body: afterPut.description ?? '(null)', contentType: 'text/plain' });
    expect(afterPut.description).toBe(newDescription);

    await auditScreenshot(page, SECTION_ID, '02-edit-saved', 'en');
  });

  // ── Scenario 03: associated-rooms detail page (ru+en, read-only) ──────────
  // Page labels are hardcoded English (BUG-009) — do NOT assert label text.
  // Assert: title, ≥20 room rows, each row shows non-empty roomNumber (#NNN).
  test('03-associated-rooms: STD detail page; title contains "Standard Double"; ≥20 room rows visible', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, `/configuration/room-types/${STD_ID}`);

    // Title must contain the static seed name "Standard Double"
    // (not asserted via i18n — it's the room type name, not a label)
    const titleEl = page.getByTestId('room-type-detail-title');
    await expect(titleEl).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(titleEl).toContainText('Standard Double');

    // Edit button present (hardcoded "Edit Type" — see BUG-009 for i18n fix)
    await expect(page.getByTestId('room-type-detail-edit')).toBeVisible({ timeout: UI_TIMEOUT });

    // Rooms section wrapper present
    await expect(page.getByTestId('room-type-detail-rooms')).toBeVisible({ timeout: UI_TIMEOUT });

    // Room rows: STD has 24 rooms; assert ≥20 as defensive threshold
    const roomRows = page.getByTestId('room-type-detail-room-row');
    await expect(roomRows.first()).toBeVisible({ timeout: UI_TIMEOUT });
    const roomRowCount = await roomRows.count();
    testInfo.attach('room-row-count', { body: String(roomRowCount), contentType: 'text/plain' });
    expect(roomRowCount).toBeGreaterThanOrEqual(20);

    // Each row contains a room number (non-empty text starting with #)
    // Sample first 3 rows to keep test fast
    for (let i = 0; i < Math.min(3, roomRowCount); i++) {
      const row = roomRows.nth(i);
      const cellText = await row.locator('td').first().textContent();
      testInfo.attach(`room-row-${i}-text`, { body: cellText ?? '', contentType: 'text/plain' });
      expect(cellText).toMatch(/^#\d+/);
    }

    // NOTE: Page labels (Room #, Floor, HK Status, Occupancy, Actions, hkLabels, "Clean"/"Dirty"/…,
    // "Occupied"/"Vacant", "Edit Type", "All rooms →", etc.) are NOT asserted here.
    // See BUG-009: detail page is fully hardcoded English regardless of locale.
    // This scenario tests only structural rendering (rows present, title shows name).

    await auditScreenshot(page, SECTION_ID, '03-associated-rooms', locale);
  });

  // ── Scenario 04: delete-blocked — STD_TWN has rooms → 400 HAS_ROOMS ───────
  test('04-delete-blocked: STD_TWN delete attempt → 400 HAS_ROOMS count=5; no mutation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    await setLocaleAndGoto(page, 'en', ROUTE);

    // Table visible
    await expect(page.getByTestId('room-types-list')).toBeVisible({ timeout: UI_TIMEOUT });

    // Find STD_TWN row by data-room-type-id attribute
    const stdTwnRow = page.locator('[data-testid="room-type-row"][data-room-type-id="' + STD_TWN_ID + '"]');
    await expect(stdTwnRow).toBeVisible({ timeout: UI_TIMEOUT });

    // Verify code cell shows STD_TWN (sanity check)
    const codeInRow = stdTwnRow.getByTestId('room-type-code');
    await expect(codeInRow).toContainText('STD_TWN');

    // Stub window.confirm → accept so dialog doesn't block the click
    page.on('dialog', async (dialog) => {
      testInfo.attach('confirm-dialog-message', { body: dialog.message(), contentType: 'text/plain' });
      await dialog.accept();
    });

    // Intercept the DELETE request
    const deleteBtn = stdTwnRow.getByTestId('room-type-delete');
    await expect(deleteBtn).toBeVisible({ timeout: UI_TIMEOUT });

    const [deleteResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/room-types/${STD_TWN_ID}`) &&
          r.request().method() === 'DELETE',
        { timeout: API_TIMEOUT },
      ),
      deleteBtn.click(),
    ]);

    const deleteStatus = deleteResp.status();
    testInfo.attach('delete-response-status', { body: String(deleteStatus), contentType: 'text/plain' });
    expect(deleteStatus).toBe(400);

    // Response body must carry HAS_DEPENDENCIES code + count=5
    // NOTE: Plan incorrectly described this as "HAS_ROOMS"; actual API code is "HAS_DEPENDENCIES"
    // (apps/api/src/routes/room-types.ts line 109 — checked 2026-04-21)
    const deleteBody = await deleteResp.json().catch(() => ({})) as { code?: string; count?: number; error?: string };
    testInfo.attach('delete-response-body', { body: JSON.stringify(deleteBody, null, 2), contentType: 'application/json' });
    expect(deleteBody.code).toBe('HAS_DEPENDENCIES');
    expect(deleteBody.count).toBe(5);

    // STD_TWN row must still be present (no mutation)
    await expect(stdTwnRow).toBeVisible({ timeout: UI_TIMEOUT });

    // API confirms STD_TWN still exists
    const list = await fetchRoomTypesList();
    const stdTwnStillPresent = list.some((rt) => rt.id === STD_TWN_ID);
    testInfo.attach('stdtwn-still-present', { body: String(stdTwnStillPresent), contentType: 'text/plain' });
    expect(stdTwnStillPresent).toBe(true);

    await auditScreenshot(page, SECTION_ID, '04-delete-blocked', 'en');
  });
});
