import { test, expect } from '@playwright/test';
import {
  auditScreenshot,
  registerSectionHooks,
  setLocaleAndGoto,
  API_URL,
  GBH_PROPERTY_ID,
} from './shared.ts';
import {
  fetchCheckedInBooking,
  fetchTransactionCode,
  getFolio,
} from './fixtures.ts';

const SECTION_ID = '10-folio';

const labels = {
  ru: {
    tabFolio: 'Финансы',
    windowPrefix: 'Окно',
    charge: 'Начисление',
    payment: 'Платёж',
    noTransactions: 'Операций нет',
    totalBooking: 'Итого по брони',
    acceptPayment: 'Принять платёж',
  },
  en: {
    tabFolio: 'Folio',
    windowPrefix: 'Window',
    charge: 'Charge',
    payment: 'Payment',
    noTransactions: 'No transactions',
    totalBooking: 'Booking total',
    acceptPayment: 'Accept payment',
  },
} as const;

// Shared booking state across scenarios 02→03→04 (en only).
// Chosen lazily in beforeAll from an existing checked_in booking with positive balance.
let BK_FOLIO = ''; // single-window booking exercised by mutations
let WIN_A = ''; // first window id of BK_FOLIO
let INITIAL_BALANCE = 0; // balance captured before scenario 02 posts a charge
let BK_MULTI = ''; // booking with >=2 windows for scenario 01
let BK_POS = ''; // different booking with positive balance for scenario 05 (excluded: BK_FOLIO)

test.describe('10 folio', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID);

  test.beforeAll(async () => {
    // Pick BK_MULTI (2+ windows) for scenario 01.
    const multi = await fetchCheckedInBooking({ minWindows: 2 });
    if (!multi) {
      throw new Error('No checked_in booking with >= 2 windows found');
    }
    BK_MULTI = multi.bookingId;

    // Pick BK_FOLIO — the booking we mutate in scenarios 02/03. Prefer a single-window
    // booking so scenario 04's zero-balance observation is unambiguous (overall balance
    // == zero only if every window is zero). Fall back to any checked_in booking other
    // than BK_MULTI. The two-step try mirrors the pre-refactor semantics where the
    // first fetch could return null (no match) without aborting the setup.
    const single = await fetchCheckedInBooking({
      minWindows: 1,
      excludeIds: [BK_MULTI],
    });
    if (single && single.windows.length === 1) {
      BK_FOLIO = single.bookingId;
      WIN_A = single.windows[0].id;
      INITIAL_BALANCE = single.balance;
    } else if (single) {
      // Matched a booking but it has multiple windows — use window 1 for mutations.
      BK_FOLIO = single.bookingId;
      WIN_A = single.windows[0].id;
      INITIAL_BALANCE = single.windows[0].balance;
    } else {
      throw new Error(
        'No checked_in booking available for BK_FOLIO (excluded BK_MULTI)',
      );
    }

    // Pick BK_POS — a positive-balance booking distinct from BK_FOLIO (which en-run zeroes).
    const pos = await fetchCheckedInBooking({
      balancePredicate: 'positive',
      excludeIds: [BK_FOLIO],
    });
    if (!pos) {
      throw new Error('No checked_in booking with balance > 0 found');
    }
    BK_POS = pos.bookingId;
  });

  test('01-window-stack-render: multi-window booking renders all windows stacked (not tabbed)', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    await setLocaleAndGoto(page, locale, `/bookings/${BK_MULTI}`);
    await page.waitForSelector('h1');
    await page.waitForSelector('.folio-win', { timeout: 10_000 });

    const wins = page.locator('.folio-win');
    const winCount = await wins.count();
    testInfo.attach('multi-window-count', {
      body: String(winCount),
      contentType: 'text/plain',
    });
    expect(winCount).toBeGreaterThanOrEqual(2);

    // Assert every .folio-win is visible simultaneously — there's no tab selector hiding siblings.
    const allVisible = await wins.evaluateAll((els) =>
      els.map((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }),
    );
    testInfo.attach('per-window-visible', {
      body: JSON.stringify(allVisible),
      contentType: 'application/json',
    });
    for (const v of allVisible) expect(v).toBe(true);

    // Headers render with the window letter — ties back to `windowLetter(windowNumber)`.
    const firstHeader = (await wins.first().locator('.fh .ti').textContent())?.trim() ?? '';
    testInfo.attach('first-window-header', {
      body: firstHeader,
      contentType: 'text/plain',
    });
    expect(firstHeader.length).toBeGreaterThan(0);

    await auditScreenshot(page, SECTION_ID, '01-window-stack-render', locale);
  });

  test('02-post-charge: click Charge → fill form → POST 201 → row appears and balance rises', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    const pre = await getFolio(BK_FOLIO);
    const preWin = pre.windows.find((w) => w.id === WIN_A);
    expect(preWin).toBeTruthy();
    const preRowCount = pre.transactions.filter((t) => t.folioWindowId === WIN_A).length;
    testInfo.attach('pre-txn-row-count', {
      body: String(preRowCount),
      contentType: 'text/plain',
    });

    const chargeCode = await fetchTransactionCode('charge', 'ADJ_ROOM');
    testInfo.attach('charge-code-picked', {
      body: `${chargeCode.code} / ${chargeCode.id}`,
      contentType: 'text/plain',
    });

    await setLocaleAndGoto(page, 'en', `/bookings/${BK_FOLIO}`);
    await page.waitForSelector('h1');
    await page.waitForSelector('.folio-win', { timeout: 10_000 });

    // Target the first window (= WIN_A since we preferred single-window bookings).
    const firstWin = page.locator('.folio-win').first();
    const chargeBtn = firstWin.getByRole('button', { name: labels.en.charge, exact: true });
    await expect(chargeBtn).toBeVisible();
    await chargeBtn.click();

    // Form renders inside the window.
    const form = firstWin.locator('form').first();
    await expect(form).toBeVisible({ timeout: 5_000 });

    await form.locator('select[name="codeId"]').selectOption(chargeCode.id);
    await form.locator('input[name="amount"]').fill('1000');
    await form.locator('input[name="description"]').fill('audit-charge');

    const [postResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/bookings/${BK_FOLIO}/folio/post`) &&
          r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      form.locator('button.btn.xs.primary[type="submit"]').click(),
    ]);
    testInfo.attach('post-charge-response', {
      body: `status=${postResp.status()}`,
      contentType: 'text/plain',
    });
    expect(postResp.status()).toBe(201);

    // UI refetches folio after a successful post; wait for a new row to appear in this window.
    await expect
      .poll(
        async () => {
          const f = await getFolio(BK_FOLIO);
          return f.transactions.filter((t) => t.folioWindowId === WIN_A).length;
        },
        { timeout: 10_000 },
      )
      .toBe(preRowCount + 1);

    const post = await getFolio(BK_FOLIO);
    const postWin = post.windows.find((w) => w.id === WIN_A);
    expect(postWin).toBeTruthy();
    // Balance on the target window rises by exactly the posted amount (no auto-tax on ADJ_ROOM).
    expect(postWin!.balance - (preWin?.balance ?? 0)).toBeCloseTo(1000, 5);

    await auditScreenshot(page, SECTION_ID, '02-post-charge', 'en');
  });

  test('03-post-payment: payment zeros remaining balance', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'en', 'mutation scenario runs only on en');

    // Precondition: BK_FOLIO balance == INITIAL_BALANCE + 1000 (after scenario 02).
    const pre = await getFolio(BK_FOLIO);
    const preWin = pre.windows.find((w) => w.id === WIN_A);
    expect(preWin).toBeTruthy();
    const outstanding = preWin!.balance;
    testInfo.attach('pre-payment-balance', {
      body: `win_a=${outstanding} total=${pre.balance}`,
      contentType: 'text/plain',
    });
    expect(outstanding).toBeGreaterThan(0);

    const payCode = await fetchTransactionCode('payment', 'PAY_CASH');
    testInfo.attach('payment-code-picked', {
      body: `${payCode.code} / ${payCode.id}`,
      contentType: 'text/plain',
    });

    await setLocaleAndGoto(page, 'en', `/bookings/${BK_FOLIO}`);
    await page.waitForSelector('h1');
    await page.waitForSelector('.folio-win', { timeout: 10_000 });

    const firstWin = page.locator('.folio-win').first();
    const paymentBtn = firstWin.getByRole('button', { name: labels.en.payment, exact: true });
    await expect(paymentBtn).toBeVisible();
    await paymentBtn.click();

    const form = firstWin.locator('form').first();
    await expect(form).toBeVisible({ timeout: 5_000 });

    await form.locator('select[name="codeId"]').selectOption(payCode.id);
    await form.locator('input[name="amount"]').fill(String(outstanding));

    const [payResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/bookings/${BK_FOLIO}/folio/payment`) &&
          r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      form.locator('button.btn.xs.primary[type="submit"]').click(),
    ]);
    testInfo.attach('post-payment-response', {
      body: `status=${payResp.status()}`,
      contentType: 'text/plain',
    });
    expect(payResp.status()).toBe(201);

    await expect
      .poll(async () => (await getFolio(BK_FOLIO)).balance, { timeout: 10_000 })
      .toBe(0);

    await auditScreenshot(page, SECTION_ID, '03-post-payment', 'en');
  });

  test('04-zero-balance-window: window.v.zero class present when balance reaches zero', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    // Under en, scenarios 02+03 have left BK_FOLIO.window_A at balance=0. Use it.
    // Under ru (mutations skipped), hunt for any booking whose first window is zero-balance;
    // if none exists, skip with a descriptive reason.
    let targetBookingId: string;
    if (locale === 'en') {
      // Sanity: balance should be 0 from scenario 03.
      const f = await getFolio(BK_FOLIO);
      const win = f.windows.find((w) => w.id === WIN_A);
      testInfo.attach('en-zero-precondition', {
        body: `win_a.balance=${win?.balance} total=${f.balance}`,
        contentType: 'text/plain',
      });
      expect(win?.balance).toBe(0);
      targetBookingId = BK_FOLIO;
    } else {
      // Scan checked_in bookings for any window with balance==0.
      const r = await fetch(
        `${API_URL}/api/bookings?propertyId=${GBH_PROPERTY_ID}&status=checked_in&limit=20`,
      );
      if (!r.ok) throw new Error(`GET /bookings failed: ${r.status}`);
      const page2 = (await r.json()) as { data: { id: string }[] };
      let found: string | null = null;
      for (const b of page2.data ?? []) {
        const f = await getFolio(b.id);
        if (f.windows.some((w) => w.balance === 0)) {
          found = b.id;
          break;
        }
      }
      testInfo.attach('ru-zero-window-candidate', {
        body: found ?? 'none',
        contentType: 'text/plain',
      });
      test.skip(
        found === null,
        'No checked_in booking with a zero-balance window found under ru (mutations are en-only)',
      );
      targetBookingId = found!;
    }

    await setLocaleAndGoto(page, locale, `/bookings/${targetBookingId}`);
    await page.waitForSelector('h1');
    await page.waitForSelector('.folio-win', { timeout: 10_000 });

    // At least one window must have `.v.zero` in its .totals balance cell.
    const zeroBalanceCount = await page.locator('.folio-win .totals .v.zero').count();
    testInfo.attach('zero-balance-class-count', {
      body: String(zeroBalanceCount),
      contentType: 'text/plain',
    });
    expect(zeroBalanceCount).toBeGreaterThanOrEqual(1);

    // Observational: whether empty-transactions state ("No transactions" text) is visible in any window.
    const emptyTextCount = await page
      .getByText(labels[locale].noTransactions, { exact: true })
      .count();
    testInfo.attach('empty-state-count', {
      body: String(emptyTextCount),
      contentType: 'text/plain',
    });

    await auditScreenshot(page, SECTION_ID, '04-zero-balance-window', locale);
  });

  test('05-positive-balance-highlight: .totals .v.pos class present when balance > 0', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';

    // BK_POS is a checked_in booking with balance>0, distinct from BK_FOLIO.
    await setLocaleAndGoto(page, locale, `/bookings/${BK_POS}`);
    await page.waitForSelector('h1');
    await page.waitForSelector('.folio-win', { timeout: 10_000 });

    const posCount = await page.locator('.folio-win .totals .v.pos').count();
    testInfo.attach('positive-balance-class-count', {
      body: String(posCount),
      contentType: 'text/plain',
    });
    expect(posCount).toBeGreaterThanOrEqual(1);

    // "Booking total" card present with the aggregate due line.
    await expect(page.getByText(labels[locale].totalBooking).first()).toBeVisible();

    await auditScreenshot(page, SECTION_ID, '05-positive-balance-highlight', locale);
  });
});
