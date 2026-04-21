# UI Audit Pilot — Section 03 (booking-create) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Pilot is monolithic per spec §6.1 — run in a single Opus session, no subagent dispatch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute section `03 booking-create` of the UI audit end-to-end in one autonomous Opus session and produce a retrospective that corrects the methodology before full-run.

**Architecture:** New pnpm workspace package `tools/ui-audit/` hosts the Playwright harness and specs. Audit reports (YAML, screenshots, bugs, retro) live in `docs/ui-audit/`. One Playwright spec per section; pilot writes the first one (`03-booking-create.spec.ts`) as a template for future sections. All work happens in the main session — no subagents.

**Tech Stack:** TypeScript, @playwright/test (headless Chromium), Node 20, pnpm workspaces. Runtime env: existing PMS stack (API on :3001, Web on :3000, Postgres behind the API).

**Source spec:** `docs/superpowers/specs/2026-04-21-ui-audit-execution-design.md`

**Location reconciliation note:** Spec §4.1 puts the Playwright spec in `tools/ui-audit/src/03-booking-create.spec.ts`; spec §12 has a stale path `docs/ui-audit/scripts/…` inherited from the original audit plan. This plan uses `tools/ui-audit/src/` as canonical. The empty `docs/ui-audit/scripts/` directory is left alone (may be removed later as a retro item).

---

## File Structure

### Created (pilot)
- `tools/ui-audit/package.json` — workspace package definition
- `tools/ui-audit/tsconfig.json` — extends root base config
- `tools/ui-audit/playwright.config.ts` — ru+en projects, headless, screenshots → docs/
- `tools/ui-audit/.gitignore` — playwright-report/, test-results/, node_modules/
- `tools/ui-audit/src/shared.ts` — helpers (screenshot path, console/network error collectors, constants)
- `tools/ui-audit/src/fixtures.ts` — API seed helpers (used by pre-flight if data short)
- `tools/ui-audit/src/03-booking-create.spec.ts` — the audit spec for section 03
- `docs/ui-audit/features/03-booking-create.yml` — audit report for section 03
- `docs/ui-audit/screenshots/03-booking-create-*.png` — step screenshots (both locales)
- `docs/ui-audit/pilot-retro.md` — retrospective at end of pilot

### Modified
- `pnpm-workspace.yaml` — add `tools/*` to packages
- `docs/ui-audit/bugs.yml` — append any bugs found (if none, unchanged)
- `docs/ui-audit/index.yml` — set `generated`, `app_commit`, status+bugs for section 03, update `totals`
- `docs/backlog.json` — append any new bugs (if none, unchanged)

### Potentially modified (C3 unblocker fixes only)
- Any file under `apps/web/src/app/bookings/new/` or related i18n — only if a bug blocks a scenario from completing per spec §8.

---

## Task 0: Pre-flight verification

**Purpose:** confirm the environment can support an audit before touching anything. Abort early and cleanly if not.

**Files:** none created; only reads + DB snapshot.

- [ ] **Step 1: Export property id to shell var**

```bash
export GBH_ID=ff1d9135-dfb9-4baa-be46-0e739cd26dad
echo "GBH_ID=$GBH_ID"
```

Expected: line echoes the uuid.

- [ ] **Step 2: API health check**

Run: `curl -sf http://localhost:3001/health | jq`
Expected: JSON with `"status": "ok"` (or equivalent healthy shape).
On fail: consult `/home/oci/.claude/projects/-home-oci-pms/memory/deploy_procedure.md`, attempt one restart, then retry. If still failing → stop, commit `docs(audit): pilot blocked — pre-flight failure` (see Task 11 fallback).

- [ ] **Step 3: Web reachable**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
Expected: `200`.
Failure handling same as Step 2.

- [ ] **Step 4: GBH property exists**

Run:
```bash
curl -sf http://localhost:3001/api/properties | jq --arg id "$GBH_ID" '.[] | select(.id==$id) | {id, name, code}'
```
Expected: one JSON object with `"code": "GBH"` and matching id.
On fail: stop, no auto-remediation (missing seed is a blocker).

- [ ] **Step 5: Open business date exists**

Run:
```bash
curl -sf "http://localhost:3001/api/business-dates?propertyId=$GBH_ID&status=open" | jq 'length'
```
Expected: `>= 1`.
On fail: one remediation attempt via POST to open today, then recheck. If remediation shape is unknown from API → stop and record in retro.

- [ ] **Step 6: Rate plans exist**

Run:
```bash
curl -sf "http://localhost:3001/api/rate-plans?propertyId=$GBH_ID" | jq '[.[] | select(.active==true or .isActive==true)] | length'
```
Expected: `>= 1`. (The jq selector tolerates either property naming; if both fail, run `jq 'length'` and manually verify ≥1 active.)
On fail: one remediation attempt via POST a default plan (shape from API schema), else stop.

- [ ] **Step 7: Room types exist**

Run:
```bash
curl -sf "http://localhost:3001/api/room-types?propertyId=$GBH_ID" | jq 'length'
```
Expected: `>= 1`.
On fail: stop (missing seed).

- [ ] **Step 8: Guest profiles exist**

Run:
```bash
curl -sf "http://localhost:3001/api/profiles?type=guest" | jq 'length'
```
Expected: `>= 3`.
On fail: one remediation attempt creating 3 fixture guests via POST; else stop.

- [ ] **Step 9: Database snapshot**

Run:
```bash
SNAP=/tmp/pms-pilot-snapshot-$(date +%Y%m%d-%H%M).sql
pg_dump -h localhost -U pms pms > "$SNAP" && echo "snapshot: $SNAP" && ls -la "$SNAP"
```
(If the project uses different creds/db names, read `.env` or `docker-compose.yml` in repo root to confirm; adjust the command accordingly.)
Expected: file exists, size > 10 KB.
On fail: two attempts (once adjusting creds from env), else stop.

- [ ] **Step 10: Auth-disabled sanity check**

Run:
```bash
curl -s -o /dev/null -w "%{redirect_url} %{http_code}\n" http://localhost:3000/bookings/new
```
Expected: HTTP 200 and no redirect (empty redirect_url). If it redirects to `/login`, BUG-001 assumption has reverted → stop, record finding in retro.

- [ ] **Step 11: Record pre-flight results**

Write a scratch note in memory (do not commit) listing the snapshot path, GBH_ID, counts of rate plans / room types / guests, open business date value. These are input data for Task 5.

---

## Task 1: Scaffold `tools/ui-audit/` package

**Purpose:** create the Playwright harness as a new pnpm workspace package. Independent of any specific section; reusable for all 24 later.

**Files:**
- Create: `tools/ui-audit/package.json`
- Create: `tools/ui-audit/tsconfig.json`
- Create: `tools/ui-audit/playwright.config.ts`
- Create: `tools/ui-audit/.gitignore`
- Create: `tools/ui-audit/src/shared.ts`
- Create: `tools/ui-audit/src/fixtures.ts`
- Create: `tools/ui-audit/src/smoke.spec.ts` (temporary smoke test, removed before commit)
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Create directory skeleton**

```bash
mkdir -p tools/ui-audit/src
ls -la tools/ui-audit/
```
Expected: empty `src/` directory shown.

- [ ] **Step 2: Write `tools/ui-audit/package.json`**

```json
{
  "name": "@pms/ui-audit",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "test:ru": "playwright test --project=ru",
    "test:en": "playwright test --project=en",
    "install-browsers": "playwright install chromium"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 3: Write `tools/ui-audit/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts", "playwright.config.ts"]
}
```

If `tsconfig.base.json` extends break strictness or clash with `noEmit`, fall back to a standalone config with the options above and no `extends`.

- [ ] **Step 4: Write `tools/ui-audit/.gitignore`**

```
node_modules/
playwright-report/
test-results/
.playwright/
```

- [ ] **Step 5: Write `tools/ui-audit/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webUrl = process.env.AUDIT_WEB_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './src',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['line']],
  use: {
    baseURL: webUrl,
    headless: true,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'ru',
      use: { ...devices['Desktop Chrome'], locale: 'ru-RU' },
    },
    {
      name: 'en',
      use: { ...devices['Desktop Chrome'], locale: 'en-US' },
    },
  ],
  outputDir: path.resolve(__dirname, './test-results'),
});
```

Note: `screenshot: 'off'` globally — audit screenshots are taken manually inside specs via `auditScreenshot()` helper. This keeps control over file naming and location.

- [ ] **Step 6: Write `tools/ui-audit/src/shared.ts`**

```ts
import { Page, test as base } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SCREENSHOTS_DIR = path.resolve(__dirname, '../../../docs/ui-audit/screenshots');
export const API_URL = process.env.AUDIT_API_URL ?? 'http://localhost:3001';
export const GBH_PROPERTY_ID = 'ff1d9135-dfb9-4baa-be46-0e739cd26dad';

/**
 * Take a full-page screenshot into docs/ui-audit/screenshots/.
 * Returns the relative filename for YAML references.
 */
export async function auditScreenshot(
  page: Page,
  sectionId: string,
  step: string,
  locale: 'ru' | 'en',
): Promise<string> {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const filename = `${sectionId}-${step}-${locale}.png`;
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, filename),
    fullPage: true,
  });
  return filename;
}

export type ConsoleError = { type: 'console' | 'pageerror'; text: string };
export type NetworkError = { status: number; method: string; url: string };

export function wireErrorCollectors(page: Page): {
  console: ConsoleError[];
  network: NetworkError[];
} {
  const consoleErrs: ConsoleError[] = [];
  const networkErrs: NetworkError[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrs.push({ type: 'console', text: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    consoleErrs.push({ type: 'pageerror', text: err.message });
  });
  page.on('response', (res) => {
    const status = res.status();
    if (status >= 400) {
      networkErrs.push({ status, method: res.request().method(), url: res.url() });
    }
  });

  return { console: consoleErrs, network: networkErrs };
}

/** Helper to wait for the API to respond healthy. */
export async function waitForApi(attempts = 10): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(`${API_URL}/health`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API not healthy after ${attempts} attempts`);
}
```

- [ ] **Step 7: Write `tools/ui-audit/src/fixtures.ts`**

```ts
import { API_URL, GBH_PROPERTY_ID } from './shared.ts';

/**
 * Minimal fixture helpers. Used by pre-flight remediation when seed data is short.
 * Each function is idempotent-ish: it creates only if counts are insufficient.
 */

export async function ensureGuests(minCount = 3): Promise<number> {
  const res = await fetch(`${API_URL}/api/profiles?type=guest`);
  const list = (await res.json()) as unknown[];
  if (list.length >= minCount) return list.length;

  const toCreate = minCount - list.length;
  const names = [
    { firstName: 'Audit', lastName: 'Fixture-A' },
    { firstName: 'Audit', lastName: 'Fixture-B' },
    { firstName: 'Audit', lastName: 'Fixture-C' },
  ];
  for (let i = 0; i < toCreate; i++) {
    const body = {
      ...names[i],
      type: 'guest',
      email: `audit-fixture-${Date.now()}-${i}@example.test`,
    };
    const r = await fetch(`${API_URL}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      throw new Error(`POST /api/profiles failed: ${r.status} ${await r.text()}`);
    }
  }
  return minCount;
}

// Extend with ensureRatePlan, ensureBusinessDate if pre-flight needs them.
// Keep them thin — actual shape comes from API schema discovered at runtime.
```

- [ ] **Step 8: Write `tools/ui-audit/src/smoke.spec.ts` (temporary, removed in Step 12)**

```ts
import { test, expect } from '@playwright/test';

test('smoke: web baseURL reachable', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
});
```

- [ ] **Step 9: Register the package in `pnpm-workspace.yaml`**

Current content:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```
Append `tools/*`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```
(If `tools/*` already matches because `tools/mcp-server` exists but isn't in the workspace yet, this addition picks up both — verify with `pnpm list -r --depth 0 | grep '@pms/'` after Step 10.)

- [ ] **Step 10: Install dependencies**

```bash
pnpm install
```
Expected: new package `@pms/ui-audit` shows up; playwright pulls down; no errors.
Verify:
```bash
pnpm list -r --depth 0 | grep '@pms/ui-audit'
```
Expected: one line listing the package.

- [ ] **Step 11: Install Chromium browser**

```bash
pnpm --filter @pms/ui-audit install-browsers
```
Expected: chromium downloaded (one-time, may take 1–2 minutes). On completion, it prints browser path.
On fail (network, permissions, disk): retry once. If still failing → stop, retro, write failure details.

- [ ] **Step 12: Run smoke test**

```bash
pnpm --filter @pms/ui-audit test -- src/smoke.spec.ts
```
Expected: two tests pass (ru and en projects both). Output contains `2 passed`.
On fail: debug harness (not section yet); do not proceed until green.

- [ ] **Step 13: Delete smoke spec**

```bash
rm tools/ui-audit/src/smoke.spec.ts
ls tools/ui-audit/src/
```
Expected: `src/` contains `shared.ts`, `fixtures.ts`.

- [ ] **Step 14: Commit scaffolding**

```bash
git add tools/ui-audit/ pnpm-workspace.yaml pnpm-lock.yaml
git status
git commit -m "$(cat <<'EOF'
feat(tools): scaffold tools/ui-audit package with Playwright

New pnpm workspace package hosting the Playwright harness for the
UI audit. Config uses headless Chromium with ru-RU and en-US locale
projects. Audit screenshots are written into docs/ui-audit/screenshots/
via a shared helper; harness lives separately from report output.

Harness-only commit — section specs land in subsequent commits.
EOF
)"
```
Expected: commit created; pre-commit hooks pass.

---

## Task 2: Read `/bookings/new` source and enumerate scenarios

**Purpose:** understand the real UI before writing the spec, so scenarios reflect actual behavior not assumptions.

**Files:** none created; only reads.

- [ ] **Step 1: Read the page**

Read `apps/web/src/app/bookings/new/page.tsx`. Note:
- Imported components (form, guest picker, rate matrix, etc.)
- Client/server split
- Query keys / API calls

- [ ] **Step 2: Follow into form components**

Read any `BookingForm`, `GuestPicker`, `RateMatrix` (or similarly named) components in the same tree or under `apps/web/src/components/`.

- [ ] **Step 3: Inspect i18n strings**

Open `apps/web/src/i18n/dictionaries/ru.ts` (or equivalent path — search via `grep -r "booking" apps/web/src/i18n/` if unclear) and the `en` counterpart. Extract exact label strings for:
- Form header
- Field labels (guest, room type, check-in, check-out, adults, children, rate plan, rate amount, notes)
- Submit / Cancel / New Guest button labels
- Inline validation error messages (dates, required)
- Rate-unavailable / room-unavailable error messages (if any)

Store the exact strings in memory for Task 3 (selectors may use them or accessible labels).

- [ ] **Step 4: Confirm the scenario list**

Fixed list from spec §6.1 step 4 (adjust only if source reveals a scenario is impossible — document why in retro, do not silently drop):

1. `empty-submit` — open `/bookings/new`, click submit immediately. Expect inline validation on 4 required fields.
2. `happy-path` — fill all required fields with valid data, submit. Expect redirect to `/bookings/<id>` with status `confirmed`.
3. `checkout-before-checkin` — set checkOut ≤ checkIn, submit. Expect date-range error.
4. `room-unavailable` — pick a roomId that's already booked for overlapping dates. Expect error (message or response code).
5. `inline-new-guest` — use the "Новый гость / New Guest" flow, create a guest inline, continue booking creation.
6. `rate-plan-auto-rate` — select rate plan + room type, verify `rateAmount` field gets populated.

If a scenario cannot be executed (e.g., no "new guest" button exists in code) → remove from the list and document in retro's Methodology section ("Scenarios impossible in current UI").

---

## Task 3: Write the Playwright spec

**Purpose:** one spec file with one `test.describe` and one `test.step` per scenario, in both locales (via projects), with screenshots on every step.

**Files:**
- Create: `tools/ui-audit/src/03-booking-create.spec.ts`

- [ ] **Step 1: Write the spec skeleton**

```ts
import { test, expect, type Page } from '@playwright/test';
import {
  auditScreenshot,
  wireErrorCollectors,
  API_URL,
  GBH_PROPERTY_ID,
  type ConsoleError,
  type NetworkError,
} from './shared.ts';

const SECTION_ID = '03-booking-create';

// Collected across the test run for YAML population. Playwright globalThis survives per worker.
const errorsByProject: Record<string, { console: ConsoleError[]; network: NetworkError[] }> = {};

test.describe('03 booking-create', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const errors = wireErrorCollectors(page);
    errorsByProject[testInfo.project.name] ??= { console: [], network: [] };
    // attach live references so they accumulate
    errorsByProject[testInfo.project.name].console = errors.console;
    errorsByProject[testInfo.project.name].network = errors.network;
  });

  test.afterAll(async () => {
    // Write collected errors to a JSON sidecar for Task 4/5 to read.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const out = path.resolve(
      __dirname,
      `./test-results/${SECTION_ID}-errors.json`,
    );
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(errorsByProject, null, 2));
  });

  test('empty-submit: required fields validated', async ({ page }, testInfo) => {
    const locale = testInfo.project.name as 'ru' | 'en';
    await page.goto('/bookings/new');
    await auditScreenshot(page, SECTION_ID, '01-empty-form', locale);

    // Click submit without filling anything. Choose selector based on Task 2 observations:
    //   - if there's a distinct button: page.getByRole('button', { name: /create|создать/i })
    //   - if it's a <form> submit: page.locator('form').getByRole('button').first()
    const submit = page.getByRole('button', { name: locale === 'ru' ? /создать/i : /create/i });
    await submit.click();

    await auditScreenshot(page, SECTION_ID, '02-empty-validation', locale);

    // Assert: at least 4 fields show validation. Assertion is loose on purpose —
    // exact error-element markup depends on form library. Capture-what-you-see.
    const errorMessages = page.locator('[role="alert"], [data-testid*="error"]');
    await expect(errorMessages).toHaveCount(4, { timeout: 2_000 }).catch(() => {
      // If count mismatches, just screenshot — this is an observation, not a hard assertion.
      // The YAML will record actual count vs expected.
    });
  });

  // Add one test per scenario (Step 2 below). Reuse the pattern:
  //   1. page.goto
  //   2. auditScreenshot at each meaningful UI state
  //   3. interact
  //   4. auditScreenshot again
  //   5. assertion (loose)
});
```

Note: selectors use `getByRole` + accessible-name regexes to be locale-neutral. Where the UI depends on exact strings read in Task 2 Step 3, replace placeholders with actual strings.

- [ ] **Step 2: Add scenarios 2–6 as additional `test(...)` blocks**

One per scenario. Example pattern for `happy-path`:

```ts
test('happy-path: create confirmed booking', async ({ page }, testInfo) => {
  const locale = testInfo.project.name as 'ru' | 'en';
  await page.goto('/bookings/new');

  // Fill guest — combobox or modal flow from Task 2 observations.
  // If combobox:
  const guest = page.getByRole('combobox', { name: locale === 'ru' ? /гость/i : /guest/i });
  await guest.click();
  await page.getByRole('option').first().click();

  // Dates — use native date input or date picker popup based on observations.
  const checkIn = page.getByLabel(locale === 'ru' ? /дата заезда/i : /check-in date/i);
  await checkIn.fill('2026-05-01');
  const checkOut = page.getByLabel(locale === 'ru' ? /дата выезда/i : /check-out date/i);
  await checkOut.fill('2026-05-03');

  // Room type
  const roomType = page.getByRole('combobox', {
    name: locale === 'ru' ? /тип номера/i : /room type/i,
  });
  await roomType.click();
  await page.getByRole('option').first().click();

  // Adults defaults to 1 usually; leave unless required-red.

  await auditScreenshot(page, SECTION_ID, '03-happy-filled', locale);

  // Submit
  await page.getByRole('button', { name: locale === 'ru' ? /создать/i : /create/i }).click();

  // Expect redirect to /bookings/<uuid>
  await page.waitForURL(/\/bookings\/[0-9a-f-]+$/);
  await auditScreenshot(page, SECTION_ID, '04-happy-result', locale);

  // Soft-assert status badge says "confirmed" (either language)
  const status = page.getByText(/confirmed|подтверждена/i).first();
  await expect(status).toBeVisible({ timeout: 5_000 });
});
```

Apply the same pattern (goto → screenshot → interact → screenshot → assert/observe) to:
- `checkout-before-checkin` (fill dates reversed, expect error element; screenshot showing error text and locale)
- `room-unavailable` (pick a known-occupied room; may need an API query to find one)
- `inline-new-guest` (click "new guest" button, fill modal, submit, see guest selected in parent form)
- `rate-plan-auto-rate` (select plan + type, verify rateAmount input becomes populated with non-empty value; screenshot before & after)

If selectors from Task 2 differ from the patterns above — use the actual ones. The pattern is stable; the details aren't.

- [ ] **Step 3: Run just this spec in ru**

```bash
pnpm --filter @pms/ui-audit test:ru -- src/03-booking-create.spec.ts
```
Expected: 6 scenarios run, output tells which pass/fail. Regardless of pass/fail, screenshots should be in `docs/ui-audit/screenshots/` with `-ru` suffix.
On selector/flake fail: fix selectors, rerun. Do NOT change assertions to pass — that defeats the audit. If a scenario reveals a bug, let the assertion fail and proceed (this becomes a bug entry in Task 6).

- [ ] **Step 4: Run in en**

```bash
pnpm --filter @pms/ui-audit test:en -- src/03-booking-create.spec.ts
```
Expected: same scenarios run in en locale; `-en` screenshots present.

- [ ] **Step 5: Verify artifacts exist**

```bash
ls docs/ui-audit/screenshots/03-booking-create-*.png | wc -l
```
Expected: at least 12 files (6 scenarios × 2 screenshots average × 2 locales = ~24 typically; minimum ~12 if each scenario has just before/after).

```bash
cat tools/ui-audit/test-results/03-booking-create-errors.json | jq '{ru: (.ru | {console: (.console|length), network: (.network|length)}), en: (.en | {console: (.console|length), network: (.network|length)})}'
```
Expected: JSON with error counts per locale. (Record these numbers for Task 5.)

---

## Task 4: Handle any unblocker fixes (C3 policy)

**Purpose:** if a scenario is blocked by a fixable UI/code bug, apply the minimal fix and retry — per spec §8. Skip this task entirely if nothing is blocked.

**Decision rule:** a fix is allowed if and only if without it, the scenario cannot reach its end state at all (e.g., page 500s, a required element is missing from the DOM, an i18n key renders as `[object Object]`). Cosmetic issues, wrong-locale labels that don't block completion, missing optional fields → document only (Task 6).

- [ ] **Step 1: Identify unblocker candidates**

For each failing scenario ask: "Did I fail because I didn't write the test right, or because the app is broken?" Only the latter is a candidate for a fix.

- [ ] **Step 2: Apply the smallest possible fix**

Edit the specific file(s). Keep the diff small — one behavior, one commit.

- [ ] **Step 3: Re-run affected scenarios**

```bash
pnpm --filter @pms/ui-audit test:ru -- src/03-booking-create.spec.ts -g "<scenario name>"
pnpm --filter @pms/ui-audit test:en -- src/03-booking-create.spec.ts -g "<scenario name>"
```
Expected: scenario now passes (or at least progresses past the blocker).

- [ ] **Step 4: Retake any affected screenshots**

Automatic on re-run.

- [ ] **Step 5: Commit the fix separately**

```bash
git add <only the fixed files>
git commit -m "fix(<area>): <one-line summary of what was blocking the audit>"
```
Expected: atomic commit, hooks pass.

- [ ] **Step 6: Repeat if multiple unblockers**

Each fix = its own commit. Never batch.

- [ ] **Step 7: Critical-severity check**

If the blocker was a data-loss, auth-bypass, or silent-corruption issue — STOP. Do not fix. Proceed to Task 11's fallback commit (`docs(audit): pilot blocked — critical finding`) and jump to Task 12.

---

## Task 5: Populate `docs/ui-audit/features/03-booking-create.yml`

**Purpose:** turn the Playwright run + observations into the canonical YAML report.

**Files:**
- Create: `docs/ui-audit/features/03-booking-create.yml`

- [ ] **Step 1: Copy template**

```bash
cp docs/ui-audit/features/_template.yml docs/ui-audit/features/03-booking-create.yml
```

- [ ] **Step 2: Fill top-level metadata**

Open the new file and set:

```yaml
id: booking.create
title: "Создание бронирования"
route: /bookings/new
depends_on: [profile.exists, room-type.exists, rate-plan.exists, business-date.open]
locales_tested: [ru, en]
```

- [ ] **Step 3: Fill `ui` block from observed labels**

Using exact strings observed in Task 2 Step 3:

```yaml
ui:
  header:
    ru: "<observed ru header>"
    en: "<observed en header>"
  required_fields:
    - { key: guestProfileId, label_ru: "<observed>", label_en: "<observed>" }
    - { key: roomTypeId,     label_ru: "<observed>", label_en: "<observed>" }
    - { key: checkInDate,    label_ru: "<observed>", label_en: "<observed>" }
    - { key: checkOutDate,   label_ru: "<observed>", label_en: "<observed>" }
    - { key: adults,         label_ru: "<observed>", label_en: "<observed>" }
  optional_fields: [ratePlanId, rateAmount, roomId, guaranteeCode, paymentMethod, notes, children]
  buttons:
    submit: { ru: "<observed>", en: "<observed>" }
    cancel: { ru: "<observed>", en: "<observed>" }
    newGuest: { ru: "<observed>", en: "<observed>" }
```

Replace every `<observed>` with the actual string. If a field doesn't exist, remove its line; don't leave placeholders.

- [ ] **Step 4: Fill `steps` from scenarios**

One entry per scenario × per significant screenshot. Example for empty-submit:

```yaml
steps:
  - n: 1
    action: "открыть /bookings/new в locale=ru, форма отображена"
    expected: "форма видна, hint про обязательные поля присутствует"
    screenshot: 03-booking-create-01-empty-form-ru.png
    actual: "ok | <что фактически отличается>"
  - n: 2
    action: "попытаться submit с пустыми полями (ru)"
    expected: "inline validation на 4 required полях"
    screenshot: 03-booking-create-02-empty-validation-ru.png
    actual: "ok | <actual count, actual error markup>"
  # Repeat en counterparts with -en screenshots.
  # Continue for scenarios 2–6 (happy, checkout-before-checkin, room-unavailable, inline-new-guest, rate-plan-auto-rate).
```

`actual` field values: `"ok"` if matches expected exactly; otherwise a one-sentence description of what diverged, plus a reference to a `BUG-NNN` if one was created.

- [ ] **Step 5: Fill `edge_cases`**

```yaml
edge_cases:
  - name: "checkOut <= checkIn"
    steps: "установить даты задом наперёд, submit"
    expected: "валидация даёт ошибку, локализованную на текущую локаль"
    actual: "<observed>"
    bug: <BUG-NNN or null>
  - name: "занятая комната на выбранные даты"
    steps: "выбрать roomId уже забронированный на пересекающиеся даты"
    expected: "ошибка вроде ROOM_UNAVAILABLE / локализованное сообщение"
    actual: "<observed>"
    bug: <BUG-NNN or null>
```

- [ ] **Step 6: Fill `api_calls_observed`**

From Playwright response listener or by grep through HAR if available. Minimum:

```yaml
api_calls_observed:
  - { method: POST, path: /api/bookings, status: 201 }
  - { method: GET, path: /api/profiles, status: 200 }
  - { method: GET, path: /api/room-types, status: 200 }
  - { method: GET, path: /api/rate-plans, status: 200 }
```

Add any actually-observed 4xx/5xx calls explicitly.

- [ ] **Step 7: Fill `console_errors` and `network_errors`**

Read from `tools/ui-audit/test-results/03-booking-create-errors.json` (written by Task 3 Step 1).

```yaml
console_errors:
  - locale: ru
    text: "<exact error text>"
    occurred_during: "<scenario name>"
  # If empty, use: []
network_errors:
  - locale: ru
    method: POST
    url: /api/bookings
    status: 500
    occurred_during: "<scenario name>"
  # If empty, use: []
```

- [ ] **Step 8: Placeholders for `bugs`, `help_rewrite_hints`, `status`**

Leave as:
```yaml
bugs: []   # filled in Task 6
help_rewrite_hints:
  topic: bookings
  current: ""
  actual: ""
  rewrite: ""   # filled in Task 7
status: pending  # decided in Task 8
last_audited: null  # set in Task 8
screenshots_dir: docs/ui-audit/screenshots/
```

- [ ] **Step 9: Validate YAML**

```bash
node -e "const y=require('js-yaml'); y.load(require('fs').readFileSync('docs/ui-audit/features/03-booking-create.yml','utf8')); console.log('ok')"
```
(If `js-yaml` isn't installed at root, use `pnpm dlx js-yaml` or `python3 -c "import yaml; yaml.safe_load(open('docs/ui-audit/features/03-booking-create.yml'))"` — whichever is available.)
Expected: prints `ok` or exits 0 silently.
On syntax error: fix inline.

---

## Task 6: Triage bugs → `bugs.yml` + `backlog.json`

**Purpose:** every divergence from expected is either a bug to record or an ok-variance. Severity drives whether we halt.

**Files:**
- Modify: `docs/ui-audit/bugs.yml`
- Modify: `docs/backlog.json`
- Modify: `docs/ui-audit/features/03-booking-create.yml` (fill `bugs: [...]`)

- [ ] **Step 1: List all divergences from the run**

Walk through the spec run output and the YAML's `steps` and `edge_cases` `actual` fields. Anything not "ok" is a candidate bug.

- [ ] **Step 2: Assign severity**

Use spec §8 criteria:
- `critical` — data loss, auth bypass, financial miscalc, silent corruption. If found: STOP per Task 4 Step 7; do not complete this task.
- `high` — happy path breaks, 500 errors, JS exception preventing use.
- `medium` — localized-string missing in one locale, validation message wrong, UI hint outdated.
- `low` — cosmetic, misaligned label, unused field rendered.

- [ ] **Step 3: Assign ids**

Read `docs/ui-audit/bugs.yml` and `docs/backlog.json` to find the highest existing `BUG-NNN` id. Next id is `BUG-<N+1>`. If both files start empty, use `BUG-002` (BUG-001 is documented as "auth disabled" per memory).

- [ ] **Step 4: Append to `docs/ui-audit/bugs.yml`**

For each bug:

```yaml
- id: BUG-NNN
  severity: <critical|high|medium|low>
  feature: booking.create
  route: /bookings/new
  repro: |
    1. …
    2. …
    3. …
  expected: "<one line>"
  actual: "<one line>"
  evidence:
    - screenshots/03-booking-create-<step>-<locale>.png
  suggested_fix: "<one-line hint>"
  discovered: 2026-04-21
  status: open
```

- [ ] **Step 5: Append to `docs/backlog.json`**

Mirror each bug as a backlog entry matching existing format in that file. Read a few existing entries first to follow the exact schema; do not invent fields.

- [ ] **Step 6: Update `bugs: […]` in the feature YAML**

In `docs/ui-audit/features/03-booking-create.yml`, replace `bugs: []` with:
```yaml
bugs: [BUG-NNN, BUG-NNN+1, ...]
```

- [ ] **Step 7: Revalidate YAML**

Re-run the YAML load command from Task 5 Step 9.

---

## Task 7: Write `help_rewrite_hints`

**Purpose:** capture the delta between current help content and observed reality. This is the primary feedstock for the downstream help-rewrite.

**Files:**
- Modify: `docs/ui-audit/features/03-booking-create.yml` (fill `help_rewrite_hints`)

- [ ] **Step 1: Read current help for bookings**

Open `apps/web/src/app/help/[topic]/help-content.tsx` and locate the `bookings` topic section. Extract the existing prose verbatim.

- [ ] **Step 2: Compare to observed UI**

Note every instance where help text refers to a label, flow, or behavior that differs from observed reality. Typical delta types:
- Wrong button label (e.g., help says "+ New Booking", actual ru is "+ Новая бронь")
- Missing step (help doesn't mention business-date dependency)
- Stale flow (help references an "Advanced" tab that no longer exists)
- Edge case not covered (no mention of checkOut ≤ checkIn validation)

- [ ] **Step 3: Fill the block**

```yaml
help_rewrite_hints:
  topic: bookings
  current: |
    <verbatim quote from help-content.tsx for the relevant bookings section>
  actual: |
    <one or two paragraphs describing observed reality — labels in both locales, the 4 required fields, rate-matrix behavior, edge cases>
  rewrite: |
    <concrete replacement text or structured outline — what the next agent should write in help-content.tsx>
```

Style: concrete, actionable, reference real labels (both locales), reference `BUG-NNN` where the help should describe a known limitation.

---

## Task 8: Decide status and update index

**Purpose:** make the call on `ok | partial | broken`, stamp the date, and update the audit index.

**Files:**
- Modify: `docs/ui-audit/features/03-booking-create.yml` (set `status`, `last_audited`)
- Modify: `docs/ui-audit/index.yml`

- [ ] **Step 1: Apply plan §8 status criteria**

- `ok` — all scenarios pass, zero console/network errors, all labels localized correctly.
- `partial` — happy path works, some edge cases have bugs or localization gaps.
- `broken` — happy path does not complete (even after Task 4 unblocker fixes).
- `missing` — not applicable here (the route exists).

- [ ] **Step 2: Set status and date in the feature YAML**

```yaml
status: <ok|partial|broken>
last_audited: 2026-04-21
```

- [ ] **Step 3: Update `docs/ui-audit/index.yml`**

Set:
```yaml
generated: 2026-04-21
app_commit: <current HEAD sha>
```
Get sha via: `git rev-parse HEAD`.

Update the section 03 line:
```yaml
- { id: "03", file: features/03-booking-create.yml, status: <ok|partial|broken>, bugs: <count>, priority: P0 }
```

Update `totals`:
```yaml
totals:
  sections: 24
  ok: <N>
  partial: <N>
  broken: <N>
  missing: 0
  pending: 23   # was 24; one moved out of pending
  bugs: <existing + new>
```

- [ ] **Step 4: Validate index YAML**

Same command as Task 5 Step 9, on `index.yml`.

---

## Task 9: Commit audit artifacts

**Purpose:** single commit bundling everything produced by Tasks 3/5/6/7/8.

- [ ] **Step 1: Stage audit files**

```bash
git add \
  tools/ui-audit/src/03-booking-create.spec.ts \
  docs/ui-audit/features/03-booking-create.yml \
  docs/ui-audit/screenshots/03-booking-create-*.png \
  docs/ui-audit/bugs.yml \
  docs/ui-audit/index.yml \
  docs/backlog.json
git status
```
Expected: every listed file appears staged; nothing else staged.

- [ ] **Step 2: Verify no unintended changes**

```bash
git diff --staged --stat
```
Review — should be: new spec, new YAML, new screenshots, modified bugs.yml/index.yml/backlog.json. No stray changes to `apps/` etc.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(audit): pilot — section 03 booking-create

First section of the UI audit. Playwright spec covers six scenarios
(empty-submit, happy-path, checkout-before-checkin, room-unavailable,
inline-new-guest, rate-plan-auto-rate) in ru and en locales. YAML
report in docs/ui-audit/features/03-booking-create.yml captures
labels, API calls, console/network errors, edge cases, and
help_rewrite_hints for the bookings help topic.

See docs/superpowers/specs/2026-04-21-ui-audit-execution-design.md
for the full pilot design; pilot-retro.md follows separately.
EOF
)"
```
Expected: commit created; hooks pass.

---

## Task 10: Write `pilot-retro.md`

**Purpose:** the primary output of the pilot — a concrete, actionable list of changes for full-run.

**Files:**
- Create: `docs/ui-audit/pilot-retro.md`

- [ ] **Step 1: Measure duration**

Calculate `ended - started` (ISO timestamps from Task 0 start of session to now).

- [ ] **Step 2: Estimate tokens**

Rough main-context token estimate — just a ballpark (e.g., "~120k") based on the context-usage indicator, not exact.

- [ ] **Step 3: Write retro following §10 template**

Open a new file and write:

```md
# Pilot Retrospective — Section 03 (booking-create)

## Execution
- Started: <ISO timestamp>
- Ended: <ISO timestamp>
- Duration: <X> min
- Outcome: completed
- Main-context tokens used: ~<N>k
- Commits produced:
  - <sha> feat(tools): scaffold tools/ui-audit package with Playwright
  - <sha> feat(audit): pilot — section 03 booking-create
  - (optional) <sha> fix(<area>): <unblocker>
  - (this one — retro) docs(audit): pilot retrospective

## Methodology validation
### YAML schema — what fit
- <concrete items, e.g., `ui.required_fields` mapped cleanly to observed labels>
### YAML schema — what didn't
- <concrete items, e.g., `edge_cases[].bug` field is singular but some edge cases surfaced two bugs>
### Template coverage
- <fields added, fields unused>
### Playwright patterns worth keeping
- <e.g., "auditScreenshot helper with sectionId+step+locale naming is clean">
### Screenshot naming convention
- <adequate | revise — concrete suggestions>

## Time extrapolation
- Pilot: <X> min for 1 section
- Linear extrapolation to 24 sections: ~<24X> min (<Y>h)
- Realistic extrapolation considering simpler sections (e.g., 22 help, 23 login): ~<Z>h
- Risks that would make full-run take 2–3× longer:
  - <concrete>

## Changes needed before full-run
- [ ] `_template.yml`: <field add / remove / restructure>
- [ ] `docs/ui-audit-plan.md` §N: <what's misaligned>
- [ ] `tools/ui-audit/src/shared.ts`: <helpers to add>
- [ ] subagent brief (spec §6.2): <adjustments>
- [ ] Remove redundant `docs/ui-audit/scripts/` dir (superseded by `tools/ui-audit/src/`)

## Critical findings
<None | concrete list — if any, pilot halted per spec §8>

## Bugs found
- BUG-NNN: <title> (severity)
- …
(Or "None." if audit completed cleanly.)

## Unblocker fixes applied
- <sha>: <rationale>
(Or "None needed.")

## Open questions for user
- <anything requiring decision before full-run>
```

- [ ] **Step 4: Commit the retro**

```bash
git add docs/ui-audit/pilot-retro.md
git commit -m "$(cat <<'EOF'
docs(audit): pilot retrospective

End of pilot for section 03. Captures methodology validation,
time extrapolation to full-run, concrete change list for
_template.yml / plan / shared.ts / subagent brief, and any
open questions for the user before full-run executes.
EOF
)"
```
Expected: hooks pass; `git status` clean.

---

## Task 11: Fallback — halted pilot

**Purpose:** this task runs ONLY if the pilot was halted by pre-flight failure (Task 0) or critical finding (Task 4/6). In a successful pilot, skip it entirely.

- [ ] **Step 1: Write partial pilot-retro**

Use the §10 template but with:
- `Outcome: blocked-preflight` or `blocked-critical-finding`
- Critical findings section populated
- Everything else honestly captured including what WAS completed before halt

- [ ] **Step 2: Stage everything that exists**

```bash
git add -A docs/ui-audit/ tools/ui-audit/ pnpm-workspace.yaml pnpm-lock.yaml
git status
```

- [ ] **Step 3: Commit with blocked prefix**

```bash
git commit -m "docs(audit): pilot blocked — <reason>"
```

Then jump to Task 12 (verification).

---

## Task 12: Final verification

**Purpose:** before declaring pilot done, prove every pilot-done criterion from spec §12 is satisfied.

**Time-cap reminder (spec §13):** if wall-clock time from Task 0 Step 1 has exceeded 2 hours at any point and you are not already at Task 10, stop after the current step, write a partial retro (Task 10 Step 3 with `Outcome: blocked-timecap`), commit as `docs(audit): pilot blocked — time cap exceeded`, and jump to this verification task. The retro is the most valuable output even if the section is incomplete.

- [ ] **Step 1: Git clean**

```bash
git status
```
Expected: `nothing to commit, working tree clean`.

- [ ] **Step 2: Files present**

```bash
test -f docs/ui-audit/features/03-booking-create.yml && echo "yml: ok"
test -f docs/ui-audit/pilot-retro.md && echo "retro: ok"
test -f tools/ui-audit/src/03-booking-create.spec.ts && echo "spec: ok"
ls docs/ui-audit/screenshots/03-booking-create-*.png | head && echo "screenshots: ok"
```
Expected: all four "ok" lines printed.

- [ ] **Step 3: YAML validates**

Re-run YAML load on `03-booking-create.yml` and `index.yml`.

- [ ] **Step 4: index.yml matches**

```bash
grep '"03"' docs/ui-audit/index.yml
```
Expected: shows the section 03 line with status no longer `pending`.

- [ ] **Step 5: Playwright still green on the final spec**

```bash
pnpm --filter @pms/ui-audit test -- src/03-booking-create.spec.ts
```
Expected: same pass/fail profile as at Task 3 Step 4 (re-running shouldn't regress after any unblocker fixes). If green scenarios turned red — investigate before stopping.

- [ ] **Step 6: Summary message to user**

Post a short message in the session:
- How long pilot took
- How many bugs found (by severity)
- Whether methodology corrections are significant or minor
- Pointer to `docs/ui-audit/pilot-retro.md` and the commits

Then stop. Do NOT start section 01 / 02 / any other section. Wait for user review of the retro before full-run.

---

## Acceptance (pilot)

Per spec §12 and §14, pilot is accepted when:
- All pilot-done criteria in Task 12 are met
- User reads `pilot-retro.md` and either approves as-is or requests adjustments
- If adjustments requested → amend methodology → re-commit changes → full-run can begin (separate session, separate plan)
