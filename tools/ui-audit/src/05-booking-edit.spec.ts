/**
 * Section 05 — Booking edit (/bookings/[id]/edit)
 *
 * Pre-flight probe confirms (2026-04-21 18:29Z):
 *   propertyId = ff1d9135-dfb9-4baa-be46-0e739cd26dad (GBH)
 *   businessDate = 2026-04-20
 *   bookings: confirmed=103, checkedIn=33, checkedOut=74, cancelled=65, noShow=5
 *
 * Status branches in booking-edit-form.tsx:
 *   - isConfirmed → all fields editable
 *   - isCheckedIn → only checkOutDate + room + financials + notes editable
 *                   (guest / roomType / checkInDate / adults / children are locked)
 *   - isTerminal (checked_out/cancelled/no_show) → yellow banner; submit disabled
 *
 * Important: booking-edit-form is currently all-English (no i18n keys). Labels
 * are identical on ru and en — the only locale-dependent thing is the cookie
 * and the navigation chrome. Label constants below duplicate EN strings on
 * both locales by design.
 *
 * Scenarios:
 *   01-load-edit-form   — Confirmed booking; form renders; fields editable.
 *   02-edit-dates-save  — Mutation (en-only): create fresh confirmed booking;
 *                         edit checkOutDate +1 day; PUT 200; redirect to detail.
 *                         Cleanup via cleanupAuditBookings('audit-section-05').
 *   03-edit-blocked-after-checkin — Checked-in booking; locked fields are
 *                                    disabled; checkOutDate remains editable.
 *   04-validation-checkout-before-checkin — Confirmed booking; force
 *                                            checkOut = checkIn - N; dateError
 *                                            visible + submit disabled.
 */

import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
  setNativeValue,
  API_URL,
  GBH_PROPERTY_ID,
} from './shared.ts';
import {
  createConfirmedBooking,
  cleanupAuditBookings,
} from './fixtures.ts';

const SECTION_ID = '05-booking-edit';
const MARKER = 'audit-section-05';

const UI_TIMEOUT = 10_000;
const API_TIMEOUT = 15_000;

// Module-scope: the freshly-created confirmed booking (scenario 02 mutation).
let mutationBookingId: string | null = null;

// Labels — form is currently hardcoded EN; both locales see same strings.
const labels = {
  ru: {
    header: (confNumber: string) => `Редактирование брони №${confNumber}`,
    dateError: 'Дата выезда должна быть позже даты заезда',
    statusCheckedIn: 'Заселён',
  },
  en: {
    header: (confNumber: string) => `Edit Booking #${confNumber}`,
    dateError: 'Check-out date must be after check-in date',
    statusCheckedIn: 'Checked in',
  },
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

type Booking = {
  id: string;
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
};

async function fetchFirstBookingByStatus(status: string): Promise<Booking> {
  const r = await fetch(
    `${API_URL}/api/bookings?propertyId=${GBH_PROPERTY_ID}&status=${status}&limit=1`,
  );
  if (!r.ok) {
    throw new Error(`GET /api/bookings (${status}) failed: ${r.status} ${await r.text()}`);
  }
  const page = (await r.json()) as { data: Booking[] };
  if (!page.data?.length) {
    throw new Error(`No bookings with status=${status} available for property ${GBH_PROPERTY_ID}`);
  }
  return page.data[0];
}

async function fetchBookingById(id: string): Promise<Booking> {
  const r = await fetch(`${API_URL}/api/bookings/${id}`);
  if (!r.ok) {
    throw new Error(`GET /api/bookings/${id} failed: ${r.status} ${await r.text()}`);
  }
  return (await r.json()) as Booking;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Test suite ─────────────────────────────────────────────────────────────────

test.describe('05 booking-edit', () => {
  registerSectionHooks(SECTION_ID, {
    extraAfterAll: async () => {
      // Sweep cancels any confirmed bookings whose notes begin with our marker.
      await cleanupAuditBookings(MARKER);
      mutationBookingId = null;
    },
  });

  // Pre-flight: create the mutation booking so scenario 02 never touches seed data.
  test.beforeAll(async () => {
    // businessDate is 2026-04-20 per probe; use a date a few days in the future
    // so we never collide with the checked-in window and so the +1 extend always
    // stays a valid future date.
    const futureDate = '2026-05-15';
    mutationBookingId = await createConfirmedBooking({
      roomId: null,
      bizDate: futureDate,
      nights: 1,
      marker: MARKER,
    });
  });

  // ── Scenario 01: load edit form for a confirmed booking ─────────────────────
  test('01-load-edit-form: confirmed booking; editable fields visible', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    const confirmed = await fetchFirstBookingByStatus('confirmed');
    testInfo.attach('confirmed-booking', {
      body: JSON.stringify({ id: confirmed.id, confirmationNumber: confirmed.confirmationNumber }),
      contentType: 'application/json',
    });

    await setLocaleAndGoto(page, locale, `/bookings/${confirmed.id}/edit`);

    // Form renders
    const form = page.getByTestId('booking-edit-form');
    await expect(form).toBeVisible({ timeout: UI_TIMEOUT });

    // Heading visible (locale-aware — BUG-005 fix localised the title)
    await expect(
      page.getByRole('heading', { name: labels[locale].header(confirmed.confirmationNumber) }),
    ).toBeVisible();

    // Confirmation is readonly (always disabled)
    const confInput = page.getByTestId('booking-edit-confirmation');
    await expect(confInput).toBeVisible();
    await expect(confInput).toBeDisabled();
    await expect(confInput).toHaveValue(confirmed.confirmationNumber);

    // Editable-in-confirmed fields must be enabled
    await expect(page.getByTestId('booking-edit-guest')).toBeEnabled();
    await expect(page.getByTestId('booking-edit-room-type')).toBeEnabled();
    await expect(page.getByTestId('booking-edit-checkin')).toBeEnabled();
    await expect(page.getByTestId('booking-edit-checkout')).toBeEnabled();
    await expect(page.getByTestId('booking-edit-adults')).toBeEnabled();
    await expect(page.getByTestId('booking-edit-children')).toBeEnabled();
    await expect(page.getByTestId('booking-edit-notes')).toBeEnabled();

    // Submit button is visible + enabled (no dateError, no terminal status)
    const submit = page.getByTestId('booking-edit-submit');
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();

    // Cancel link
    await expect(page.getByTestId('booking-edit-cancel')).toBeVisible();

    // Terminal banner NOT shown for confirmed bookings
    await expect(page.getByTestId('booking-edit-terminal-banner')).toHaveCount(0);

    // Status-info banner NOT shown for confirmed bookings (explanation is blank)
    await expect(page.getByTestId('booking-edit-status-info')).toHaveCount(0);

    await auditScreenshot(page, SECTION_ID, '01-load-edit-form', locale);
  });

  // ── Scenario 02: edit dates → PUT 200 → redirect (en-only mutation) ─────────
  test('02-edit-dates-save: PUT /api/bookings/:id 200; redirect to detail; persists', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    if (!mutationBookingId) {
      throw new Error('mutationBookingId not set in beforeAll — cannot run scenario 02');
    }

    const before = await fetchBookingById(mutationBookingId);
    testInfo.attach('before-edit', {
      body: JSON.stringify(before),
      contentType: 'application/json',
    });
    const newCheckOut = addDays(before.checkOutDate, 1);
    testInfo.attach('new-checkout', { body: newCheckOut, contentType: 'text/plain' });

    await setLocaleAndGoto(page, 'en', `/bookings/${mutationBookingId}/edit`);

    const form = page.getByTestId('booking-edit-form');
    await expect(form).toBeVisible({ timeout: UI_TIMEOUT });

    await auditScreenshot(page, SECTION_ID, '02-edit-dates-initial', 'en');

    // Force new checkOut via the native date input setter.
    // We go through setNativeValue so we bypass any min-attr clamping.
    const checkoutInput = page.getByTestId('booking-edit-checkout');
    await expect(checkoutInput).toBeEnabled();
    await setNativeValue(page, '[data-testid="booking-edit-checkout"]', newCheckOut);

    // Sanity: submit button must be enabled after valid date change
    const submit = page.getByTestId('booking-edit-submit');
    await expect(submit).toBeEnabled();

    // Intercept the PUT call.
    const [putResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/bookings/${mutationBookingId}`) &&
          r.request().method() === 'PUT',
        { timeout: API_TIMEOUT },
      ),
      submit.click(),
    ]);

    testInfo.attach('put-response-status', {
      body: String(putResp.status()),
      contentType: 'text/plain',
    });
    expect(putResp.status()).toBe(200);

    // After save: router.replace('/bookings/:id'); should land on detail.
    await page.waitForURL((url) => {
      const p = typeof url === 'string' ? url : url.pathname;
      return (
        p.includes(`/bookings/${mutationBookingId}`) &&
        !p.endsWith('/edit')
      );
    }, { timeout: UI_TIMEOUT });

    await page.waitForLoadState('networkidle');
    await auditScreenshot(page, SECTION_ID, '02-edit-dates-saved', 'en');

    // Re-fetch via API to confirm the value actually changed.
    const after = await fetchBookingById(mutationBookingId);
    testInfo.attach('after-edit', {
      body: JSON.stringify(after),
      contentType: 'application/json',
    });
    expect(after.checkOutDate).toBe(newCheckOut);
  });

  // ── Scenario 03: checked-in booking — locked fields + editable checkOut ─────
  test('03-edit-blocked-after-checkin: locked fields disabled; checkOut enabled; page does not redirect', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    const checkedIn = await fetchFirstBookingByStatus('checked_in');
    testInfo.attach('checked-in-booking', {
      body: JSON.stringify({ id: checkedIn.id, confirmationNumber: checkedIn.confirmationNumber }),
      contentType: 'application/json',
    });

    await setLocaleAndGoto(page, locale, `/bookings/${checkedIn.id}/edit`);

    // The page should not redirect away — form is visible
    const form = page.getByTestId('booking-edit-form');
    await expect(form).toBeVisible({ timeout: UI_TIMEOUT });

    // URL still on the edit page
    expect(page.url()).toContain(`/bookings/${checkedIn.id}/edit`);

    // Status-info banner should be visible (explanation exists for checked_in).
    // BUG-005 fix localised the status label; assert per-locale text.
    const statusBanner = page.getByTestId('booking-edit-status-info');
    await expect(statusBanner).toBeVisible();
    await expect(statusBanner).toContainText(labels[locale].statusCheckedIn);

    // Terminal banner should NOT be visible for checked_in
    await expect(page.getByTestId('booking-edit-terminal-banner')).toHaveCount(0);

    // Locked fields: guest, room-type, check-in, adults, children — all disabled.
    await expect(page.getByTestId('booking-edit-guest')).toBeDisabled();
    await expect(page.getByTestId('booking-edit-room-type')).toBeDisabled();
    await expect(page.getByTestId('booking-edit-checkin')).toBeDisabled();
    await expect(page.getByTestId('booking-edit-adults')).toBeDisabled();
    await expect(page.getByTestId('booking-edit-children')).toBeDisabled();

    // checkOut remains editable — this is the extend-stay affordance.
    await expect(page.getByTestId('booking-edit-checkout')).toBeEnabled();

    // Notes always editable
    await expect(page.getByTestId('booking-edit-notes')).toBeEnabled();

    // Submit button should be enabled (not terminal, no dateError)
    await expect(page.getByTestId('booking-edit-submit')).toBeEnabled();

    await auditScreenshot(page, SECTION_ID, '03-edit-blocked-after-checkin', locale);
    // Intentionally do NOT click submit — this scenario is observe-only.
  });

  // ── Scenario 04: checkOut ≤ checkIn → dateError visible, submit disabled ───
  test('04-validation-checkout-before-checkin: dateError shown, submit disabled', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    // Use the first available confirmed booking (read-only inspection; we never save).
    const confirmed = await fetchFirstBookingByStatus('confirmed');

    await setLocaleAndGoto(page, locale, `/bookings/${confirmed.id}/edit`);

    const form = page.getByTestId('booking-edit-form');
    await expect(form).toBeVisible({ timeout: UI_TIMEOUT });

    const checkInInput = page.getByTestId('booking-edit-checkin');
    const checkOutInput = page.getByTestId('booking-edit-checkout');
    await expect(checkInInput).toBeEnabled();
    await expect(checkOutInput).toBeEnabled();

    // Force checkIn first to a known value, then force checkOut to 1 day earlier.
    const forcedCheckIn = '2026-05-10';
    const forcedCheckOut = '2026-05-09';

    await setNativeValue(page, '[data-testid="booking-edit-checkin"]', forcedCheckIn);
    await setNativeValue(page, '[data-testid="booking-edit-checkout"]', forcedCheckOut);

    // Wait for React's useMemo to derive dateError and render the inline error.
    const errElt = page.getByTestId('booking-edit-date-error');
    await expect(errElt).toBeVisible({ timeout: 2_000 });

    await auditScreenshot(page, SECTION_ID, '04-validation-checkout-before-checkin', locale);

    // Assert the inline error has the expected copy (locale-aware — BUG-005 fix).
    await expect(errElt).toHaveText(labels[locale].dateError);

    // Submit button must be disabled because dateError is truthy.
    const submit = page.getByTestId('booking-edit-submit');
    await expect(submit).toBeDisabled();
  });
});
