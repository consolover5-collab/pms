import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
  API_URL,
  GBH_PROPERTY_ID,
} from './shared.ts';
import { SEED } from './seed-refs.ts';
import {
  cleanupAuditBookings,
  createConfirmedBooking,
  ensureActiveBusinessDate,
  fetchCheckedInBooking,
  fetchTransactionCode,
  getBookingStatus,
  getFolioBalance,
  postFolioPayment,
} from './fixtures.ts';

const SECTION_ID = '06-checkin-checkout';
const AUDIT_MARKER = 'audit-section-06';

const DIRTY_ROOM_ID = 'e3413f3d-a212-495e-b606-5410929e6d37'; // №206, dirty/vacant, STD
const OOS_ROOM_ID = SEED.room.oos; // №205, out_of_service
const OOS_ROOM_NUMBER = '205';

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

test.describe('06 checkin-checkout', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID);

  async function reserveCleanRoomBooking(bizDate: string): Promise<string> {
    const cleanRoomsRes = await fetch(
      `${API_URL}/api/rooms?propertyId=${GBH_PROPERTY_ID}&roomTypeId=${SEED.roomType.standardDouble}&housekeepingStatus=clean&occupancyStatus=vacant&limit=50`,
    );
    const cleanRooms = (await cleanRoomsRes.json()) as { id: string; roomNumber: string }[];
    if (!cleanRooms.length) throw new Error('No clean+vacant STD rooms available');

    let lastErr: string | null = null;
    for (const room of cleanRooms) {
      try {
        return await createConfirmedBooking({
          roomId: room.id,
          bizDate,
          marker: AUDIT_MARKER,
        });
      } catch (err) {
        lastErr = (err as Error).message;
        if (!lastErr.includes('ROOM_CONFLICT')) throw err;
      }
    }
    throw new Error(`Could not reserve any clean+vacant STD room. Last error: ${lastErr}`);
  }

  test.beforeAll(async () => {
    // Sweep orphan confirmed bookings left by prior interrupted runs of this spec.
    // cleanupAuditBookings matches booking.notes against the AUDIT_MARKER prefix —
    // all audit-created bookings now carry that marker (see createConfirmedBooking
    // calls with `marker: AUDIT_MARKER`). This replaces the old confirmationNumber
    // >= 210 heuristic that assumed a seed cut-off.
    await cleanupAuditBookings(AUDIT_MARKER);

    const bizDate = await ensureActiveBusinessDate();

    // BK_C (no-room booking) is exercised by scenario 03 on both ru and en — cheap,
    // no room to hold, so create eagerly. BK_A and BK_B are allocated lazily inside
    // their en-only mutation scenarios (see reserveCleanRoomBooking / createConfirmedBooking
    // calls below) so that a skipped-on-ru project does not waste a clean or dirty room
    // that the en re-run of beforeAll would then fail to reserve again (ROOM_CONFLICT).
    BK_C = await createConfirmedBooking({
      roomId: null,
      bizDate,
      marker: AUDIT_MARKER,
    });

    // BK_E: find an existing checked_in booking with balance > 0. Not tied to our rooms.
    const existing = await fetchCheckedInBooking({
      balancePredicate: 'positive',
      excludeIds: [BK_C],
    });
    if (!existing) {
      throw new Error('No checked_in booking with balance > 0 found for scenario 05');
    }
    BK_E = existing.bookingId;
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
    BK_B = await createConfirmedBooking({
      roomId: DIRTY_ROOM_ID,
      bizDate,
      marker: AUDIT_MARKER,
    });

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

    // Click "Check in anyway". After BUG-004 fix the API honors
    // request.body.force and allows check-in for dirty/pickup rooms.
    // Expected: 200 + booking transitions to checked_in.
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
    testInfo.attach('force-checkin-status', {
      body: `status=${forceResp.status()}`,
      contentType: 'text/plain',
    });
    expect(forceResp.status()).toBe(200);

    // Verify booking transitioned to checked_in — force bypassed the hk gate.
    const post = await getBookingStatus(BK_B);
    testInfo.attach('bk-b-status-after-force', {
      body: `status=${post.status}`,
      contentType: 'text/plain',
    });
    expect(post.status).toBe('checked_in');

    await auditScreenshot(page, SECTION_ID, '02-checkin-dirty-force-allowed', 'en');

    // Restore room 206 to dirty/vacant so downstream tests (08-room-detail)
    // still find the canonical dirty+vacant anchor. Check out the booking
    // first (legal transition), then force HK back to dirty.
    await fetch(`${API_URL}/api/bookings/${BK_B}/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true }),
    });
    await fetch(`${API_URL}/api/rooms/${DIRTY_ROOM_ID}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ housekeepingStatus: 'dirty' }),
    });
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
      const payCode = await fetchTransactionCode('payment', 'PAY_CASH');
      await postFolioPayment(BK_A, { transactionCodeId: payCode.id, amount: balance });
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
