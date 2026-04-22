/**
 * Section 24 — i18n + theme (cross-cutting audit)
 *
 * STATUS: ok if all scenarios pass with zero Cyrillic leaks in en locale,
 * partial if leaks or theme-unimplemented.
 *
 * This section has no single route — it samples behaviour across several
 * pages to validate:
 *   - Locale toggle works (ru → en re-renders UI strings)
 *   - Theme toggle works (data-theme attribute flips on <html>)
 *   - No Russian chrome/label text leaks through when en locale is active
 *     (spot-check of 5 meaningful pages; user-content like guest names is
 *     explicitly excluded from the scan — only chrome selectors are probed)
 *
 * Scenarios:
 *   01-locale-toggle: On /bookings, click ru/en locale chips; assert that
 *     three sampled chrome strings change between the two locales. Re-render
 *     is driven by setState in LocaleProvider — NO page reload. This means
 *     only CLIENT-rendered strings re-render; server-component strings (like
 *     page h1s that use getLocale() from next/headers) remain in the original
 *     locale until the next navigation. We deliberately pick three topbar
 *     strings (all client-rendered via useLocale()) to avoid that pitfall.
 *   02-theme-toggle: On /, click the theme toggle; assert that the
 *     document <html> element's data-theme attribute flips between "light"
 *     and "dark". Theme is persisted in localStorage but we only assert the
 *     DOM attribute for resilience.
 *   03-no-hardcoded-strings: Visit 5 sampled pages in en locale; extract
 *     text content from a curated chrome selector set (headings, buttons,
 *     nav, breadcrumbs) excluding rows of user data. Assert no match of
 *     /[а-яё]/i in any extracted text. File findings as BUG-018+.
 *
 * Preflight context:
 *   Batch-C retro's P1 preflight (commit dbd1563) found + fixed 3 hardcoded
 *   Russian strings (BUG-012 booking-tabs, BUG-013 hk-priority-badge,
 *   BUG-014 folio). Scenario 03 is the regression gate for those fixes.
 *
 * Guest-name Cyrillic exclusion:
 *   /bookings renders rows with guest names that may be Russian text even
 *   in en locale (Opera DB legacy data). We restrict scenario 03's
 *   selectors to chrome-only: topbar, sidebar, h1/h2/h3, button, and
 *   explicit filter controls. Table/list row contents are NOT scanned.
 *
 * Source references (verified 2026-04-22):
 *   - apps/web/src/components/topbar.tsx — locale chips (data-testid
 *     topbar-locale-{en,ru}) and theme toggle (topbar-theme-toggle).
 *     Attributes added for this section; pure additive.
 *   - apps/web/src/components/theme-provider.tsx — toggles data-theme on
 *     documentElement. Theme IS implemented (grep confirmed).
 *   - apps/web/src/components/locale-provider.tsx — setLocale mutates
 *     cookie + React state; UI re-renders via dict context.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
} from './shared.ts';

const SECTION_ID = '24-i18n-theme';

const UI_TIMEOUT = 10_000;

// Sampled pages for Cyrillic-leak scan. Chosen to cover:
//   dashboard (/), list page (/rooms — no user content), ops page
//   (/housekeeping), configuration page (/configuration/property), and
//   /bookings (which has guest-name user content and tests the
//   chrome-selector discipline).
const SAMPLED_PATHS: { path: string; slug: string }[] = [
  { path: '/', slug: 'dashboard' },
  { path: '/bookings', slug: 'bookings' },
  { path: '/housekeeping', slug: 'housekeeping' },
  { path: '/configuration/property', slug: 'config-property' },
  { path: '/rooms', slug: 'rooms' },
];

const CYRILLIC_RE = /[а-яё]/i;

// Chrome-only selectors. Intentionally excludes td/tr, li inside lists
// that render user data, and anything inside [data-user-content]. We also
// skip inputs/placeholders because placeholders are read via getAttribute
// separately below.
const CHROME_SELECTORS = [
  'h1',
  'h2',
  'h3',
  'button:not(table button):not(tbody button)',
  'nav a',
  '[data-testid="topbar-search"]',
  'label',
  'th',
  '[role="tab"]',
  '[aria-label]:not(table [aria-label]):not(tbody [aria-label])',
  // S1: <select><option> payloads (e.g. payment methods, booking sources,
  // guarantee types in /bookings/new) are chrome strings — a hardcoded
  // "Наличные" in an option would otherwise slip this scan entirely.
  'option',
  'legend',
  'summary',
];

/**
 * Scan curated chrome selectors on the current page and return any text
 * whose visible content (or aria-label) contains a Cyrillic character.
 *
 * Excludes text inside <table tbody>, <tr>, <td> so guest-name rows don't
 * produce false positives. Also strips whitespace and empty results.
 */
async function scanChromeForCyrillic(page: Page): Promise<string[]> {
  return page.evaluate(({ selectors, cyrillicSource }) => {
    const re = new RegExp(cyrillicSource, 'i');
    const hits: string[] = [];
    const isInsideUserContent = (el: Element): boolean => {
      let cur: Element | null = el;
      while (cur) {
        // Skip anything inside a table body — those rows are user data
        if (cur.tagName === 'TBODY') return true;
        // Dedicated user-content marker (opt-in; not yet used in codebase
        // but allows future exclusions without spec edits)
        if ((cur as HTMLElement).dataset?.userContent === 'true') return true;
        cur = cur.parentElement;
      }
      return false;
    };
    for (const sel of selectors) {
      const nodes = Array.from(document.querySelectorAll(sel));
      for (const n of nodes) {
        if (isInsideUserContent(n)) continue;
        const text = (n.textContent ?? '').trim();
        if (text && re.test(text)) {
          hits.push(`[${sel}] "${text.slice(0, 120)}"`);
        }
        const aria = n.getAttribute('aria-label');
        if (aria && re.test(aria)) {
          hits.push(`[${sel}@aria-label] "${aria.slice(0, 120)}"`);
        }
        const title = n.getAttribute('title');
        if (title && re.test(title)) {
          hits.push(`[${sel}@title] "${title.slice(0, 120)}"`);
        }
      }
    }
    // Also scan input placeholder text globally (chrome input hints)
    for (const input of Array.from(document.querySelectorAll('input[placeholder], textarea[placeholder]'))) {
      if (isInsideUserContent(input)) continue;
      const ph = input.getAttribute('placeholder');
      if (ph && re.test(ph)) {
        hits.push(`[input@placeholder] "${ph.slice(0, 120)}"`);
      }
    }
    return Array.from(new Set(hits));
  }, { selectors: CHROME_SELECTORS, cyrillicSource: CYRILLIC_RE.source });
}

test.describe('24 i18n-theme', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID);

  // ── Scenario 01: locale toggle ───────────────────────────────────────────
  test(
    '01-locale-toggle: clicking EN/RU chips re-renders chrome strings',
    async ({ page }, testInfo) => {
      const startLocale = testInfo.project.name as 'ru' | 'en';
      const otherLocale = startLocale === 'en' ? 'ru' : 'en';

      await setLocaleAndGoto(page, startLocale, '/bookings');

      // Locale chips are present
      const chipEn = page.getByTestId('topbar-locale-en');
      const chipRu = page.getByTestId('topbar-locale-ru');
      await expect(chipEn).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(chipRu).toBeVisible({ timeout: UI_TIMEOUT });

      // Grab the 3 sampled chrome strings in the starting locale.
      // Sample A: new-booking button (topbar) — text content
      const newBookingBtn = page.getByTestId('topbar-new-booking');
      await expect(newBookingBtn).toBeVisible({ timeout: UI_TIMEOUT });
      const textA_start = (await newBookingBtn.textContent())?.trim() ?? '';

      // Sample B: theme toggle aria-label (topbar)
      const themeBtn = page.getByTestId('topbar-theme-toggle');
      await expect(themeBtn).toBeVisible({ timeout: UI_TIMEOUT });
      const textB_start = (await themeBtn.getAttribute('aria-label')) ?? '';

      // Sample C: topbar search button text — rendered client-side via
      // useLocale(), so it re-renders on setLocale() without navigation.
      // (page h1s come from server components using getLocale() and would
      // stay stale until the next navigation — avoid those here.)
      const searchBtn = page.getByTestId('topbar-search');
      await expect(searchBtn).toBeVisible({ timeout: UI_TIMEOUT });
      const textC_start = (await searchBtn.textContent())?.trim() ?? '';

      // Assert starting-locale text is plausible
      if (startLocale === 'en') {
        expect(textA_start).toBe('New booking');
        expect(textB_start).toBe('Toggle theme');
      } else {
        expect(textA_start).toBe('Новое бронирование');
        expect(textB_start).toBe('Переключить тему');
      }

      await auditScreenshot(page, SECTION_ID, '01-locale-before', startLocale);

      // Click the OTHER locale chip
      const otherChip = otherLocale === 'en' ? chipEn : chipRu;
      await otherChip.click();

      // The text content should change (no hard assertion of specific wording
      // beyond the three we sampled — we just want all three to differ).
      await expect(newBookingBtn).not.toHaveText(textA_start, { timeout: UI_TIMEOUT });

      const textA_after = (await newBookingBtn.textContent())?.trim() ?? '';
      const textB_after = (await themeBtn.getAttribute('aria-label')) ?? '';
      const textC_after = (await searchBtn.textContent())?.trim() ?? '';

      expect(textA_after, 'new-booking button should change between locales').not.toBe(textA_start);
      expect(textB_after, 'theme-toggle aria-label should change between locales').not.toBe(textB_start);
      expect(textC_after, 'searchbox text should change between locales').not.toBe(textC_start);

      // Assert the OTHER locale's expected strings
      if (otherLocale === 'en') {
        expect(textA_after).toBe('New booking');
        expect(textB_after).toBe('Toggle theme');
      } else {
        expect(textA_after).toBe('Новое бронирование');
        expect(textB_after).toBe('Переключить тему');
      }

      // Cookie updated
      const cookies = await page.context().cookies();
      const localeCookie = cookies.find((c) => c.name === 'locale');
      expect(localeCookie?.value).toBe(otherLocale);

      await auditScreenshot(page, SECTION_ID, '01-locale-after', startLocale);
    },
  );

  // ── Scenario 02: theme toggle ────────────────────────────────────────────
  test(
    '02-theme-toggle: clicking theme button flips <html data-theme>',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await setLocaleAndGoto(page, locale, '/');

      const themeBtn = page.getByTestId('topbar-theme-toggle');
      await expect(themeBtn).toBeVisible({ timeout: UI_TIMEOUT });

      // Read starting data-theme (set by ThemeProvider on mount)
      const themeBefore = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme'),
      );
      expect(themeBefore, 'data-theme should be set on <html> after mount').toMatch(
        /^(light|dark)$/,
      );

      await auditScreenshot(page, SECTION_ID, `02-theme-before-${themeBefore}`, locale);

      // Click to toggle
      await themeBtn.click();

      // Assert the attribute flipped
      const expectedAfter = themeBefore === 'light' ? 'dark' : 'light';
      await expect
        .poll(
          async () =>
            page.evaluate(() => document.documentElement.getAttribute('data-theme')),
          { timeout: UI_TIMEOUT },
        )
        .toBe(expectedAfter);

      await auditScreenshot(page, SECTION_ID, `02-theme-after-${expectedAfter}`, locale);

      // Click again — should flip back
      await themeBtn.click();
      await expect
        .poll(
          async () =>
            page.evaluate(() => document.documentElement.getAttribute('data-theme')),
          { timeout: UI_TIMEOUT },
        )
        .toBe(themeBefore);
    },
  );

  // ── Scenario 03: no-hardcoded-strings (en only) ──────────────────────────
  //
  // This scenario runs in BOTH projects for CI simplicity, but the leak
  // assertion only fires when the project locale is 'en'. (In ru mode every
  // chrome string is legitimately Cyrillic, so the scan is a no-op.) We
  // still take the screenshots in both locales for evidence parity.
  test(
    '03-no-hardcoded-strings: sampled pages in en locale have no Cyrillic chrome',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      const allLeaks: { path: string; leaks: string[] }[] = [];

      for (const { path, slug } of SAMPLED_PATHS) {
        await setLocaleAndGoto(page, locale, path);
        // Give client-side rendering a beat to paint
        await page.waitForLoadState('networkidle').catch(() => {});
        await auditScreenshot(page, SECTION_ID, `03-${slug}`, locale);

        if (locale === 'en') {
          const leaks = await scanChromeForCyrillic(page);
          if (leaks.length > 0) {
            allLeaks.push({ path, leaks });
          }
        }
      }

      if (locale === 'en') {
        // Record leaks as a test attachment for debugging before the assert.
        testInfo.attach('cyrillic-leaks', {
          body: JSON.stringify(allLeaks, null, 2),
          contentType: 'application/json',
        });
        expect(
          allLeaks,
          `Cyrillic leaks in en-locale chrome:\n${JSON.stringify(allLeaks, null, 2)}`,
        ).toHaveLength(0);
      }
    },
  );
});
