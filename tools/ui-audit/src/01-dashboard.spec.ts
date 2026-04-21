import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
  API_URL,
  GBH_PROPERTY_ID,
} from './shared.ts';

const SECTION_ID = '01-dashboard';

const labels = {
  ru: {
    occupancy: 'Загрузка',
    inventory: 'Статус номерного фонда',
    hk: 'Уборка номеров',
    arrivalsTitle: 'Заезды сегодня',
    departuresTitle: 'Выезды сегодня',
    noArrivals: 'Заездов нет',
    noDepartures: 'Выездов нет',
    refresh: 'Обновить',
  },
  en: {
    occupancy: 'Occupancy',
    inventory: 'Room status',
    hk: 'Housekeeping',
    arrivalsTitle: 'Arrivals today',
    departuresTitle: 'Departures today',
    noArrivals: 'No arrivals today',
    noDepartures: 'No departures today',
    refresh: 'Refresh',
  },
} as const;

test.describe('01 dashboard', () => {
  registerSectionHooks(SECTION_ID);

  test('empty-state-happy-path: kpi and cards render', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    const L = labels[locale];

    await setLocaleAndGoto(page, locale, '/');
    // Donut is a stable anchor element rendered in the inventory card.
    await page.waitForSelector('.donut');

    await expect(page.getByText(L.occupancy).first()).toBeVisible();
    await expect(page.locator('.donut').first()).toBeVisible();
    await expect(page.getByText(L.inventory).first()).toBeVisible();
    await expect(page.getByText(L.hk).first()).toBeVisible();

    await auditScreenshot(page, SECTION_ID, '01-empty-state-happy-path', locale);
  });

  test('arrivals-today: rows or empty-state present', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    const L = labels[locale];

    await setLocaleAndGoto(page, locale, '/');
    await page.waitForSelector('.donut');

    await expect(page.getByText(L.arrivalsTitle).first()).toBeVisible();

    const arrivalsCard = page
      .locator('.card', { has: page.getByText(L.arrivalsTitle) })
      .first();
    const rowCount = await arrivalsCard.locator('table.t tbody tr').count();
    const emptyCount = await arrivalsCard.locator('.empty').count();
    testInfo.attach('arrivals-row-count', {
      body: String(rowCount),
      contentType: 'text/plain',
    });
    expect(rowCount > 0 || emptyCount > 0).toBe(true);

    await auditScreenshot(page, SECTION_ID, '02-arrivals-today', locale);
  });

  test('click-through-bookings: guest link navigates to booking detail', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    const L = labels[locale];

    await setLocaleAndGoto(page, locale, '/');
    await page.waitForSelector('.donut');

    const arrivalsCard = page
      .locator('.card', { has: page.getByText(L.arrivalsTitle) })
      .first();
    const rowCount = await arrivalsCard.locator('table.t tbody tr').count();

    if (rowCount > 0) {
      const guestLink = arrivalsCard
        .locator('table.t tbody tr a.guest')
        .first();
      await Promise.all([
        page.waitForURL(/\/bookings\/[0-9a-f-]{36}$/),
        guestLink.click(),
      ]);
      expect(page.url()).toMatch(/\/bookings\/[0-9a-f-]{36}$/);
    } else {
      testInfo.attach('click-through-skipped', {
        body: 'no arrivals today — click-through not possible from dashboard (there is no header-level list link)',
        contentType: 'text/plain',
      });
    }

    await auditScreenshot(page, SECTION_ID, '03-click-through-bookings', locale);
  });

  test('business-date-visible: topbar matches /api/business-date', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, '/');
    await page.waitForSelector('.page-sub');

    const apiResp = await page.context().request.get(
      `${API_URL}/api/business-date?propertyId=${GBH_PROPERTY_ID}`,
    );
    expect(apiResp.ok()).toBe(true);
    const body = (await apiResp.json()) as { date: string };
    const [year, , day] = body.date.split('-');
    const dayNoZero = String(parseInt(day, 10));

    const subText = (await page.locator('.page-sub').first().textContent()) ?? '';
    testInfo.attach('page-sub-text', {
      body: `api=${body.date}  page-sub="${subText}"`,
      contentType: 'text/plain',
    });
    expect(subText).toContain(dayNoZero);
    expect(subText).toContain(year);

    await auditScreenshot(page, SECTION_ID, '04-business-date-visible', locale);
  });
});
