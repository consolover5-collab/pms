/**
 * Section 22 — Help (/help + /help/<topic>)
 *
 * Zero-mutation section: all scenarios run in both RU and EN locales.
 *
 * Pre-flight: Hub page must show exactly 9 topic cards (hardcoded topic IDs asserted
 * against rendered DOM count). No API-backed pre-flight needed — help is static.
 *
 * Scenarios:
 *   01 — hub-render: Navigate /help; assert title, quick-links, 9 topic cards (count),
 *        status-reference section visible. Each card has visible icon + title + desc.
 *   02 — open-topic-bookings: Click "bookings" card; URL → /help/bookings; title
 *        "Bookings" (EN) / "Бронирования" (RU).
 *   03 — all-topics-non-empty: Iterate all 9 topic IDs; each /help/<topic> renders
 *        [data-testid="help-topic-content"] with > 100 chars of text. Screenshot of
 *        5th topic (rooms) as representative sample.
 *   04 — missing-topic-404: Navigate /help/nonexistent-topic-xyz; HTTP 404; 404 UI
 *        content present.
 *
 * BUG-011: Hub page status-reference legend uses hardcoded English keywords ("Confirmed",
 *          "Checked In", etc.) followed by a dash and the i18n description. On RU locale
 *          this produces mixed "Confirmed - Подтверждено" style text. Filed in bugs.yml
 *          + backlog.json. The test does NOT assert the mixed text — it asserts the section
 *          is visible (the visual manifestation is captured in screenshots).
 */

import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
} from './shared.ts';

const SECTION_ID = '22-help';
const HUB_ROUTE = '/help';

const UI_TIMEOUT = 10_000;

// ── Canonical topic IDs (matches HelpContentDict keys in help-content.tsx) ────
const TOPIC_IDS = [
  'quick-start',
  'dashboard',
  'bookings',
  'check-in-out',
  'rooms',
  'guests',
  'folio',
  'night-audit',
  'configuration',
] as const;

type TopicId = typeof TOPIC_IDS[number];

// ── Test suite ─────────────────────────────────────────────────────────────────
test.describe('22 help', () => {
  // serial mode kept for consistency with other sections; scenarios have no state dependencies
  test.describe.configure({ mode: 'serial' });

  // No extraAfterAll — zero mutations, nothing to restore
  registerSectionHooks(SECTION_ID);

  // ── Scenario 01: hub-render (ru + en) ─────────────────────────────────────
  test(
    '01-hub-render: title, quick-links, 9 topic cards, status-reference visible',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await setLocaleAndGoto(page, locale, HUB_ROUTE);

      // Hub title visible
      await expect(page.getByTestId('help-hub-title')).toBeVisible({ timeout: UI_TIMEOUT });

      // Hub subtitle visible
      await expect(page.getByTestId('help-hub-subtitle')).toBeVisible({ timeout: UI_TIMEOUT });

      // Quick-links section visible
      await expect(page.getByTestId('help-quick-links')).toBeVisible({ timeout: UI_TIMEOUT });

      // Topics grid visible
      await expect(page.getByTestId('help-topics-grid')).toBeVisible({ timeout: UI_TIMEOUT });

      // Exactly 9 topic cards
      const cards = page.getByTestId('help-topic-card');
      await expect(cards).toHaveCount(9, { timeout: UI_TIMEOUT });

      // Each card must have a visible icon, title, and non-empty description
      for (let i = 0; i < 9; i++) {
        const card = cards.nth(i);
        // Assert icon span renders non-empty (emoji characters)
        const iconSpan = card.getByTestId('help-topic-card-icon');
        await expect(iconSpan).toBeVisible({ timeout: UI_TIMEOUT });
        await expect(iconSpan).not.toBeEmpty();
        await expect(card.getByTestId('help-topic-card-title')).toBeVisible({ timeout: UI_TIMEOUT });
        const desc = card.getByTestId('help-topic-card-desc');
        await expect(desc).toBeVisible({ timeout: UI_TIMEOUT });
        // Description must not be empty
        const descText = await desc.textContent();
        expect((descText ?? '').trim().length).toBeGreaterThan(0);
      }

      // Status-reference section visible
      await expect(page.getByTestId('help-status-reference')).toBeVisible({ timeout: UI_TIMEOUT });

      // Booking statuses block visible
      await expect(page.getByTestId('help-booking-statuses')).toBeVisible({ timeout: UI_TIMEOUT });

      // Room statuses block visible
      await expect(page.getByTestId('help-room-statuses')).toBeVisible({ timeout: UI_TIMEOUT });

      await auditScreenshot(page, SECTION_ID, '01-hub-render', locale);
    },
  );

  // ── Scenario 02: open-topic-bookings (ru + en) ────────────────────────────
  test(
    '02-open-topic-bookings: click bookings card → URL /help/bookings; localized title',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await setLocaleAndGoto(page, locale, HUB_ROUTE);

      // Locate the bookings card by data-topic-id
      const bookingsCard = page.locator('[data-testid="help-topic-card"][data-topic-id="bookings"]');
      await expect(bookingsCard).toBeVisible({ timeout: UI_TIMEOUT });

      // Click the card
      await bookingsCard.click();

      // URL must become /help/bookings
      await page.waitForURL('**/help/bookings', { timeout: UI_TIMEOUT });
      expect(page.url()).toContain('/help/bookings');

      // Topic title must be visible
      const topicTitle = page.getByTestId('help-topic-title');
      await expect(topicTitle).toBeVisible({ timeout: UI_TIMEOUT });

      // Locale-specific title assertion
      if (locale === 'en') {
        await expect(topicTitle).toHaveText('Bookings', { timeout: UI_TIMEOUT });
      } else {
        await expect(topicTitle).toHaveText('Бронирования', { timeout: UI_TIMEOUT });
      }

      // Content area non-empty
      const content = page.getByTestId('help-topic-content');
      await expect(content).toBeVisible({ timeout: UI_TIMEOUT });
      const contentText = await content.textContent();
      expect((contentText ?? '').trim().length).toBeGreaterThan(100);

      await auditScreenshot(page, SECTION_ID, '02-open-topic-bookings', locale);
    },
  );

  // ── Scenario 03: all-topics-non-empty (ru + en) ───────────────────────────
  test(
    '03-all-topics-non-empty: all 9 /help/<topic> pages render non-empty content',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      // Iterate all 9 topic IDs
      for (const topicId of TOPIC_IDS) {
        await setLocaleAndGoto(page, locale, `${HUB_ROUTE}/${topicId}`);

        // URL must match
        expect(page.url()).toContain(`/help/${topicId}`);

        // Topic title visible
        await expect(page.getByTestId('help-topic-title')).toBeVisible({ timeout: UI_TIMEOUT });

        // Content area visible and non-empty (> 100 chars)
        const content = page.getByTestId('help-topic-content');
        await expect(content).toBeVisible({ timeout: UI_TIMEOUT });
        const contentText = await content.textContent();
        expect(
          (contentText ?? '').trim().length,
          `Topic "${topicId}" content is too short (< 100 chars)`,
        ).toBeGreaterThan(100);
      }

      // Screenshot of representative sample: 5th topic (rooms, index 4)
      await setLocaleAndGoto(page, locale, `${HUB_ROUTE}/rooms`);
      await expect(page.getByTestId('help-topic-content')).toBeVisible({ timeout: UI_TIMEOUT });
      await auditScreenshot(page, SECTION_ID, '03-all-topics-rooms-sample', locale);
    },
  );

  // ── Scenario 04: missing-topic-404 (ru + en) ──────────────────────────────
  //
  // NOTE: Next.js 15 App Router with notFound() during RSC streaming returns
  // HTTP 200 at the transport level — the 404 UI is rendered client-side via React
  // hydration after the RSC payload is streamed. Asserting response.status()===404
  // would always fail. We instead assert:
  //   (a) URL stays at the nonexistent slug (no redirect)
  //   (b) The Next.js default 404 UI is rendered ("404" + "could not be found")
  test(
    '04-missing-topic-404: /help/nonexistent-topic-xyz → renders 404 UI',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await setLocaleAndGoto(page, locale, `${HUB_ROUTE}/nonexistent-topic-xyz`);

      // URL must still contain the bad slug (no redirect to a 200 page)
      expect(page.url()).toContain('/help/nonexistent-topic-xyz');

      // Next.js default 404 UI must be visible after hydration.
      // The project has no custom not-found.tsx; Next renders its default:
      //   <h1>404</h1><h2>This page could not be found.</h2>
      const body = page.locator('body');
      await expect(body).toContainText('404', { timeout: UI_TIMEOUT });
      // Next.js default 404 page renders English text regardless of app locale
      await expect(body).toContainText('could not be found', { timeout: UI_TIMEOUT });

      await auditScreenshot(page, SECTION_ID, '04-missing-topic-404', locale);
    },
  );
});
