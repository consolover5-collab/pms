import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
  API_URL,
  GBH_PROPERTY_ID,
} from './shared.ts';

const SECTION_ID = '04-booking-detail';

const labels = {
  ru: {
    backToBookings: 'К бронированиям',
    editBooking: 'Edit Booking',
    statusConfirmed: 'Подтверждено',
    statusCancelled: 'Отменено',
    dueIn: 'К заезду',
    checkIn: 'Check In',
    cancelBooking: 'Отменить бронь',
    reinstate: 'Восстановить',
    tabFolio: 'Финансы',
    totalBooking: 'Итого по брони',
  },
  en: {
    backToBookings: 'Back to bookings',
    editBooking: 'Edit Booking',
    statusConfirmed: 'Confirmed',
    statusCancelled: 'Cancelled',
    dueIn: 'Due in',
    checkIn: 'Check In',
    cancelBooking: 'Cancel Booking',
    reinstate: 'Reinstate',
    tabFolio: 'Folio',
    totalBooking: 'Booking total',
  },
} as const;

let BOOKING_ID = '';

async function getBookingStatus(id: string): Promise<string> {
  const r = await fetch(`${API_URL}/api/bookings/${id}`);
  const b = (await r.json()) as { status: string };
  return b.status;
}

test.describe('04 booking-detail', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    if (!BOOKING_ID) {
      const res = await fetch(
        `${API_URL}/api/bookings?propertyId=${GBH_PROPERTY_ID}&status=confirmed&limit=1`,
      );
      const payload = (await res.json()) as { data: { id: string }[] };
      if (!payload.data.length) {
        throw new Error('No confirmed bookings available for section 04 audit');
      }
      BOOKING_ID = payload.data[0].id;
    }
  });

  registerSectionHooks(SECTION_ID, {
    extraAfterAll: async () => {
      const status = await getBookingStatus(BOOKING_ID);
      if (status !== 'confirmed') {
        await fetch(`${API_URL}/api/bookings/${BOOKING_ID}/reinstate`, { method: 'POST' });
      }
    },
  });

  test('summary-tab-happy: header, status badge, confirmation number visible', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    const L = labels[locale];

    await setLocaleAndGoto(page, locale, `/bookings/${BOOKING_ID}`);
    await page.waitForSelector('h1');

    // Guest name heading (h1) visible
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    const name = (await h1.textContent())?.trim() ?? '';
    testInfo.attach('guest-name', { body: name, contentType: 'text/plain' });
    expect(name.length).toBeGreaterThan(0);

    // Status badge visible (confirmed or dueIn variant for today's check-in)
    const badge = page.locator('.badge').first();
    await expect(badge).toBeVisible();
    const badgeText = (await badge.textContent())?.trim() ?? '';
    testInfo.attach('status-badge-text', { body: badgeText, contentType: 'text/plain' });
    expect(
      badgeText.includes(L.statusConfirmed) || badgeText.includes(L.dueIn),
    ).toBeTruthy();

    // Confirmation number visible (tnum GBH-XXXXXX)
    await expect(page.locator('.tnum').first()).toBeVisible();

    // Back link visible
    await expect(page.getByText(L.backToBookings).first()).toBeVisible();

    await auditScreenshot(page, SECTION_ID, '01-summary-tab-happy', locale);
  });

  test('folio-visible: folio section renders with window headers', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    const L = labels[locale];

    await setLocaleAndGoto(page, locale, `/bookings/${BOOKING_ID}`);
    await page.waitForSelector('h1');

    // Tab bar shows Folio tab (default selected)
    const folioTab = page.locator('.tb', { hasText: L.tabFolio }).first();
    await expect(folioTab).toBeVisible();
    await expect(folioTab).toHaveClass(/on/);

    // Folio windows rendered (at least one .folio-win with header)
    await page.waitForSelector('.folio-win', { timeout: 10_000 });
    const winCount = await page.locator('.folio-win').count();
    testInfo.attach('folio-window-count', {
      body: String(winCount),
      contentType: 'text/plain',
    });
    expect(winCount).toBeGreaterThan(0);

    // Booking total card is present
    await expect(page.getByText(L.totalBooking).first()).toBeVisible();

    await auditScreenshot(page, SECTION_ID, '02-folio-visible', locale);
  });

  test('action-cancel: en-only — prompt accepts reason, status becomes cancelled', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');
    const L = labels.en;

    await setLocaleAndGoto(page, 'en', `/bookings/${BOOKING_ID}`);
    await page.waitForSelector('h1');

    page.once('dialog', async (d) => {
      expect(d.type()).toBe('prompt');
      await d.accept('audit-cancel-reason');
    });

    const cancelBtn = page.getByRole('button', { name: L.cancelBooking });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Wait for status badge to reflect Cancelled
    await expect(page.locator('.badge.cancelled').first()).toBeVisible({ timeout: 15_000 });

    const apiStatus = await getBookingStatus(BOOKING_ID);
    testInfo.attach('api-status-after-cancel', {
      body: apiStatus,
      contentType: 'text/plain',
    });
    expect(apiStatus).toBe('cancelled');

    await auditScreenshot(page, SECTION_ID, '03-action-cancel', 'en');

    // FEAT-011 observation: where did the cancellation reason end up?
    // Per backlog: written to bookings.notes. Re-fetch and inspect.
    const res = await fetch(`${API_URL}/api/bookings/${BOOKING_ID}`);
    const body = (await res.json()) as { notes: string | null };
    testInfo.attach('cancel-reason-location', {
      body: `notes="${body.notes ?? ''}"`,
      contentType: 'text/plain',
    });
  });

  test('action-reinstate: en-only — confirm dialog, status flips back to confirmed', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');
    const L = labels.en;

    // Precondition from prior test: status=cancelled
    const preStatus = await getBookingStatus(BOOKING_ID);
    expect(preStatus).toBe('cancelled');

    await setLocaleAndGoto(page, 'en', `/bookings/${BOOKING_ID}`);
    await page.waitForSelector('h1');

    page.once('dialog', async (d) => {
      expect(d.type()).toBe('confirm');
      await d.accept();
    });

    const reinstateBtn = page.getByRole('button', { name: L.reinstate });
    await expect(reinstateBtn).toBeVisible();
    await reinstateBtn.click();

    // Wait until the status badge no longer carries .cancelled
    await expect(page.locator('.badge.cancelled')).toHaveCount(0, { timeout: 15_000 });

    const apiStatus = await getBookingStatus(BOOKING_ID);
    testInfo.attach('api-status-after-reinstate', {
      body: apiStatus,
      contentType: 'text/plain',
    });
    expect(apiStatus).toBe('confirmed');

    await auditScreenshot(page, SECTION_ID, '04-action-reinstate', 'en');
  });

  test('action-checkin-gated: en-only — check-in button visibility depends on state', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');
    const L = labels.en;

    // Precondition: status=confirmed (restored by prior reinstate test)
    const preStatus = await getBookingStatus(BOOKING_ID);
    expect(preStatus).toBe('confirmed');

    await setLocaleAndGoto(page, 'en', `/bookings/${BOOKING_ID}`);
    await page.waitForSelector('h1');

    // The check-in gate depends on checkInDate vs today (client-side ISO).
    // If checkInDate <= today → Check In button visible (canCheckIn).
    // If checkInDate > today → informational span "Check-in available on …" visible.
    // We observe which branch we hit without clicking the success path (room may be ready).
    const checkInBtn = page.getByRole('button', { name: L.checkIn });
    const availableSpan = page.getByText(/Check-in available on/).first();

    const btnVisible = await checkInBtn.isVisible().catch(() => false);
    const spanVisible = await availableSpan.isVisible().catch(() => false);
    testInfo.attach('checkin-gate-state', {
      body: `button=${btnVisible} span=${spanVisible}`,
      contentType: 'text/plain',
    });

    // Exactly one of the two branches must render for a confirmed booking.
    expect(btnVisible || spanVisible).toBeTruthy();

    await auditScreenshot(page, SECTION_ID, '05-action-checkin-gated', 'en');

    // Do NOT click the Check-In button: room 508 is clean/vacant so the POST
    // would actually check the guest in and leave shared seed mutated mid-run.
    // The goal is to assert the gate exists for canCheckIn bookings, not exercise it.
  });
});
