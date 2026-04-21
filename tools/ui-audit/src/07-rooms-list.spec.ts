/**
 * Section 07 — Rooms list (/rooms)
 *
 * READ-ONLY route: fully server-rendered (no client components). All 4
 * scenarios are read-only — no mutations, no extraAfterAll cleanup needed.
 *
 * Pre-flight probe (2026-04-21, 18:58Z, fresh re-probe via /api/rooms):
 *   total=54, byHkStatus={clean:39, dirty:6, inspected:2, pickup:5,
 *     out_of_order:1, out_of_service:1}, byOccStatus={vacant:21, occupied:33}
 *   floors: 2→14, 3→10, 4→10, 5→10, 6→6, 7→4 (6 floors total, 2..7)
 *   standardDouble roomTypeId → 24 rooms
 *
 * KNOWN DRIFT — scenario 03 adapted:
 *   Plan says "apply room-type filter → Standard Double". The UI has NO
 *   room-type filter control — only HK (4 values) and Occ (2 values) filters
 *   are exposed. The page accepts ?type=<roomTypeId> in URL and the API
 *   correctly filters server-side. We adapt scenario 03 to be URL-driven:
 *   navigate to /rooms?type=<STD_roomTypeId>, assert only matching rooms
 *   render (room cards have data-room-type-id attribute for verification).
 *   Documented in YAML edge_cases + ui.notes. UX gap flagged: API supports
 *   room-type filter, UI does not expose it.
 *
 * HK filter UI gap (spec-vs-API drift — documented, not blocking):
 *   API exposes 6 HK states (clean, dirty, inspected, pickup, out_of_order,
 *   out_of_service); the UI filter row exposes only the first 4. 2 OOO/OOS
 *   rooms in seed are only visible via All filter or on individual floors.
 *
 * i18n hole (BUG-006 candidate):
 *   The page uses fully hardcoded English labels (Rooms, Total, Vacant,
 *   Occupied, Clean, Dirty, HK:, Occ:, All, Floor N, No rooms found
 *   matching filters). No i18n-keyed dictionary lookup. RU locale shows
 *   the same English strings — same pattern as BUG-005 on section 05.
 *
 * Scenarios (all run ru+en → 8 tests total):
 *   01-list-render:       load /rooms; stats match probe (total=54,
 *                         vacant=21, occupied=33, clean=39, dirty=6);
 *                         6 floor groups render; total room cards = 54.
 *   02-filter-hk-dirty:   click HK→Dirty link; URL has ?hk=dirty;
 *                         active filter has aria-current="page";
 *                         exactly 6 room cards render.
 *   03-filter-room-type:  URL-driven — goto /rooms?type=<STD>; 24 cards
 *                         render; all have data-room-type-id=STD_ID;
 *                         URL retains ?type=<id>.
 *   04-click-navigate:    click first card; URL matches /rooms/<uuid>;
 *                         room ID matches the card href.
 */

import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
} from './shared.ts';
import { SEED } from './seed-refs.ts';

const SECTION_ID = '07-rooms-list';
const ROUTE = '/rooms';

// Probe-confirmed counts (2026-04-21)
const EXPECTED = {
  total: 54,
  vacant: 21,
  occupied: 33,
  clean: 39,
  dirty: 6,
  floors: 6, // floors 2,3,4,5,6,7
  standardDoubleCount: 24,
} as const;

const STD_DOUBLE_ID = SEED.roomType.standardDouble;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const UI_TIMEOUT = 10_000;

test.describe('07 rooms-list', () => {
  test.describe.configure({ mode: 'serial' });

  // No extraAfterAll — all scenarios are read-only.
  registerSectionHooks(SECTION_ID);

  // ── Scenario 01: list renders; stats match probe ────────────────────────────
  test('01-list-render: rooms page loads; stats match probe; 54 cards across 6 floors', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    // Heading
    await expect(page.getByTestId('rooms-heading')).toBeVisible({
      timeout: UI_TIMEOUT,
    });
    await expect(page.getByTestId('rooms-heading')).toHaveText('Rooms');

    // Stats match probe-confirmed DB state
    await expect(page.getByTestId('rooms-stat-total')).toHaveText(String(EXPECTED.total));
    await expect(page.getByTestId('rooms-stat-vacant')).toHaveText(String(EXPECTED.vacant));
    await expect(page.getByTestId('rooms-stat-occupied')).toHaveText(String(EXPECTED.occupied));
    await expect(page.getByTestId('rooms-stat-clean')).toHaveText(String(EXPECTED.clean));
    await expect(page.getByTestId('rooms-stat-dirty')).toHaveText(String(EXPECTED.dirty));

    // Floor groups — 6 floors (2..7)
    const floorGroups = page.getByTestId('rooms-floor-group');
    await expect(floorGroups.first()).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(floorGroups).toHaveCount(EXPECTED.floors);

    // Room cards — 54 total (no filter applied)
    const cards = page.getByTestId('rooms-card');
    await expect(cards.first()).toBeVisible();
    await expect(cards).toHaveCount(EXPECTED.total);

    // All filter is active by default: aria-current="page" on HK-all and Occ-all
    await expect(page.getByTestId('rooms-filter-hk-all')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByTestId('rooms-filter-occ-all')).toHaveAttribute(
      'aria-current',
      'page',
    );

    testInfo.attach('counts', {
      body: JSON.stringify({
        total: await cards.count(),
        floors: await floorGroups.count(),
      }),
      contentType: 'application/json',
    });

    await auditScreenshot(page, SECTION_ID, '01-list-render', locale);
  });

  // ── Scenario 02: HK filter → Dirty ─────────────────────────────────────────
  test('02-filter-hk-dirty: click HK→Dirty; URL ?hk=dirty; active has aria-current; 6 cards', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    // Before filtering: confirm baseline card count
    const cardsBefore = page.getByTestId('rooms-card');
    await expect(cardsBefore.first()).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(cardsBefore).toHaveCount(EXPECTED.total);

    // Click HK → Dirty filter link
    const dirtyLink = page.getByTestId('rooms-filter-hk-dirty');
    await expect(dirtyLink).toBeVisible();
    await dirtyLink.click();

    // Wait for navigation
    await page.waitForURL('**/rooms?hk=dirty', { timeout: UI_TIMEOUT });
    expect(page.url()).toContain('?hk=dirty');

    // Active filter now has aria-current="page"
    await expect(page.getByTestId('rooms-filter-hk-dirty')).toHaveAttribute(
      'aria-current',
      'page',
    );
    // Previously-active HK-all no longer has aria-current
    await expect(page.getByTestId('rooms-filter-hk-all')).not.toHaveAttribute(
      'aria-current',
      'page',
    );

    // Stats are computed from allRooms (not filtered) — still 54 total, 6 dirty
    await expect(page.getByTestId('rooms-stat-total')).toHaveText(String(EXPECTED.total));
    await expect(page.getByTestId('rooms-stat-dirty')).toHaveText(String(EXPECTED.dirty));

    // Filtered card count matches dirty=6
    const filteredCards = page.getByTestId('rooms-card');
    await expect(filteredCards.first()).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(filteredCards).toHaveCount(EXPECTED.dirty);

    testInfo.attach('filtered-url', {
      body: page.url(),
      contentType: 'text/plain',
    });
    testInfo.attach('filtered-count', {
      body: String(await filteredCards.count()),
      contentType: 'text/plain',
    });

    await auditScreenshot(page, SECTION_ID, '02-filter-hk-dirty', locale);
  });

  // ── Scenario 03: URL-driven room-type filter (PLAN DRIFT) ───────────────────
  // Plan spec asked for UI room-type filter, but the UI has no such control.
  // The API/page does accept ?type=<id> query param — we drive it via URL.
  // See header comment for drift rationale.
  test('03-filter-room-type: goto ?type=<STD>; 24 cards; all have room-type-id=STD', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    const typeFilterPath = `${ROUTE}?type=${STD_DOUBLE_ID}`;
    await setLocaleAndGoto(page, locale, typeFilterPath);

    // URL retains the type query param
    expect(page.url()).toContain(`?type=${STD_DOUBLE_ID}`);

    // Card count matches probe count for Standard Double (24)
    const cards = page.getByTestId('rooms-card');
    await expect(cards.first()).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(cards).toHaveCount(EXPECTED.standardDoubleCount);

    // All rendered cards belong to the Standard Double room type — verify via
    // data-room-type-id attribute added in page.tsx for exactly this purpose.
    const cardRoomTypeIds = await cards.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-room-type-id')),
    );
    testInfo.attach('card-room-type-ids', {
      body: JSON.stringify(cardRoomTypeIds),
      contentType: 'application/json',
    });
    for (const id of cardRoomTypeIds) {
      expect(id).toBe(STD_DOUBLE_ID);
    }
    expect(cardRoomTypeIds).toHaveLength(EXPECTED.standardDoubleCount);

    // Stats remain property-wide (filter doesn't affect stats grid)
    await expect(page.getByTestId('rooms-stat-total')).toHaveText(String(EXPECTED.total));

    await auditScreenshot(page, SECTION_ID, '03-filter-room-type', locale);
  });

  // ── Scenario 04: click a room → /rooms/[id] ─────────────────────────────────
  test('04-click-navigate: click first card; URL matches /rooms/<uuid>', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    const cards = page.getByTestId('rooms-card');
    await expect(cards.first()).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(cards).toHaveCount(EXPECTED.total);

    // Extract the href of the first card to know which room ID we expect
    const firstHref = await cards.first().getAttribute('href');
    testInfo.attach('first-card-href', {
      body: firstHref ?? '(null)',
      contentType: 'text/plain',
    });
    expect(firstHref).toMatch(/^\/rooms\/[0-9a-f-]{36}$/);

    // Click first card
    await cards.first().click();

    // URL becomes /rooms/<uuid>
    await page.waitForURL(/\/rooms\/[0-9a-f-]{36}/, { timeout: UI_TIMEOUT });
    const url = new URL(page.url());
    const parts = url.pathname.split('/').filter(Boolean);
    expect(parts[0]).toBe('rooms');
    expect(parts[1]).toMatch(UUID_RE);
    // Destination matches the card's href exactly
    expect(`/${parts.join('/')}`).toBe(firstHref);

    testInfo.attach('final-url', {
      body: page.url(),
      contentType: 'text/plain',
    });

    await auditScreenshot(page, SECTION_ID, '04-click-navigate', locale);
  });
});
