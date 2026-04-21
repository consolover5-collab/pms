/**
 * Section 08 — Room detail (/rooms/[id])
 *
 * Scenarios (4):
 *   01-load-detail       — read-only (ru+en). Load detail for a clean+vacant
 *                          room; verify detail renders; HK status visible;
 *                          no current-guest banner; OOO banner absent.
 *   02-hk-transition     — MUTATION, en-only. Pick a dirty vacant room,
 *                          click Clean → assert hk=clean + Inspected button;
 *                          click Inspected → assert hk=inspected.
 *                          Cleanup: restore to dirty.
 *   03-set-ooo           — MUTATION, en-only. On a clean vacant room, open
 *                          OOO form, fill dates 2027-01-01/03, return=dirty,
 *                          submit. Assert OOO banner + restore button visible.
 *   04-restore-from-ooo  — MUTATION, en-only. Depends on 03 leaving the room
 *                          in OOO. Click "Return to Dirty"; assert room is
 *                          back to normal HK state; OOO banner gone.
 *
 * CRITICAL DRIFT (noted in task prompt):
 *   - API endpoint: POST /api/rooms/:id/status (not PUT). Single endpoint
 *     handles both HK transitions and OOO set/clear. API auto-clears oooFrom/
 *     oooTo/returnStatus when housekeepingStatus transitions to a non-OOO
 *     value — so "restore from OOO" in scenario 04 is just a HK-status POST.
 *   - HK state machine is gated: dirty→clean|pickup, clean→inspected|dirty,
 *     inspected→dirty. Our scenario 02 path is Dirty → Clean → Inspected
 *     (2 legal transitions).
 *   - OOO requires vacant room + no active bookings in [from, to]. We use
 *     2027-01-01..03 to ensure zero booking conflicts.
 *
 * Cleanup strategy:
 *   - Capture each room's original HK status in beforeAll (via GET /rooms/:id).
 *   - In extraAfterAll, for each mutated room POST the original HK status;
 *     API auto-clears OOO dates on non-OOO transitions. This leaves the DB
 *     in the same state we found it.
 *
 * Testids added (see room-detail-* prefix per Batch B retro):
 *   - page.tsx:             room-detail-number, room-detail-hk-badge,
 *                           room-detail-occ-badge, room-detail-current-guest-card
 *   - room-status-actions:  room-detail-hk-action-<status>, room-detail-set-ooo,
 *                           room-detail-ooo-form, room-detail-ooo-from/to/return-status,
 *                           room-detail-ooo-submit/cancel, room-detail-ooo-banner,
 *                           room-detail-ooo-restore, room-detail-ooo-period,
 *                           room-detail-occupied-warning
 */

import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
  API_URL,
  GBH_PROPERTY_ID,
} from './shared.ts';

const SECTION_ID = '08-room-detail';

// OOO dates far in the future — zero conflict with any seeded booking
const OOO_FROM = '2027-01-01';
const OOO_TO = '2027-01-03';
const OOO_RETURN = 'dirty';

const API_TIMEOUT = 15_000;
const UI_TIMEOUT = 10_000;

type Room = {
  id: string;
  roomNumber: string;
  housekeepingStatus: string;
  occupancyStatus: string;
  oooFromDate: string | null;
  oooToDate: string | null;
  returnStatus: string | null;
};

// Track mutated rooms and their original HK status for cleanup.
const originalStates: Record<string, string> = {};

async function fetchRoom(id: string): Promise<Room> {
  const r = await fetch(`${API_URL}/api/rooms/${id}`);
  if (!r.ok) throw new Error(`GET /api/rooms/${id} failed: ${r.status}`);
  return (await r.json()) as Room;
}

async function findFirstByStatus(
  hk: string,
  occ: 'vacant' | 'occupied' = 'vacant',
): Promise<Room> {
  const r = await fetch(
    `${API_URL}/api/rooms?propertyId=${GBH_PROPERTY_ID}&housekeepingStatus=${hk}&occupancyStatus=${occ}`,
  );
  if (!r.ok) throw new Error(`GET /api/rooms failed: ${r.status}`);
  const rooms = (await r.json()) as Room[];
  if (rooms.length === 0) {
    throw new Error(`No ${hk}+${occ} rooms available (probe matrix drift)`);
  }
  return rooms[0];
}

async function restoreRoom(id: string, targetHk: string): Promise<void> {
  // Check current state first — the HK state machine rejects self-transitions
  // (e.g. dirty→dirty is 400). Skip the POST if already at the target.
  // POST /status with any non-OOO hk clears oooFromDate/oooToDate/returnStatus
  // automatically (see rooms.ts:213-217).
  const current = await fetchRoom(id);
  if (current.housekeepingStatus === targetHk && current.oooFromDate === null) {
    return;
  }
  const r = await fetch(`${API_URL}/api/rooms/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ housekeepingStatus: targetHk }),
  });
  if (!r.ok) {
    // eslint-disable-next-line no-console
    console.warn(
      `[08-restoreRoom] room=${id} target=${targetHk} current=${current.housekeepingStatus} status=${r.status}`,
    );
  }
}

// Rooms selected at beforeAll time — scenario-scoped.
let cleanRoomForLoad: Room | null = null; // scenario 01 (read-only)
let dirtyRoomForHk: Room | null = null;   // scenario 02 (will be mutated)
let cleanRoomForOoo: Room | null = null;  // scenarios 03+04 (shared, mutated)

test.describe('08 room-detail', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID, {
    extraAfterAll: async () => {
      // Restore each mutated room to its original HK status. API auto-clears
      // OOO dates when transitioning to a non-OOO status.
      for (const [roomId, originalHk] of Object.entries(originalStates)) {
        await restoreRoom(roomId, originalHk);
      }
    },
  });

  // Pre-flight — pick concrete rooms for each scenario.
  test.beforeAll(async () => {
    cleanRoomForLoad = await findFirstByStatus('clean', 'vacant');
    dirtyRoomForHk = await findFirstByStatus('dirty', 'vacant');

    // Second distinct clean room for OOO scenarios. If only one clean room
    // exists (unlikely — probe shows 16), we'd have a collision; guard against
    // picking the same one by filtering out cleanRoomForLoad.id.
    const r = await fetch(
      `${API_URL}/api/rooms?propertyId=${GBH_PROPERTY_ID}&housekeepingStatus=clean&occupancyStatus=vacant`,
    );
    const all = (await r.json()) as Room[];
    const alt = all.find((room) => room.id !== cleanRoomForLoad!.id);
    if (!alt) throw new Error('[08-preflight] No second clean+vacant room available');
    cleanRoomForOoo = alt;

    // Record original HK for every room we intend to mutate.
    originalStates[dirtyRoomForHk.id] = dirtyRoomForHk.housekeepingStatus; // 'dirty'
    originalStates[cleanRoomForOoo.id] = cleanRoomForOoo.housekeepingStatus; // 'clean'
  });

  // ── Scenario 01: load detail (read-only, ru+en) ─────────────────────────────
  test('01-load-detail: clean+vacant room detail renders; HK+occ badges visible; no guest card', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    if (!cleanRoomForLoad) throw new Error('cleanRoomForLoad not selected');

    await setLocaleAndGoto(page, locale, `/rooms/${cleanRoomForLoad.id}`);

    // Room number heading
    const numberH1 = page.getByTestId('room-detail-number');
    await expect(numberH1).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(numberH1).toHaveText(`#${cleanRoomForLoad.roomNumber}`);

    // HK badge present, reflects 'clean' via data-hk-status
    const hkBadge = page.getByTestId('room-detail-hk-badge');
    await expect(hkBadge).toBeVisible();
    await expect(hkBadge).toHaveAttribute('data-hk-status', 'clean');

    // Occupancy badge present, reflects 'vacant'
    const occBadge = page.getByTestId('room-detail-occ-badge');
    await expect(occBadge).toBeVisible();
    await expect(occBadge).toHaveAttribute('data-occ-status', 'vacant');

    // No current-guest card (room is vacant)
    await expect(page.getByTestId('room-detail-current-guest-card')).toHaveCount(0);

    // No OOO banner (room is clean, not OOO/OOS)
    await expect(page.getByTestId('room-detail-ooo-banner')).toHaveCount(0);

    // "Set OOO" button visible (room is vacant + not occupied, so OOO path is open)
    await expect(page.getByTestId('room-detail-set-ooo')).toBeVisible({ timeout: UI_TIMEOUT });

    // No occupied-warning banner when vacant
    await expect(page.getByTestId('room-detail-occupied-warning')).toHaveCount(0);

    testInfo.attach('room-id', { body: cleanRoomForLoad.id, contentType: 'text/plain' });
    testInfo.attach('room-number', { body: cleanRoomForLoad.roomNumber, contentType: 'text/plain' });

    await auditScreenshot(page, SECTION_ID, '01-load-detail', locale);
  });

  // ── Scenario 02: HK transition (mutation, en-only) ──────────────────────────
  // Dirty → Clean → Inspected. 2 API calls, each POST /status returns 200.
  test('02-hk-transition: Dirty→Clean→Inspected; each POST 200; UI reflects state', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');
    if (!dirtyRoomForHk) throw new Error('dirtyRoomForHk not selected');

    await setLocaleAndGoto(page, 'en', `/rooms/${dirtyRoomForHk.id}`);

    // Before: hk-badge should reflect 'dirty'
    const hkBadge = page.getByTestId('room-detail-hk-badge');
    await expect(hkBadge).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(hkBadge).toHaveAttribute('data-hk-status', 'dirty');

    // Click "Clean" button (Dirty → Clean transition)
    const cleanBtn = page.getByTestId('room-detail-hk-action-clean');
    await expect(cleanBtn).toBeVisible();

    const [postResp1] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/rooms/${dirtyRoomForHk!.id}/status`) &&
          r.request().method() === 'POST',
        { timeout: API_TIMEOUT },
      ),
      cleanBtn.click(),
    ]);
    testInfo.attach('post-1-status', {
      body: String(postResp1.status()),
      contentType: 'text/plain',
    });
    expect(postResp1.status()).toBe(200);

    // Wait for router.refresh() to re-render the server component with new hk
    await expect(hkBadge).toHaveAttribute('data-hk-status', 'clean', {
      timeout: UI_TIMEOUT,
    });

    await auditScreenshot(page, SECTION_ID, '02-hk-transition-clean', 'en');

    // After Clean, "Inspected" button should be available (clean → inspected legal)
    const inspectedBtn = page.getByTestId('room-detail-hk-action-inspected');
    await expect(inspectedBtn).toBeVisible({ timeout: UI_TIMEOUT });

    // Click Inspected (Clean → Inspected transition)
    const [postResp2] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/rooms/${dirtyRoomForHk!.id}/status`) &&
          r.request().method() === 'POST',
        { timeout: API_TIMEOUT },
      ),
      inspectedBtn.click(),
    ]);
    testInfo.attach('post-2-status', {
      body: String(postResp2.status()),
      contentType: 'text/plain',
    });
    expect(postResp2.status()).toBe(200);

    // Final state: hk=inspected
    await expect(hkBadge).toHaveAttribute('data-hk-status', 'inspected', {
      timeout: UI_TIMEOUT,
    });

    await auditScreenshot(page, SECTION_ID, '02-hk-transition-inspected', 'en');
  });

  // ── Scenario 03: set OOO (mutation, en-only) ────────────────────────────────
  test('03-set-ooo: open OOO form; fill dates 2027-01-01..03; submit; banner appears', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');
    if (!cleanRoomForOoo) throw new Error('cleanRoomForOoo not selected');

    await setLocaleAndGoto(page, 'en', `/rooms/${cleanRoomForOoo.id}`);

    // Baseline: not OOO yet
    await expect(page.getByTestId('room-detail-ooo-banner')).toHaveCount(0);

    // Open OOO form
    const setOooBtn = page.getByTestId('room-detail-set-ooo');
    await expect(setOooBtn).toBeVisible({ timeout: UI_TIMEOUT });
    await setOooBtn.click();

    // Form visible with all 3 inputs
    const form = page.getByTestId('room-detail-ooo-form');
    await expect(form).toBeVisible({ timeout: UI_TIMEOUT });

    const fromInput = page.getByTestId('room-detail-ooo-from');
    const toInput = page.getByTestId('room-detail-ooo-to');
    const returnSelect = page.getByTestId('room-detail-ooo-return-status');

    await expect(fromInput).toBeVisible();
    await expect(toInput).toBeVisible();
    await expect(returnSelect).toBeVisible();

    // Fill dates and return status
    await fromInput.fill(OOO_FROM);
    await toInput.fill(OOO_TO);
    await returnSelect.selectOption(OOO_RETURN);

    // Submit & intercept POST
    const submitBtn = page.getByTestId('room-detail-ooo-submit');
    await expect(submitBtn).toBeEnabled();

    const [postResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/rooms/${cleanRoomForOoo!.id}/status`) &&
          r.request().method() === 'POST',
        { timeout: API_TIMEOUT },
      ),
      submitBtn.click(),
    ]);

    testInfo.attach('ooo-post-status', {
      body: String(postResp.status()),
      contentType: 'text/plain',
    });
    expect(postResp.status()).toBe(200);

    // OOO banner appears after server-component refresh
    const oooBanner = page.getByTestId('room-detail-ooo-banner');
    await expect(oooBanner).toBeVisible({ timeout: UI_TIMEOUT });

    // HK badge reflects out_of_order
    const hkBadge = page.getByTestId('room-detail-hk-badge');
    await expect(hkBadge).toHaveAttribute('data-hk-status', 'out_of_order');

    // Restore button ("Return to Dirty") is visible — sets up scenario 04
    await expect(page.getByTestId('room-detail-ooo-restore')).toBeVisible();

    // Period line visible with the dates we set
    const periodLine = page.getByTestId('room-detail-ooo-period');
    await expect(periodLine).toBeVisible();
    await expect(periodLine).toContainText(OOO_FROM);
    await expect(periodLine).toContainText(OOO_TO);

    await auditScreenshot(page, SECTION_ID, '03-set-ooo', 'en');
  });

  // ── Scenario 04: restore from OOO (mutation, en-only) ───────────────────────
  // Depends on scenario 03 having left cleanRoomForOoo in out_of_order.
  test('04-restore-from-ooo: click "Return to Dirty"; room goes back to normal; no OOO banner', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');
    if (!cleanRoomForOoo) throw new Error('cleanRoomForOoo not selected');

    await setLocaleAndGoto(page, 'en', `/rooms/${cleanRoomForOoo.id}`);

    // Baseline: room is OOO (set by scenario 03). If this assertion fails,
    // scenarios ran out of order or 03 didn't succeed — this is the serial
    // dependency contract.
    const hkBadge = page.getByTestId('room-detail-hk-badge');
    await expect(hkBadge).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(hkBadge).toHaveAttribute('data-hk-status', 'out_of_order');

    // Click Restore button
    const restoreBtn = page.getByTestId('room-detail-ooo-restore');
    await expect(restoreBtn).toBeVisible();

    const [postResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/rooms/${cleanRoomForOoo!.id}/status`) &&
          r.request().method() === 'POST',
        { timeout: API_TIMEOUT },
      ),
      restoreBtn.click(),
    ]);

    testInfo.attach('restore-post-status', {
      body: String(postResp.status()),
      contentType: 'text/plain',
    });
    expect(postResp.status()).toBe(200);

    // After restore: HK is back to 'dirty' (per Return to Dirty button)
    await expect(hkBadge).toHaveAttribute('data-hk-status', 'dirty', {
      timeout: UI_TIMEOUT,
    });

    // OOO banner gone
    await expect(page.getByTestId('room-detail-ooo-banner')).toHaveCount(0);

    // "Set OOO" button back (room is vacant+non-OOO again)
    await expect(page.getByTestId('room-detail-set-ooo')).toBeVisible();

    // Verify via API that oooFromDate/oooToDate/returnStatus were auto-cleared
    const finalState = await fetchRoom(cleanRoomForOoo.id);
    testInfo.attach('final-room-state', {
      body: JSON.stringify(finalState, null, 2),
      contentType: 'application/json',
    });
    expect(finalState.housekeepingStatus).toBe('dirty');
    expect(finalState.oooFromDate).toBeNull();
    expect(finalState.oooToDate).toBeNull();
    expect(finalState.returnStatus).toBeNull();

    await auditScreenshot(page, SECTION_ID, '04-restore-from-ooo', 'en');
  });
});
