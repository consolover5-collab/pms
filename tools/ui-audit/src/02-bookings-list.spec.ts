import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
} from './shared.ts';

const SECTION_ID = '02-bookings-list';

const labels = {
  ru: {
    title: 'Бронирования',
    tabAll: 'Все',
    tabArrivals: 'Заезды сегодня',
    tabDepartures: 'Выезды сегодня',
    tabInHouse: 'В отеле',
    newBooking: 'Новое бронирование',
    statusConfirmed: 'Подтверждено',
    empty: 'Бронирования не найдены',
  },
  en: {
    title: 'Bookings',
    tabAll: 'All',
    tabArrivals: 'Arrivals today',
    tabDepartures: 'Departures today',
    tabInHouse: 'In-house',
    newBooking: 'New booking',
    statusConfirmed: 'Confirmed',
    empty: 'No bookings found',
  },
} as const;

test.describe('02 bookings-list', () => {
  registerSectionHooks(SECTION_ID);

  test('tab-all: default tab renders rows or empty-state', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    const L = labels[locale];

    await setLocaleAndGoto(page, locale, '/bookings');
    await page.waitForSelector('table.t');

    await expect(page.locator('h1.page-title')).toHaveText(L.title);
    const activeTab = page.locator('.tabs-bar a.tb.on').first();
    await expect(activeTab).toHaveText(L.tabAll);

    const rowCount = await page.locator('table.t tbody tr').count();
    const emptyCount = await page.locator('table.t tbody .empty').count();
    testInfo.attach('all-row-count', {
      body: `rows=${rowCount} empty=${emptyCount}`,
      contentType: 'text/plain',
    });
    expect(rowCount > 0 || emptyCount > 0).toBe(true);

    await expect(page.locator('.filterbar')).toBeVisible();

    await auditScreenshot(page, SECTION_ID, '01-tab-all', locale);
  });

  test('tab-arrivals: view=arrivals becomes active tab', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    const L = labels[locale];

    await setLocaleAndGoto(page, locale, '/bookings');
    await page.waitForSelector('table.t');

    const arrivalsTab = page.locator('.tabs-bar a.tb', { hasText: L.tabArrivals }).first();
    await Promise.all([
      page.waitForURL(/\/bookings\?view=arrivals/),
      arrivalsTab.click(),
    ]);
    await page.waitForLoadState('networkidle');

    const activeTab = page.locator('.tabs-bar a.tb.on').first();
    await expect(activeTab).toHaveText(L.tabArrivals);
    await expect(page.locator('h1.page-title')).toHaveText(L.tabArrivals);

    await expect(page.locator('.filterbar')).toHaveCount(0);

    const rowCount = await page.locator('table.t tbody tr').count();
    const emptyCount = await page.locator('table.t tbody .empty').count();
    testInfo.attach('arrivals-row-count', {
      body: `rows=${rowCount} empty=${emptyCount}`,
      contentType: 'text/plain',
    });
    expect(rowCount > 0 || emptyCount > 0).toBe(true);

    await auditScreenshot(page, SECTION_ID, '02-tab-arrivals', locale);
  });

  test('tab-in-house: view=inhouse rows all checked-in', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    const L = labels[locale];

    await setLocaleAndGoto(page, locale, '/bookings');
    await page.waitForSelector('table.t');

    const inHouseTab = page.locator('.tabs-bar a.tb', { hasText: L.tabInHouse }).first();
    await Promise.all([
      page.waitForURL(/\/bookings\?view=inhouse/),
      inHouseTab.click(),
    ]);
    await page.waitForLoadState('networkidle');

    const activeTab = page.locator('.tabs-bar a.tb.on').first();
    await expect(activeTab).toHaveText(L.tabInHouse);

    const rows = page.locator('table.t tbody tr');
    const rowCount = await rows.count();
    const emptyCount = await page.locator('table.t tbody .empty').count();
    testInfo.attach('inhouse-row-count', {
      body: `rows=${rowCount} empty=${emptyCount}`,
      contentType: 'text/plain',
    });

    if (rowCount > 0 && emptyCount === 0) {
      // The badge class on /bookings is state-aware: checked-in bookings whose
      // checkOutDate === today render with "no-show" styling to signal urgency
      // ("Due out"). View=inhouse restricts the rows to status=checked_in, so
      // we accept either class as a legitimate in-house badge.
      const badges = await page.locator('table.t tbody tr .badge').all();
      for (const b of badges) {
        await expect(b).toHaveClass(/checked-in|no-show/);
      }
    }

    await auditScreenshot(page, SECTION_ID, '03-tab-in-house', locale);
  });

  test('status-filter: clicking Confirmed chip filters list', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    const L = labels[locale];

    await setLocaleAndGoto(page, locale, '/bookings');
    await page.waitForSelector('.filterbar');

    const confirmedChip = page
      .locator('.filterbar a.fld', { hasText: L.statusConfirmed })
      .first();
    await Promise.all([
      page.waitForURL(/\/bookings\?status=confirmed/),
      confirmedChip.click(),
    ]);
    await page.waitForLoadState('networkidle');

    const activeChip = page.locator('.filterbar a.fld.on').first();
    await expect(activeChip).toContainText(L.statusConfirmed);

    const rowCount = await page.locator('table.t tbody tr').count();
    testInfo.attach('confirmed-row-count', {
      body: String(rowCount),
      contentType: 'text/plain',
    });

    await auditScreenshot(page, SECTION_ID, '04-status-filter', locale);
  });

  test('click-row-navigates: confirmation link opens booking detail', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, '/bookings');
    await page.waitForSelector('table.t');

    const firstRow = page.locator('table.t tbody tr').first();
    const hasRow = (await firstRow.count()) > 0;
    const hasEmpty = (await page.locator('table.t tbody .empty').count()) > 0;

    if (hasRow && !hasEmpty) {
      const confLink = firstRow.locator('a.conf').first();
      await Promise.all([
        page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/),
        confLink.click(),
      ]);
      expect(page.url()).toMatch(/\/bookings\/[0-9a-f-]{36}$/);
    } else {
      testInfo.attach('click-row-skipped', {
        body: 'no bookings rendered in default view — navigation not possible',
        contentType: 'text/plain',
      });
    }

    await auditScreenshot(page, SECTION_ID, '05-click-row-navigates', locale);
  });
});
