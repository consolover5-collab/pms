/**
 * Section 11 — Profiles / Guests (/guests)
 *
 * Plan drifts (adaptations):
 *   - Scenario 02 "filter-type" not implementable: /guests hardcodes type=individual
 *     (apps/web/src/app/guests/page.tsx L39). No type-switcher control ships.
 *     ADAPTED to "02-search-q": debounced SearchForm (300ms) — type 'Alex' →
 *     URL becomes ?q=Alex → list filters to matching guests.
 *   - Scenario 04 "view-guest-history" not implementable: /guests/[id] detail page
 *     renders personal info grid + optional notes + created/updated footer only.
 *     No booking history section or tab exists. Marked not_applicable; gap logged
 *     in feature YAML's missing_actions. Section status = partial for this reason.
 *
 * Endpoint alignment (per plan, verified via apps/api/src/routes/profiles.ts):
 *   - POST /api/profiles → 201 (scenario 03)
 *   - PUT  /api/profiles/:id → 200 (scenario 05)
 *   - DELETE /api/profiles/:id is soft-delete (isActive=false); rejected (400)
 *     if bookings link to the profile. Scenario 03 cleanup uses DELETE on the
 *     freshly-created guest (no bookings linked).
 *
 * Scenarios:
 *   01 — list-render: 130 individuals; count in badge matches API; ru+en.
 *   02 — search-q: type 'Alex' in search; URL gains ?q=Alex; list filters. ru+en.
 *   03 — create-guest: MUTATION; /guests/new; submit; POST 201; guest appears.
 *        en-only; DELETE cleanup in extraAfterAll.
 *   04 — open-detail: opens first row; detail page shows personal info grid. ru+en.
 *        Booking-history assertion intentionally absent — feature gap.
 *   05 — edit-guest: MUTATION; edit email on sample guest; PUT 200; value persists.
 *        en-only; original email restored in extraAfterAll.
 */

import { test, expect } from '@playwright/test';
import {
  API_URL,
  GBH_PROPERTY_ID,
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
  setNativeValue,
} from './shared.ts';

const SECTION_ID = '11-profiles';
const ROUTE = '/guests';

const API_TIMEOUT = 15_000;
const UI_TIMEOUT = 10_000;

// Probe values (2026-04-21):
//   130 individuals, 10 companies, 6 travel_agents, 4 sources.
//   /guests shows only individuals (type hardcoded). Expected list total: 130.
const EXPECTED_INDIVIDUAL_TOTAL = 130;

// Sample individual for scenario 05 (edit). Captured original email restored in afterAll.
const SAMPLE_GUEST_ID = '7f170421-0f77-4e04-a973-1b1f95ecc79b'; // Alexander Fedorov

// Module-scope mutation trackers
let createdGuestId: string | null = null;
let originalSampleEmail: string | null = null;

type GuestDTO = {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
};

type ProfilesListResponse = {
  data: GuestDTO[];
  total: number;
};

async function fetchGuestsList(params: Record<string, string>): Promise<ProfilesListResponse> {
  const qs = new URLSearchParams({ propertyId: GBH_PROPERTY_ID, ...params });
  const r = await fetch(`${API_URL}/api/profiles?${qs.toString()}`);
  if (!r.ok) throw new Error(`GET /api/profiles failed: ${r.status}`);
  return r.json();
}

async function fetchGuest(id: string): Promise<GuestDTO> {
  const r = await fetch(`${API_URL}/api/profiles/${id}`);
  if (!r.ok) throw new Error(`GET /api/profiles/${id} failed: ${r.status}`);
  return r.json();
}

async function deleteGuest(id: string): Promise<number> {
  const r = await fetch(
    `${API_URL}/api/profiles/${id}?propertyId=${GBH_PROPERTY_ID}`,
    { method: 'DELETE' },
  );
  return r.status;
}

async function restoreGuestEmail(id: string, email: string | null): Promise<number> {
  const r = await fetch(`${API_URL}/api/profiles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return r.status;
}

const labels = {
  ru: {
    title: 'Гости',
    newGuestBtn: 'Новый гость',
    newTitle: 'Новый гость',
    createBtn: 'Создать гостя',
    editTitle: 'Редактирование гостя',
    updateBtn: 'Сохранить',
    backToGuests: 'К списку гостей',
    editGuest: 'Редактировать',
    sectionPersonal: 'Личная информация',
  },
  en: {
    title: 'Guests',
    newGuestBtn: 'New guest',
    newTitle: 'New guest',
    createBtn: 'Create guest',
    editTitle: 'Edit guest',
    updateBtn: 'Save changes',
    backToGuests: 'Back to guests',
    editGuest: 'Edit guest',
    sectionPersonal: 'Personal Information',
  },
} as const;

test.describe('11 profiles', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID, {
    extraAfterAll: async () => {
      // Cleanup: delete the guest created in scenario 03.
      if (createdGuestId) {
        const status = await deleteGuest(createdGuestId);
        // eslint-disable-next-line no-console
        console.log(`[11-profiles] DELETE created guest ${createdGuestId} → ${status}`);
        createdGuestId = null;
      }
      // Cleanup: restore sample guest email to its captured original.
      if (originalSampleEmail !== null) {
        const status = await restoreGuestEmail(SAMPLE_GUEST_ID, originalSampleEmail);
        // eslint-disable-next-line no-console
        console.log(
          `[11-profiles] PUT sample guest ${SAMPLE_GUEST_ID} email=${originalSampleEmail} → ${status}`,
        );
      }
    },
  });

  // Pre-flight: capture sample guest's original email for later restore.
  test.beforeAll(async () => {
    const sample = await fetchGuest(SAMPLE_GUEST_ID);
    originalSampleEmail = sample.email;
    // eslint-disable-next-line no-console
    console.log(
      `[11-profiles] pre-flight: sample guest email captured = ${originalSampleEmail}`,
    );

    // Sanity-check the individual count so drift surfaces loud if DB shifts.
    const list = await fetchGuestsList({ type: 'individual', limit: '1' });
    if (list.total !== EXPECTED_INDIVIDUAL_TOTAL) {
      // eslint-disable-next-line no-console
      console.warn(
        `[11-profiles] individual total drift: expected=${EXPECTED_INDIVIDUAL_TOTAL} got=${list.total}`,
      );
    }
  });

  // ── Scenario 01: list renders; count matches API ────────────────────────────
  test('01-list-render: /guests renders; total count matches API individuals total', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    // Title renders
    await expect(page.getByTestId('guests-title')).toBeVisible({ timeout: UI_TIMEOUT });
    await expect(page.getByTestId('guests-title')).toHaveText(labels[locale].title);

    // New Guest button present
    await expect(page.getByTestId('guests-new-button')).toBeVisible();

    // Total-count badge matches API (individuals only).
    const apiTotal = (await fetchGuestsList({ type: 'individual', limit: '1' })).total;
    const countEl = page.getByTestId('guests-total-count');
    await expect(countEl).toBeVisible();
    const countText = ((await countEl.textContent()) ?? '').trim();
    testInfo.attach('ui-total-count', { body: countText, contentType: 'text/plain' });
    testInfo.attach('api-total', { body: String(apiTotal), contentType: 'text/plain' });
    expect(Number(countText)).toBe(apiTotal);

    // Rows render (first page = 50 per PAGE_SIZE)
    const rows = page.getByTestId('guests-row');
    await expect(rows.first()).toBeVisible({ timeout: UI_TIMEOUT });
    const rowCount = await rows.count();
    testInfo.attach('rendered-row-count', {
      body: String(rowCount),
      contentType: 'text/plain',
    });
    expect(rowCount).toBeGreaterThan(0);
    expect(rowCount).toBeLessThanOrEqual(50);

    await auditScreenshot(page, SECTION_ID, '01-list-render', locale);
  });

  // ── Scenario 02: search (adapted from plan "filter-type") ───────────────────
  // Plan drift: /guests hardcodes type=individual. There is no type-switcher.
  // This scenario tests the existing debounced search form (the only filter UI).
  test('02-search-q: typing query filters list; URL gains ?q=', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    const search = page.getByTestId('guests-search-input');
    await expect(search).toBeVisible({ timeout: UI_TIMEOUT });

    // Capture baseline row count (should be 50 for 130 individuals)
    const baselineRows = await page.getByTestId('guests-row').count();
    testInfo.attach('baseline-row-count', {
      body: String(baselineRows),
      contentType: 'text/plain',
    });

    // Type a query — use "Alex" which matches 'Alexander', 'Alexei' etc.
    const query = 'Alex';
    await search.fill(query);

    // SearchForm debounce = 300ms → router.push ?q= — wait for URL update.
    await page.waitForURL(/\?q=/, { timeout: UI_TIMEOUT });
    const urlAfter = page.url();
    testInfo.attach('url-after-type', { body: urlAfter, contentType: 'text/plain' });
    expect(urlAfter).toMatch(/[?&]q=Alex/);

    // Server reloads the filtered list. Wait for rows to reflect the filter.
    await expect(page.getByTestId('guests-row').first()).toBeVisible({ timeout: UI_TIMEOUT });

    // Capture the API-side truth about this filter.
    const filtered = await fetchGuestsList({ type: 'individual', q: query });
    testInfo.attach('api-filtered-total', {
      body: String(filtered.total),
      contentType: 'text/plain',
    });
    // If the filter narrows results (which it should in seeded data), fewer rows render.
    expect(filtered.total).toBeGreaterThan(0);
    expect(filtered.total).toBeLessThan(EXPECTED_INDIVIDUAL_TOTAL);

    // UI count matches the filtered API total.
    const countEl = page.getByTestId('guests-total-count');
    await expect(countEl).toHaveText(String(filtered.total), { timeout: UI_TIMEOUT });

    // Search summary text becomes visible when q is set.
    await expect(page.getByTestId('guests-search-summary')).toBeVisible();

    await auditScreenshot(page, SECTION_ID, '02-search-q', locale);
  });

  // ── Scenario 03: create guest (mutation, en-only) ───────────────────────────
  test('03-create-guest: POST /api/profiles 201; guest appears in list; cleanup queued', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    const timestamp = Date.now().toString().slice(-8);
    const firstName = 'AuditTest';
    const lastName = `Section11-${timestamp}`;
    const email = `audittest.s11.${timestamp}@example.test`;

    testInfo.attach('new-guest-name', {
      body: `${firstName} ${lastName}`,
      contentType: 'text/plain',
    });

    await setLocaleAndGoto(page, 'en', '/guests/new');

    // Page heading visible.
    await expect(page.getByRole('heading', { name: labels.en.newTitle })).toBeVisible({
      timeout: UI_TIMEOUT,
    });

    // Fill form
    await page.getByTestId('guest-form-first-name').fill(firstName);
    await page.getByTestId('guest-form-last-name').fill(lastName);
    await page.getByTestId('guest-form-email').fill(email);

    // Submit; intercept POST.
    const [postResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/profiles') &&
          r.request().method() === 'POST',
        { timeout: API_TIMEOUT },
      ),
      page.getByTestId('guest-form-submit').click(),
    ]);

    const postStatus = postResp.status();
    testInfo.attach('post-response-status', {
      body: String(postStatus),
      contentType: 'text/plain',
    });
    expect(postStatus).toBe(201);

    const body = (await postResp.json()) as GuestDTO;
    testInfo.attach('post-response-body', {
      body: JSON.stringify(body, null, 2),
      contentType: 'application/json',
    });
    expect(body.id).toBeTruthy();
    createdGuestId = body.id;

    // guest-form redirects to /guests/{id} (replace). Detail page must load.
    await page.waitForURL(new RegExp(`/guests/${body.id}`), { timeout: UI_TIMEOUT });
    await expect(page.getByTestId('guest-detail-name')).toBeVisible({
      timeout: UI_TIMEOUT,
    });
    await expect(page.getByTestId('guest-detail-name')).toContainText(firstName);

    await auditScreenshot(page, SECTION_ID, '03-create-guest', 'en');

    // Navigate back to list and confirm the new guest is reachable via search.
    await setLocaleAndGoto(page, 'en', `/guests?q=${encodeURIComponent(lastName)}`);
    const rows = page.getByTestId('guests-row');
    await expect(rows.first()).toBeVisible({ timeout: UI_TIMEOUT });
    const matchByName = page.getByTestId('guests-row-name').filter({ hasText: lastName });
    await expect(matchByName.first()).toBeVisible();
  });

  // ── Scenario 04: open detail (adapted from plan "view-guest-history") ───────
  // Plan drift: /guests/[id] has no booking-history section — only personal info.
  // This scenario asserts what the detail page DOES render. The missing
  // booking-history feature is documented under feature YAML missing_actions.
  test('04-open-detail: click row → detail page shows personal info grid', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, ROUTE);

    const firstRow = page.getByTestId('guests-row').first();
    await expect(firstRow).toBeVisible({ timeout: UI_TIMEOUT });

    const nameLink = firstRow.getByTestId('guests-row-name');
    await expect(nameLink).toBeVisible();
    const originalLinkText = ((await nameLink.textContent()) ?? '').trim();
    testInfo.attach('row-name-link', {
      body: originalLinkText,
      contentType: 'text/plain',
    });

    // Click into detail.
    await Promise.all([
      page.waitForURL(/\/guests\/[0-9a-f-]{36}/, { timeout: UI_TIMEOUT }),
      nameLink.click(),
    ]);

    // Detail hero renders the name.
    await expect(page.getByTestId('guest-detail-name')).toBeVisible({
      timeout: UI_TIMEOUT,
    });

    // Personal info card visible.
    await expect(page.getByTestId('guest-detail-personal')).toBeVisible();

    // Edit button present (links to /guests/[id]/edit).
    await expect(page.getByTestId('guest-detail-edit-button')).toBeVisible();

    // Back link visible in both locales.
    await expect(
      page.getByRole('link', { name: new RegExp(labels[locale].backToGuests) }),
    ).toBeVisible();

    await auditScreenshot(page, SECTION_ID, '04-open-detail', locale);
  });

  // ── Scenario 05: edit guest email (mutation, en-only) ───────────────────────
  test('05-edit-guest: PUT /api/profiles/:id 200; email persists; cleanup queued', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    const timestamp = Date.now().toString().slice(-8);
    const newEmail = `audit.s11.edit.${timestamp}@example.test`;

    testInfo.attach('edit-target-id', {
      body: SAMPLE_GUEST_ID,
      contentType: 'text/plain',
    });
    testInfo.attach('edit-new-email', { body: newEmail, contentType: 'text/plain' });
    testInfo.attach('edit-original-email', {
      body: originalSampleEmail ?? '(null)',
      contentType: 'text/plain',
    });

    await setLocaleAndGoto(page, 'en', `/guests/${SAMPLE_GUEST_ID}/edit`);

    // Edit page heading.
    await expect(page.getByRole('heading', { name: labels.en.editTitle })).toBeVisible({
      timeout: UI_TIMEOUT,
    });

    // Email input loaded with original value.
    const emailInput = page.getByTestId('guest-form-email');
    await expect(emailInput).toBeVisible();
    const loadedValue = await emailInput.inputValue();
    testInfo.attach('loaded-email-value', {
      body: loadedValue,
      contentType: 'text/plain',
    });
    // Loaded value should match the snapshot captured in beforeAll.
    expect(loadedValue).toBe(originalSampleEmail ?? '');

    // Change email. Use setNativeValue to ensure React state picks up the change
    // reliably regardless of control state (matches batch-B helper convention).
    await setNativeValue(page, '[data-testid="guest-form-email"]', newEmail);
    await expect(emailInput).toHaveValue(newEmail);

    // Submit; intercept PUT.
    const [putResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/profiles/${SAMPLE_GUEST_ID}`) &&
          r.request().method() === 'PUT',
        { timeout: API_TIMEOUT },
      ),
      page.getByTestId('guest-form-submit').click(),
    ]);

    const putStatus = putResp.status();
    testInfo.attach('put-response-status', {
      body: String(putStatus),
      contentType: 'text/plain',
    });
    expect(putStatus).toBe(200);

    // On success, the edit form redirects to the detail page.
    await page.waitForURL(
      new RegExp(`/guests/${SAMPLE_GUEST_ID}(?:[?#]|$)`),
      { timeout: UI_TIMEOUT },
    );

    // Detail shows the updated email.
    await expect(page.getByTestId('guest-detail-email')).toBeVisible({
      timeout: UI_TIMEOUT,
    });
    await expect(page.getByTestId('guest-detail-email')).toContainText(newEmail);

    // API confirms persistence.
    const afterPut = await fetchGuest(SAMPLE_GUEST_ID);
    testInfo.attach('api-verified-email', {
      body: afterPut.email ?? '(null)',
      contentType: 'text/plain',
    });
    expect(afterPut.email).toBe(newEmail);

    await auditScreenshot(page, SECTION_ID, '05-edit-guest', 'en');
  });
});
