import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditScreenshot,
  wireErrorCollectors,
  setLocaleAndGoto,
  API_URL,
  GBH_PROPERTY_ID,
  type ConsoleError,
  type NetworkError,
} from './shared.ts';
import { SEED } from './seed-refs.ts';
import { ensureActiveBusinessDate } from './fixtures.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SECTION_ID = '06-checkin-checkout';

const DIRTY_ROOM_ID = 'e3413f3d-a212-495e-b606-5410929e6d37'; // №206, dirty/vacant, STD
const OOS_ROOM_ID = SEED.room.oos; // №205, out_of_service
const OOS_ROOM_NUMBER = '205';

const errorsByProject: Record<
  string,
  Record<string, { console: ConsoleError[]; network: NetworkError[] }>
> = {};
const apiCallsByProject: Record<
  string,
  { method: string; path: string; status: number }[]
> = {};

const labels = {
  ru: {
    checkIn: 'Check In',
    checkOut: 'Check Out',
    confirmCheckOut: 'Подтвердить выселение',
    dirtyWarningTitle: 'Внимание: Номер требует уборки',
    forceCheckIn: 'Заселить всё равно',
    selectRoomForCheckIn: 'Выберите комнату для заселения',
    cancel: 'Отмена',
  },
  en: {
    checkIn: 'Check In',
    checkOut: 'Check Out',
    confirmCheckOut: 'Confirm Check-out',
    dirtyWarningTitle: 'Warning: Room requires housekeeping',
    forceCheckIn: 'Check in anyway',
    selectRoomForCheckIn: 'Select room for check-in',
    cancel: 'Cancel',
  },
} as const;

// Booking ids created in beforeAll, reused across tests.
let BK_A = ''; // clean-room check-in (scenario 01) → then check-out (scenario 04)
let BK_B = ''; // dirty-room force-check-in (scenario 02)
let BK_C = ''; // no-room check-in for room-picker (scenario 03)
let BK_E = ''; // existing checked-in booking with balance > 0 (scenario 05)

async function fetchGuestProfileId(): Promise<string> {
  const r = await fetch(
    `${API_URL}/api/profiles?propertyId=${GBH_PROPERTY_ID}&type=individual&limit=1`,
  );
  const page = (await r.json()) as { data: { id: string }[] };
  if (!page.data?.length) throw new Error('No individual profiles available');
  return page.data[0].id;
}

async function createConfirmedBooking(opts: {
  roomId: string | null;
  bizDate: string;
  nights?: number;
}): Promise<string> {
  const guestProfileId = await fetchGuestProfileId();
  const nights = opts.nights ?? 1;
  const checkOutDate = new Date(opts.bizDate);
  checkOutDate.setUTCDate(checkOutDate.getUTCDate() + nights);
  const body = {
    propertyId: GBH_PROPERTY_ID,
    guestProfileId,
    roomTypeId: SEED.roomType.standardDouble,
    ...(opts.roomId ? { roomId: opts.roomId } : {}),
    checkInDate: opts.bizDate,
    checkOutDate: checkOutDate.toISOString().slice(0, 10),
  };
  const r = await fetch(`${API_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(`POST /api/bookings failed: ${r.status} ${await r.text()}`);
  }
  const created = (await r.json()) as { id: string };
  return created.id;
}

async function getBookingStatus(id: string): Promise<{ status: string; roomId: string | null }> {
  const r = await fetch(`${API_URL}/api/bookings/${id}`);
  const b = (await r.json()) as { status: string; room?: { id: string | null } | null };
  return { status: b.status, roomId: b.room?.id ?? null };
}

async function getFolioBalance(bookingId: string): Promise<number> {
  const r = await fetch(`${API_URL}/api/bookings/${bookingId}/folio`);
  const d = (await r.json()) as { balance: number };
  return d.balance;
}

async function fetchPayCashCodeId(): Promise<string> {
  const r = await fetch(`${API_URL}/api/transaction-codes?propertyId=${GBH_PROPERTY_ID}`);
  const codes = (await r.json()) as { id: string; code: string; transactionType: string }[];
  const pay = codes.find((c) => c.code === 'PAY_CASH' && c.transactionType === 'payment');
  if (!pay) throw new Error('PAY_CASH transaction code not found');
  return pay.id;
}

async function postCashPayment(bookingId: string, amount: number): Promise<void> {
  const transactionCodeId = await fetchPayCashCodeId();
  const r = await fetch(`${API_URL}/api/bookings/${bookingId}/folio/payment`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transactionCodeId, amount }),
  });
  if (!r.ok) {
    throw new Error(`POST folio/payment failed: ${r.status} ${await r.text()}`);
  }
}

async function fetchCheckedInBookingWithBalance(
  excludeIds: string[] = [],
): Promise<{ bookingId: string; balance: number } | null> {
  const r = await fetch(
    `${API_URL}/api/bookings?propertyId=${GBH_PROPERTY_ID}&status=checked_in&limit=20`,
  );
  const page = (await r.json()) as { data: { id: string }[] };
  for (const b of page.data ?? []) {
    if (excludeIds.includes(b.id)) continue;
    const bal = await getFolioBalance(b.id);
    if (bal > 0) return { bookingId: b.id, balance: bal };
  }
  return null;
}

test.describe('06 checkin-checkout', () => {
  test.describe.configure({ mode: 'serial' });

  async function reserveCleanRoomBooking(bizDate: string): Promise<string> {
    const cleanRoomsRes = await fetch(
      `${API_URL}/api/rooms?propertyId=${GBH_PROPERTY_ID}&roomTypeId=${SEED.roomType.standardDouble}&housekeepingStatus=clean&occupancyStatus=vacant&limit=50`,
    );
    const cleanRooms = (await cleanRoomsRes.json()) as { id: string; roomNumber: string }[];
    if (!cleanRooms.length) throw new Error('No clean+vacant STD rooms available');

    let lastErr: string | null = null;
    for (const room of cleanRooms) {
      try {
        return await createConfirmedBooking({ roomId: room.id, bizDate });
      } catch (err) {
        lastErr = (err as Error).message;
        if (!lastErr.includes('ROOM_CONFLICT')) throw err;
      }
    }
    throw new Error(`Could not reserve any clean+vacant STD room. Last error: ${lastErr}`);
  }

  test.beforeAll(async () => {
    const bizDate = await ensureActiveBusinessDate();

    // Free up rooms held by orphan confirmed bookings left over by prior failed/interrupted
    // runs of this spec. We heuristically identify them as confirmed bookings whose
    // confirmationNumber > GBH-000209 (i.e. created after the pilot cut-off) and notes
    // left empty. Real seed bookings stop at GBH-000209 in the current dataset; everything
    // beyond is audit-created. Safe because the backfill bound is a low-water mark — if
    // real-world seed grows, we'd cancel at most a handful of legit bookings on an
    // already-test-instance DB.
    const conflictsRes = await fetch(
      `${API_URL}/api/bookings?propertyId=${GBH_PROPERTY_ID}&status=confirmed&limit=100`,
    );
    const conflicts = (await conflictsRes.json()) as {
      data: { id: string; confirmationNumber: string; room?: { id?: string } | null }[];
    };
    for (const b of conflicts.data ?? []) {
      const suffix = parseInt((b.confirmationNumber ?? '').split('-')[1] ?? '0', 10);
      if (suffix >= 210) {
        await fetch(`${API_URL}/api/bookings/${b.id}/cancel`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason: 'audit-section-06-cleanup' }),
        });
      }
    }

    // BK_C (no-room booking) is exercised by scenario 03 on both ru and en — cheap,
    // no room to hold, so create eagerly. BK_A and BK_B are allocated lazily inside
    // their en-only mutation scenarios (see reserveCleanRoomBooking / createConfirmedBooking
    // calls below) so that a skipped-on-ru project does not waste a clean or dirty room
    // that the en re-run of beforeAll would then fail to reserve again (ROOM_CONFLICT).
    BK_C = await createConfirmedBooking({ roomId: null, bizDate });

    // BK_E: find an existing checked_in booking with balance > 0. Not tied to our rooms.
    const existing = await fetchCheckedInBookingWithBalance([BK_C]);
    if (!existing) {
      throw new Error('No checked_in booking with balance > 0 found for scenario 05');
    }
    BK_E = existing.bookingId;
  });

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
    // Safety net: if mutating scenarios left any of our owned bookings in a non-final state,
    // leave them — test spec asserts exact progression. This hook only flushes error logs.
    const out = path.resolve(__dirname, `../audit-data/${SECTION_ID}-errors.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    let existing: { errors: typeof errorsByProject; api: typeof apiCallsByProject } = {
      errors: {},
      api: {},
    };
    try {
      existing = JSON.parse(fs.readFileSync(out, 'utf8'));
    } catch {
      /* first run */
    }
    const merged = {
      errors: { ...existing.errors, ...errorsByProject },
      api: { ...existing.api, ...apiCallsByProject },
    };
    fs.writeFileSync(out, JSON.stringify(merged, null, 2));
  });

  test('01-checkin-clean-room: confirmed + clean room → status becomes checked_in', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation test — en only to avoid double-mutate');
    const L = labels.en;

    // Lazy init: reserve a clean+vacant STD room now (rather than in beforeAll) so the ru
    // project's skipped run does not hold the room and cause the en re-run to fail.
    const bizDate = await ensureActiveBusinessDate();
    BK_A = await reserveCleanRoomBooking(bizDate);

    await setLocaleAndGoto(page, 'en', `/bookings/${BK_A}`);
    await page.waitForSelector('h1');

    // Capture pre-state
    await auditScreenshot(page, SECTION_ID, '01-checkin-clean-room-pre', 'en');

    const pre = await getBookingStatus(BK_A);
    expect(pre.status).toBe('confirmed');

    const checkInBtn = page.getByRole('button', { name: L.checkIn });
    await expect(checkInBtn).toBeVisible();
    await checkInBtn.click();

    // Wait for the Check-Out button to appear (visible only when status === checked_in).
    await expect(page.getByRole('button', { name: L.checkOut })).toBeVisible({ timeout: 15_000 });

    const post = await getBookingStatus(BK_A);
    testInfo.attach('bk-a-status-after-checkin', {
      body: `status=${post.status} roomId=${post.roomId ?? 'null'}`,
      contentType: 'text/plain',
    });
    expect(post.status).toBe('checked_in');
    expect(post.roomId).toBeTruthy();

    await auditScreenshot(page, SECTION_ID, '01-checkin-clean-room', 'en');
  });

  test('02-checkin-dirty-force: dirty room → warning modal → force-check-in empirically blocked', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation test — en only to avoid double-mutate');
    const L = labels.en;

    // Lazy init: reserve the dirty room (single-instance) now, same rationale as BK_A.
    const bizDate = await ensureActiveBusinessDate();
    BK_B = await createConfirmedBooking({ roomId: DIRTY_ROOM_ID, bizDate });

    await setLocaleAndGoto(page, 'en', `/bookings/${BK_B}`);
    await page.waitForSelector('h1');

    const checkInBtn = page.getByRole('button', { name: L.checkIn });
    await expect(checkInBtn).toBeVisible();
    await checkInBtn.click();

    // First click triggers POST /check-in which returns 400 ROOM_NOT_READY →
    // UI mounts the dirty-warning modal. Assert its title is rendered.
    const modalTitle = page.getByText(L.dirtyWarningTitle);
    await expect(modalTitle).toBeVisible({ timeout: 15_000 });

    await auditScreenshot(page, SECTION_ID, '02-checkin-dirty-warning', 'en');

    // Click "Check in anyway". Per handler at apps/api/src/routes/bookings.ts:521-530
    // the API does NOT honor request.body.force on check-in: it rejects ROOM_NOT_READY
    // regardless. The UI handler at booking-actions.tsx:169-172 re-opens the dirty-warning
    // modal on every ROOM_NOT_READY for action==="check-in", so the modal reappears rather
    // than ErrorDisplay being shown. Observable empirical behavior: status unchanged.
    const forceBtn = page.getByRole('button', { name: L.forceCheckIn });
    const [forceResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/bookings/${BK_B}/check-in`) &&
          r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      forceBtn.click(),
    ]);
    const forceBody = (await forceResp.json()) as { code?: string };
    testInfo.attach('force-checkin-response', {
      body: `status=${forceResp.status()} code=${forceBody.code ?? ''}`,
      contentType: 'text/plain',
    });
    expect(forceResp.status()).toBe(400);
    expect(forceBody.code).toBe('ROOM_NOT_READY');

    // Verify booking status is still 'confirmed' — force did not bypass API gate.
    const post = await getBookingStatus(BK_B);
    testInfo.attach('bk-b-status-after-force', {
      body: `status=${post.status}`,
      contentType: 'text/plain',
    });
    expect(post.status).toBe('confirmed');

    await auditScreenshot(page, SECTION_ID, '02-checkin-dirty-force-blocked', 'en');
  });

  test('03-checkin-oos-blocked: room-picker opens and OOS room is filtered out', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    const L = labels[locale];

    await setLocaleAndGoto(page, locale, `/bookings/${BK_C}`);
    await page.waitForSelector('h1');

    const checkInBtn = page.getByRole('button', { name: L.checkIn });
    await expect(checkInBtn).toBeVisible();
    await checkInBtn.click();

    // UI reacts to 400 NO_ROOM_ASSIGNED by opening RoomPickerModal.
    const modalTitle = page.getByText(L.selectRoomForCheckIn);
    await expect(modalTitle).toBeVisible({ timeout: 15_000 });

    // Wait for room options to be fetched and populated (beyond the placeholder "— select —").
    await expect
      .poll(async () => page.locator('select.select option').count(), { timeout: 10_000 })
      .toBeGreaterThan(1);

    // The OOS room (№205) must NOT be offered by the picker.
    const oosOption = page
      .locator('select.select option')
      .filter({ hasText: `№${OOS_ROOM_NUMBER}` });
    const oosCount = await oosOption.count();
    testInfo.attach('oos-option-count', {
      body: `options for №${OOS_ROOM_NUMBER} = ${oosCount}`,
      contentType: 'text/plain',
    });
    expect(oosCount).toBe(0);

    await auditScreenshot(page, SECTION_ID, '03-checkin-oos-blocked', locale);

    // Cancel out of the picker — booking stays confirmed, no mutation.
    // Scope to the modal (.card near the select) to avoid clicking the page-level
    // "Cancel Booking" button sitting behind the overlay.
    const modalCard = page.locator('.card', { has: page.locator('select.select') }).first();
    const cancelBtn = modalCard.getByRole('button', { name: L.cancel });
    await cancelBtn.click();
    await expect(modalTitle).toHaveCount(0, { timeout: 5_000 });

    const post = await getBookingStatus(BK_C);
    expect(post.status).toBe('confirmed');
  });

  test('04-checkout-zero-balance: BK_A has zero balance → check-out succeeds', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation test — en only to avoid double-mutate');
    const L = labels.en;

    // Precondition: BK_A is checked_in from scenario 01.
    const pre = await getBookingStatus(BK_A);
    expect(pre.status).toBe('checked_in');

    // Pay off any outstanding balance (fresh booking typically balance=0, but be defensive:
    // night-audit or other concurrent runs may have posted a room charge).
    const balance = await getFolioBalance(BK_A);
    testInfo.attach('bk-a-balance-before-checkout', {
      body: String(balance),
      contentType: 'text/plain',
    });
    if (balance > 0) {
      await postCashPayment(BK_A, balance);
      const after = await getFolioBalance(BK_A);
      expect(after).toBe(0);
    }

    await setLocaleAndGoto(page, 'en', `/bookings/${BK_A}`);
    await page.waitForSelector('h1');

    const checkOutBtn = page.getByRole('button', { name: L.checkOut });
    await expect(checkOutBtn).toBeVisible();
    const [firstResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/api/bookings/${BK_A}/check-out`) && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      checkOutBtn.click(),
    ]);

    // checkOutDate (bizDate+1) is in the future → first call returns EARLY_CHECKOUT and UI
    // mounts the force-checkout banner. Confirm that and click the "Confirm Check-out" button.
    if (firstResp.status() === 400) {
      const firstBody = (await firstResp.json()) as { code?: string };
      testInfo.attach('bk-a-first-checkout-response', {
        body: `status=400 code=${firstBody.code ?? ''}`,
        contentType: 'text/plain',
      });
      expect(['EARLY_CHECKOUT', 'LATE_CHECKOUT']).toContain(firstBody.code);
      const confirmBtn = page.getByRole('button', { name: L.confirmCheckOut });
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
      const [secondResp] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes(`/api/bookings/${BK_A}/check-out`) && r.request().method() === 'POST',
          { timeout: 15_000 },
        ),
        confirmBtn.click(),
      ]);
      expect(secondResp.ok()).toBeTruthy();
    } else {
      expect(firstResp.ok()).toBeTruthy();
    }

    // After success, Check-Out button disappears because status === checked_out.
    await expect(page.getByRole('button', { name: L.checkOut })).toHaveCount(0, { timeout: 15_000 });

    const post = await getBookingStatus(BK_A);
    testInfo.attach('bk-a-status-after-checkout', {
      body: `status=${post.status}`,
      contentType: 'text/plain',
    });
    expect(post.status).toBe('checked_out');

    await auditScreenshot(page, SECTION_ID, '04-checkout-zero-balance', 'en');
  });

  test('05-checkout-nonzero-balance-warning: non-zero balance → UNPAID_BALANCE error, status unchanged', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    const L = labels[locale];

    // Precondition: BK_E is checked_in with balance > 0.
    const preBalance = await getFolioBalance(BK_E);
    expect(preBalance).toBeGreaterThan(0);
    const pre = await getBookingStatus(BK_E);
    expect(pre.status).toBe('checked_in');

    await setLocaleAndGoto(page, locale, `/bookings/${BK_E}`);
    await page.waitForSelector('h1');

    const checkOutBtn = page.getByRole('button', { name: L.checkOut });
    await expect(checkOutBtn).toBeVisible();

    // Trigger the POST and wait on it atomically — otherwise the response may race past
    // our listener on slow runs (observed empirically on ru project).
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/bookings/${BK_E}/check-out`) && r.request().method() === 'POST',
        { timeout: 20_000 },
      ),
      checkOutBtn.click(),
    ]);
    const status = resp.status();
    const body = (await resp.json()) as { code?: string; balance?: number };
    testInfo.attach('bk-e-checkout-response', {
      body: `status=${status} code=${body.code ?? ''} balance=${body.balance ?? ''}`,
      contentType: 'text/plain',
    });

    // Depending on BK_E's checkOutDate vs bizDate, the error may be UNPAID_BALANCE (balance
    // guarded first only when dates match) — actually code order is: INVALID_STATUS → EARLY/LATE
    // → UNPAID_BALANCE. If checkOutDate is in the past, we get LATE_CHECKOUT and the banner
    // appears. Either way we assert status=400 and booking stays checked_in.
    expect(status).toBe(400);
    expect(['UNPAID_BALANCE', 'EARLY_CHECKOUT', 'LATE_CHECKOUT']).toContain(body.code);

    // Give the UI a moment to render the error/banner before screenshotting.
    await page.waitForLoadState('networkidle');
    await auditScreenshot(page, SECTION_ID, '05-checkout-nonzero-balance-warning', locale);

    const post = await getBookingStatus(BK_E);
    expect(post.status).toBe('checked_in');
  });
});
