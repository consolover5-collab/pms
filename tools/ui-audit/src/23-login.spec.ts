/**
 * Section 23 — Login (/login)
 *
 * STATUS: ok — login page renders, admin/admin123 succeeds (302 → /), wrong
 * credentials surface an inline error and the URL stays on /login. No
 * pms_session cookie is issued on failure.
 *
 * Logged-OUT flow. Unlike every other audit spec, we CANNOT use
 * `setLocaleAndGoto` (which calls `loginAsAdmin` first), because the login
 * page redirects authenticated users to `/` via auth-provider.tsx:65. We use
 * a local `gotoLoggedOut` helper that sets the locale cookie + navigates, but
 * skips the login POST.
 *
 * Scenario isolation strategy:
 *   Each scenario runs in its own Playwright test, and Playwright gives each
 *   test a fresh `context` by default (see playwright.config.ts — no shared
 *   storageState is set). So each test starts cookieless. Scenario 02
 *   (happy-login) does set `pms_session`, but that cookie dies with the
 *   context at test end and never leaks into scenario 03. We still call
 *   `page.context().clearCookies()` defensively at the top of each test to
 *   make the contract explicit in the spec text.
 *
 * Source references (verified 2026-04-22):
 *   - apps/web/src/app/login/page.tsx — form (username, password, submit)
 *     + inline error div with role="alert" and data-testid="login-error-alert"
 *   - apps/web/src/components/auth-provider.tsx:36-57 — useEffect checks
 *     /api/auth/me on mount; if 401 and pathname !== /login → redirects to
 *     /login. If logged in and pathname === /login → redirects to /.
 *   - apps/web/src/components/auth-provider.tsx:70-87 — login() POSTs to
 *     /api/auth/login; on success router.replace("/"); on failure returns
 *     err.error (from API, English-only).
 *   - apps/api/src/routes/auth.ts:12-62 — POST /api/auth/login. Same error
 *     text "Invalid username or password" for both unknown-username AND
 *     wrong-password paths (no user enumeration — good). Sets `pms_session`
 *     cookie on success; httpOnly, sameSite=lax, 24h maxAge.
 *   - apps/api/src/routes/auth.ts — no CSRF token is issued or checked.
 *     Login is an unauthenticated POST accepting a JSON body. SameSite=lax
 *     on the session cookie is the only defense.
 *
 * i18n observations:
 *   - Only 4 login.* keys exist in {ru,en}.ts:
 *     login.username, login.password, login.signIn, login.signingIn.
 *   - The inline error string comes from the API (err.error) as PLAINTEXT
 *     ENGLISH regardless of the UI locale:
 *     apps/api/src/routes/auth.ts:32 returns "Invalid username or password".
 *     This is an i18n gap on the error path but NOT filed as a new bug for
 *     this section — Batch-D already filed several "error messages leak
 *     English" bugs (e.g. BUG-010 family) and the pattern is a systemic
 *     backend-owned one. Documented in YAML as a known limitation.
 *
 * Scenarios:
 *   01-load (ru + en): logged-out navigate to /login; form renders with
 *     username input, password input, submit button; correct localised
 *     labels/button text.
 *   02-happy-login (ru + en): fill admin/admin123; click submit; URL changes
 *     to "/"; pms_session cookie present on the context.
 *   03-invalid-credentials (ru + en): fill admin/wrong; click submit;
 *     role="alert" error message visible with API's plaintext English text;
 *     URL stays on /login; NO pms_session cookie set.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  API_URL,
  WEB_URL,
  auditScreenshot,
  registerSectionHooks,
} from './shared.ts';

const SECTION_ID = '23-login';
const ROUTE = '/login';

const UI_TIMEOUT = 10_000;
const NAV_TIMEOUT = 10_000;

/**
 * Local helper — sets the locale cookie then goes to the route WITHOUT
 * logging in first. Do NOT promote this to shared.ts: every other spec
 * depends on being pre-authenticated, so shared.ts bundles the login into
 * `setLocaleAndGoto`. The login spec is the exception.
 */
async function gotoLoggedOut(
  page: Page,
  locale: 'ru' | 'en',
  urlPath: string,
): Promise<void> {
  // Defensive cookie clear — kills any stray session from prior tests even
  // though Playwright already gives us a fresh context per test.
  await page.context().clearCookies();
  await page.context().addCookies([{ name: 'locale', value: locale, url: WEB_URL }]);
  await page.goto(urlPath);
  await page.waitForLoadState('networkidle');
}

test.describe('23 login', () => {
  test.describe.configure({ mode: 'serial' });

  registerSectionHooks(SECTION_ID);

  // ── Scenario 01: load (ru + en) ──────────────────────────────────────────
  test(
    '01-load: form renders with username, password, submit (logged out)',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await gotoLoggedOut(page, locale, ROUTE);

      // Page wrapper
      await expect(page.getByTestId('login-page')).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(page.getByTestId('login-form')).toBeVisible({ timeout: UI_TIMEOUT });

      // Fields — testid + accessible-by-label
      const usernameInput = page.getByTestId('login-username-input');
      const passwordInput = page.getByTestId('login-password-input');
      const submitButton = page.getByTestId('login-submit-button');

      await expect(usernameInput).toHaveCount(1);
      await expect(passwordInput).toHaveCount(1);
      await expect(submitButton).toHaveCount(1);

      await expect(usernameInput).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(passwordInput).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(submitButton).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(submitButton).toBeEnabled();

      // Password input must be type=password (masked)
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Localised labels + button text
      if (locale === 'en') {
        await expect(page.getByTestId('login-username-label')).toHaveText('Username');
        await expect(page.getByTestId('login-password-label')).toHaveText('Password');
        await expect(submitButton).toHaveText('Sign In');
      } else {
        await expect(page.getByTestId('login-username-label')).toHaveText('Логин');
        await expect(page.getByTestId('login-password-label')).toHaveText('Пароль');
        await expect(submitButton).toHaveText('Войти');
      }

      // No error alert rendered on fresh load
      await expect(page.getByTestId('login-error-alert')).toHaveCount(0);

      // No pms_session cookie on a fresh load
      const cookiesBefore = await page.context().cookies();
      expect(cookiesBefore.find((c) => c.name === 'pms_session')).toBeUndefined();

      await auditScreenshot(page, SECTION_ID, '01-load', locale);
    },
  );

  // ── Scenario 02: happy-login (ru + en) ───────────────────────────────────
  test(
    '02-happy-login: admin/admin123 submits, redirects to /, pms_session cookie set',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await gotoLoggedOut(page, locale, ROUTE);
      await expect(page.getByTestId('login-form')).toBeVisible({ timeout: UI_TIMEOUT });

      // Fill + submit
      await page.getByTestId('login-username-input').fill('admin');
      await page.getByTestId('login-password-input').fill('admin123');

      // auth-provider.login() does a router.replace("/") on 2xx — wait for URL
      // change. Don't wait for networkidle first: the POST is in-flight.
      await Promise.all([
        page.waitForURL((url) => url.pathname === '/', { timeout: NAV_TIMEOUT }),
        page.getByTestId('login-submit-button').click(),
      ]);

      // Assert URL is root
      expect(new URL(page.url()).pathname).toBe('/');

      // Assert pms_session cookie present on the context. It's httpOnly so
      // Playwright can still read it via context.cookies() (document.cookie
      // can't).
      const cookies = await page.context().cookies();
      const session = cookies.find((c) => c.name === 'pms_session');
      expect(session, 'pms_session cookie must be set after successful login').toBeDefined();
      expect(session?.httpOnly).toBe(true);
      expect(session?.value && session.value.length > 0).toBe(true);

      await auditScreenshot(page, SECTION_ID, '02-happy-login', locale);
    },
  );

  // ── Scenario 03: invalid-credentials (ru + en) ───────────────────────────
  test(
    '03-invalid-credentials: admin/wrong surfaces error alert, stays on /login, no session cookie',
    async ({ page }, testInfo) => {
      const locale = testInfo.project.name as 'ru' | 'en';

      await gotoLoggedOut(page, locale, ROUTE);
      await expect(page.getByTestId('login-form')).toBeVisible({ timeout: UI_TIMEOUT });

      // Fill with bad password
      await page.getByTestId('login-username-input').fill('admin');
      await page.getByTestId('login-password-input').fill('wrong-password');

      // Wait for the POST response (status 401 expected) BEFORE checking the
      // DOM. If we race on the alert alone a slow response can make this
      // flaky.
      const [loginResp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
          { timeout: NAV_TIMEOUT },
        ),
        page.getByTestId('login-submit-button').click(),
      ]);

      expect(loginResp.status()).toBe(401);

      // Error alert visible
      const alert = page.getByTestId('login-error-alert');
      await expect(alert).toBeVisible({ timeout: UI_TIMEOUT });
      await expect(alert).toHaveAttribute('role', 'alert');
      // API returns English text regardless of UI locale (see spec header).
      await expect(alert).toHaveText('Invalid username or password');

      // URL is still /login (no redirect)
      expect(new URL(page.url()).pathname).toBe('/login');

      // No pms_session cookie set
      const cookies = await page.context().cookies();
      expect(cookies.find((c) => c.name === 'pms_session')).toBeUndefined();

      await auditScreenshot(page, SECTION_ID, '03-invalid-credentials', locale);
    },
  );

  // ── Scenario 04 (en-only evidence): same error text for unknown username ──
  // Confirms the API does NOT leak whether a username exists. Direct API
  // call; uses the WEB_URL proxy exactly as the UI does.
  test(
    '04-no-user-enumeration: unknown username and wrong password return identical error (en-only evidence)',
    async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'en', 'API contract check runs once');

      await page.context().clearCookies();

      const unknownUser = await page.context().request.post(`${WEB_URL}/api/auth/login`, {
        data: { username: 'does-not-exist-xyz', password: 'whatever' },
        headers: { 'content-type': 'application/json' },
        failOnStatusCode: false,
      });
      const wrongPass = await page.context().request.post(`${WEB_URL}/api/auth/login`, {
        data: { username: 'admin', password: 'wrong-password' },
        headers: { 'content-type': 'application/json' },
        failOnStatusCode: false,
      });

      expect(unknownUser.status()).toBe(401);
      expect(wrongPass.status()).toBe(401);

      const unknownBody = await unknownUser.json();
      const wrongBody = await wrongPass.json();

      // Both return the same code AND the same error string — no enumeration.
      expect(unknownBody).toMatchObject({ error: 'Invalid username or password', code: 'INVALID_CREDENTIALS' });
      expect(wrongBody).toMatchObject({ error: 'Invalid username or password', code: 'INVALID_CREDENTIALS' });

      testInfo.attach('no-enumeration-evidence', {
        body: JSON.stringify({ unknownUser: unknownBody, wrongPass: wrongBody }, null, 2),
        contentType: 'application/json',
      });

      // API_URL reference — silence unused-import lint if we ever drop the
      // direct call. Kept because future auth hardening might want us to call
      // the API directly rather than through the web proxy.
      void API_URL;
    },
  );
});
