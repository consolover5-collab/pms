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
 * What is NOT wired up:
 *   - Drag-and-drop of booking bars to move to another room. Bars are plain
 *     <Link>s with no draggable attribute, no onDragStart / onDragEnd / onDrop
 *     handlers anywhere in the page. No PUT /api/bookings/:id/room endpoint
 *     exists either. Per the plan's "skip drag scenario if not trivial" guidance,
 *     scenario 04 is recorded as `not_tested` in the YAML edge_cases.
 *
 * Status: partial — 3 of 4 suggested scenarios covered; drag is genuinely not
 * implemented in the product so the 4th scenario cannot pass or fail meaningfully.
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
 *   04 — drag-move: NOT TESTED. Drag-and-drop not implemented in the product
 *        (bars are plain <Link>s, no drag handlers, no move-room API endpoint).
 *        Recorded as `not_tested` in the YAML edge_cases with the full reason.
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

      // URL should be /bookings/<bookingId>
      await page.waitForURL(new RegExp(`/bookings/${bookingId}(?:\\?|$|/)`), {
        timeout: UI_TIMEOUT,
      });
      // Detail page renders an h1 (guest name)
      await expect(page.locator('h1').first()).toBeVisible({ timeout: UI_TIMEOUT });

      await auditScreenshot(page, SECTION_ID, '03-click-bar', 'en');
    },
  );

  // ── Scenario 04: drag-move — NOT TESTED ───────────────────────────────────
  // Drag-and-drop is not implemented in the product. Booking bars are plain
  // <Link> elements (apps/web/src/app/tape-chart/page.tsx:159-193) with no
  // draggable attribute and no drag handlers. There is also no PUT move-room
  // endpoint in apps/api/src/routes/tape-chart.ts (GET-only) or bookings.ts.
  // The "not_tested" status is recorded in the YAML edge_cases per the plan's
  // explicit guidance for this scenario.
  //
  // Rather than writing a test we expect to fail, we include a contract check
  // that documents the absence of drag wiring — it reads page HTML and asserts
  // the bars have no draggable attribute. This serves as a regression guard:
  // if drag is later wired up, this test will fail and someone will re-audit
  // scenario 04 properly.
  test(
    '04-drag-move-not-implemented: booking bars have no drag wiring (audit evidence)',
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

      // If this ever becomes "true" the product has grown a drag feature and
      // scenario 04 needs a real audit.
      expect(draggable).not.toBe('true');

      // Also confirm there is no move-room endpoint registered on the API.
      // A missing endpoint returns 404, a present one would return 400/401 etc.
      // We only need ONE target here — use an arbitrary non-existent id to
      // avoid guessing at a real booking.
      const probeRes = await page.context().request.put(
        `${API_URL}/api/bookings/00000000-0000-0000-0000-000000000000/room`,
        {
          data: { roomId: '00000000-0000-0000-0000-000000000000' },
          headers: { 'content-type': 'application/json' },
        },
      );
      testInfo.attach('move-room-probe-status', {
        body: String(probeRes.status()),
        contentType: 'text/plain',
      });
      // A missing route → 404. (If someone wires up the endpoint, this flips.)
      expect(probeRes.status()).toBe(404);
    },
  );
});
