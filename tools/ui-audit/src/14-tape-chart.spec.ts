/**
 * Section 14 — Tape chart (/tape-chart)
 *
 * Reservation timeline UI. On mount, the page fetches /api/properties and then
 * /api/tape-chart?propertyId=…&from=…&to=… to obtain a 2-D view: rooms × dates
 * with booking bars spanning checkInDate..checkOutDate.
 *
 * What's wired up (audited by manual probe + source review 2026-04-22):
 *   - Period toggle buttons 14/30/90 days (the page does NOT support week/month/day
 *     modes — the plan's suggestion "week/month/day" was stale).
 *   - Prev / Today / Next shift buttons: shift the window by ±range days.
 *   - "New booking" link → /bookings/new.
 *   - Each booking bar is a plain <Link href="/bookings/:id"> — click navigates
 *     to the booking detail page.
 *   - Room-type group headers are collapsible (click toggles openGroups[code]).
 *   - Unassigned-bookings card lists rows without roomId as link-badges.
 *
 * What is NOT wired up in the UI:
 *   - Drag-and-drop of booking bars to move to another room. Bars are <Link>
 *     elements without a `draggable` attr — no HTML5 drag wiring in the UI,
 *     no onDragStart / onDragEnd / onDrop handlers anywhere in the page.
 *
 * Backend reality check (important — prior spec comments were wrong):
 *   - The API endpoint `POST /api/bookings/:id/room-move` DOES exist
 *     (apps/api/src/routes/bookings.ts:886) with full validation,
 *     transactional double-room locking, and a structured error envelope
 *     ({ error, code: 'BOOKING_NOT_FOUND' | 'ROOM_NOT_FOUND' | ... }).
 *     Integration coverage lives at apps/api/src/routes/integration.test.ts:207.
 *   - The tape chart itself does not invoke it. The booking-detail page
 *     (section 04) already wires a "Change Room" action to this endpoint
 *     (apps/web/src/app/bookings/[id]/booking-actions.tsx, gated on
 *     checked-in status), but that surface is out of scope for section 14.
 *
 * Scenario 04 is therefore a two-part regression tripwire:
 *   (a) DOM: assert bars have `draggable !== 'true'` — fires if someone wires
 *       drag-to-move into the UI without an audit pass.
 *   (b) API: probe `POST /api/bookings/<random-uuid>/room-move` with
 *       `{ newRoomId: <zero-uuid> }` and assert `status === 404` AND body
 *       `code === 'BOOKING_NOT_FOUND'` — fires if the backend endpoint is
 *       ever removed (404 with a different or absent `code` field would flag
 *       the regression and force a re-audit of how the UI should expose
 *       room-move going forward).
 *
 * Status: partial — 3 of 4 suggested scenarios covered end-to-end; scenario 04
 * is a contract/tripwire assertion rather than a full drag simulation because
 * the UI genuinely does not implement drag.
 *
 * Scenarios:
 *   01 — render-timeline (ru + en): page renders; timeline grid visible with
 *        rooms on Y-axis and dates on X-axis; >=1 booking bar visible (preflight
 *        confirmed plenty of confirmed + checked_in bookings in the 14-day
 *        window from 2026-04-20 businessDate).
 *   02 — switch-period (ru + en): click 30-days period toggle; subtitle days
 *        count updates to 30; grid re-renders with 30 day columns.
 *   03 — click-bar (en-only — mutation-free navigation but only needs one): click
 *        the first visible booking bar; URL navigates to /bookings/:id and
 *        booking detail h1 renders.
 *   04 — drag-move-absent-but-api-exists (en-only): assert the UI has no drag
 *        wiring AND the backend endpoint still responds with its documented
 *        404 envelope — a dual tripwire that fires if either side drifts.
 */

import { test, expect } from '@playwright/test';
import {
  API_URL,
  GBH_PROPERTY_ID,
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
} from './shared.ts';

const SECTION_ID = '14-tape-chart';
const ROUTE = '/tape-chart';

const UI_TIMEOUT = 10_000;

test.describe('14 tape-chart', () => {
  test.describe.configure({ mode: 'serial' });

  // No mutations → no extraAfterAll needed.
  registerSectionHooks(SECTION_ID);

  // ── Scenario 01: render-timeline (ru + en) ────────────────────────────────
  test(
    '01-render-timeline: header, legend, timeline grid, and >=1 booking bar visible',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await setLocaleAndGoto(page, locale, ROUTE);

      // Header
      const title = page.getByTestId('tape-chart-title');
      await expect(title).toBeVisible({ timeout: UI_TIMEOUT });
      if (locale === 'en') {
        await expect(title).toHaveText('Tape Chart');
      } else {
        await expect(title).toHaveText('Шахматка');
      }

      // Subtitle with from-to range, days count, rooms count
      const subtitle = page.getByTestId('tape-chart-subtitle');
      await expect(subtitle).toBeVisible({ timeout: UI_TIMEOUT });
      // Default range is 14 days
      if (locale === 'en') {
        await expect(subtitle).toContainText('14 days');
      } else {
        await expect(subtitle).toContainText('14 дней');
      }

      // Period toggle buttons
      await expect(page.getByTestId('tape-chart-period-14-button')).toBeVisible();
      await expect(page.getByTestId('tape-chart-period-30-button')).toBeVisible();
      await expect(page.getByTestId('tape-chart-period-90-button')).toBeVisible();
      // 14 is default → has data-active="true"
      await expect(page.getByTestId('tape-chart-period-14-button')).toHaveAttribute(
        'data-active',
        'true',
      );

      // Shift buttons + new booking link
      await expect(page.getByTestId('tape-chart-prev-button')).toBeVisible();
      await expect(page.getByTestId('tape-chart-today-button')).toBeVisible();
      await expect(page.getByTestId('tape-chart-next-button')).toBeVisible();
      await expect(page.getByTestId('tape-chart-new-booking-link')).toBeVisible();

      // Legend visible (5 status swatches)
      await expect(page.getByTestId('tape-chart-legend')).toBeVisible();

      // Grid visible
      await expect(page.getByTestId('tape-chart-grid')).toBeVisible({ timeout: UI_TIMEOUT });

      // At least one room group rendered (GBH has room types)
      const groups = page.getByTestId('tape-chart-group');
      const groupCount = await groups.count();
      testInfo.attach('group-count', { body: String(groupCount), contentType: 'text/plain' });
      expect(groupCount).toBeGreaterThanOrEqual(1);

      // At least one room row rendered
      const rows = page.getByTestId('tape-chart-room-row');
      const rowCount = await rows.count();
      testInfo.attach('room-row-count', { body: String(rowCount), contentType: 'text/plain' });
      expect(rowCount).toBeGreaterThanOrEqual(1);

      // At least one booking bar visible in the default 14-day window
      // (preflight: 33 checked_in + 103 confirmed bookings, businessDate=2026-04-20)
      const bars = page.getByTestId('tape-chart-bar');
      const barCount = await bars.count();
      testInfo.attach('booking-bar-count', { body: String(barCount), contentType: 'text/plain' });
      expect(barCount).toBeGreaterThanOrEqual(1);

      await auditScreenshot(page, SECTION_ID, '01-render-timeline', locale);
    },
  );

  // ── Scenario 02: switch-period (ru + en) ──────────────────────────────────
  test(
    '02-switch-period: clicking 30-days toggle updates subtitle + re-renders grid',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await setLocaleAndGoto(page, locale, ROUTE);

      // Default 14 days
      const subtitle = page.getByTestId('tape-chart-subtitle');
      await expect(subtitle).toBeVisible({ timeout: UI_TIMEOUT });
      if (locale === 'en') {
        await expect(subtitle).toContainText('14 days');
      } else {
        await expect(subtitle).toContainText('14 дней');
      }

      // Track the /api/tape-chart call fired by the period change
      const apiResponse = page.waitForResponse(
        (res) =>
          res.url().includes('/api/tape-chart?') &&
          res.url().includes('propertyId=') &&
          res.status() === 200,
      );

      // Click the 30-days button
      const period30 = page.getByTestId('tape-chart-period-30-button');
      await expect(period30).toBeVisible();
      await period30.click();

      // Button's data-active flips to true
      await expect(period30).toHaveAttribute('data-active', 'true');

      // API call fires with updated range
      const res = await apiResponse;
      const url = new URL(res.url());
      const fromParam = url.searchParams.get('from');
      const toParam = url.searchParams.get('to');
      expect(fromParam).toBeTruthy();
      expect(toParam).toBeTruthy();
      // 30-day window: to - from ≈ 30 days
      const fromDate = new Date(fromParam!);
      const toDate = new Date(toParam!);
      const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
      testInfo.attach('range-days', { body: String(diffDays), contentType: 'text/plain' });
      expect(diffDays).toBe(30);

      // Subtitle reflects 30 days
      if (locale === 'en') {
        await expect(subtitle).toContainText('30 days', { timeout: UI_TIMEOUT });
      } else {
        await expect(subtitle).toContainText('30 дней', { timeout: UI_TIMEOUT });
      }

      // Grid still visible, still has >=1 bar (30-day window is superset of 14)
      await expect(page.getByTestId('tape-chart-grid')).toBeVisible();
      const bars = page.getByTestId('tape-chart-bar');
      expect(await bars.count()).toBeGreaterThanOrEqual(1);

      await auditScreenshot(page, SECTION_ID, '02-switch-period', locale);
    },
  );

  // ── Scenario 03: click-bar navigation (en-only) ───────────────────────────
  test(
    '03-click-bar: clicking a booking bar navigates to /bookings/:id',
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'en', 'Navigation check runs once');

      await setLocaleAndGoto(page, 'en', ROUTE);
      await expect(page.getByTestId('tape-chart-grid')).toBeVisible({ timeout: UI_TIMEOUT });

      const bars = page.getByTestId('tape-chart-bar');
      const barCount = await bars.count();
      expect(barCount).toBeGreaterThanOrEqual(1);

      const firstBar = bars.first();
      // Capture the booking id from the data attribute — used to assert URL
      const bookingId = await firstBar.getAttribute('data-booking-id');
      expect(bookingId).toBeTruthy();
      testInfo.attach('clicked-booking-id', {
        body: String(bookingId),
        contentType: 'text/plain',
      });

      await firstBar.click();

      // URL should be /bookings/<bookingId> (end-of-path or querystring only)
      await page.waitForURL(new RegExp(`/bookings/${bookingId}(?:$|\\?)`), {
        timeout: UI_TIMEOUT,
      });
      // Detail page renders an h1 (guest name)
      await expect(page.locator('h1').first()).toBeVisible({ timeout: UI_TIMEOUT });

      await auditScreenshot(page, SECTION_ID, '03-click-bar', 'en');
    },
  );

  // ── Scenario 04: drag-move-absent-but-api-exists (tripwire) ───────────────
  // Two-part regression tripwire (see header comment for full rationale):
  //   (a) DOM — booking bars have no HTML5 drag wiring (no `draggable="true"`).
  //   (b) API — the real endpoint POST /api/bookings/:id/room-move still
  //       exists and still responds with its documented 404 envelope
  //       `{ code: "BOOKING_NOT_FOUND" }` for an unknown UUID. This is the
  //       endpoint registered at apps/api/src/routes/bookings.ts:886.
  // If either invariant breaks (UI grows drag wiring; backend endpoint is
  // removed or its error envelope changes), scenario 04 fails and someone
  // must re-audit how room-move should be exposed (or recover the backend).
  test(
    '04-drag-move-absent-but-api-exists: no UI drag wiring, backend endpoint still present',
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'en', 'Contract evidence runs once');

      await setLocaleAndGoto(page, 'en', ROUTE);
      await expect(page.getByTestId('tape-chart-grid')).toBeVisible({ timeout: UI_TIMEOUT });

      const bars = page.getByTestId('tape-chart-bar');
      expect(await bars.count()).toBeGreaterThanOrEqual(1);

      const firstBar = bars.first();
      const draggable = await firstBar.getAttribute('draggable');
      testInfo.attach('bar-draggable-attr', {
        body: String(draggable),
        contentType: 'text/plain',
      });

      // (a) If this ever becomes "true" the product has grown a drag feature
      // and scenario 04 needs a real end-to-end audit.
      expect(draggable).not.toBe('true');

      // (b) Probe the real POST /api/bookings/:id/room-move route with a
      // random non-existent booking id. The route MUST respond 404 with
      // `code: 'BOOKING_NOT_FOUND'` — this distinguishes "route exists,
      // booking missing" from "route was removed" (which would yield a
      // different status, a bare 404 with no envelope, or a different code).
      const probeRes = await page.context().request.post(
        `${API_URL}/api/bookings/${crypto.randomUUID()}/room-move`,
        {
          data: { newRoomId: '00000000-0000-0000-0000-000000000000' },
          headers: { 'content-type': 'application/json' },
        },
      );
      testInfo.attach('move-room-probe-status', {
        body: String(probeRes.status()),
        contentType: 'text/plain',
      });
      expect(probeRes.status()).toBe(404);

      const probeBody = (await probeRes.json().catch(() => null)) as
        | { code?: string; error?: string }
        | null;
      testInfo.attach('move-room-probe-body', {
        body: JSON.stringify(probeBody),
        contentType: 'application/json',
      });
      expect(probeBody?.code).toBe('BOOKING_NOT_FOUND');
    },
  );
});
