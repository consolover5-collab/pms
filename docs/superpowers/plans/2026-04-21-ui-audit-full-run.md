# UI Audit Full-Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce complete audit artifacts (Playwright spec + YAML report + screenshots + per-section retro) for the 23 remaining PMS UI sections, building on the pilot (section 03) with extracted harness helpers and batch-based user review gates.

**Architecture:** Extract reusable harness (login, native-input setter, seed-ref UUIDs, build-gate, api-probe, fixtures) from the pilot into `tools/ui-audit/src/`. Execute 23 sections sequentially on Opus, grouped into 4 batches (A=5, B=3, C=9, D=6). After each batch, commit a batch retro and hand off to the user for review before proceeding. All work on `feat/design-system`; one final PR after batch D.

**Tech Stack:** Playwright 1.49+, TypeScript, pnpm workspaces, Node 24+ (ESM). Backend: Fastify API on :3001, Next.js web on :3000, Postgres `pms_dev`. Auth via `pms_session` cookie (admin/admin123 seed).

**Related documents:**
- Spec: `docs/superpowers/specs/2026-04-21-ui-audit-full-run-design.md`
- Pilot retro: `docs/ui-audit/pilot-retro.md`
- Overall audit plan: `docs/ui-audit-plan.md` §6 (section details), §7 (protocol), §8 (status criteria)
- Template: `docs/ui-audit/features/_template.yml`
- Pilot reference spec: `tools/ui-audit/src/03-booking-create.spec.ts`
- Help topics source: `apps/web/src/app/help/[topic]/help-content.tsx`

**Note on scope:** The plan contains 23 sections grouped in 4 batches. Each batch ends with a mandatory user-review checkpoint. Do not proceed to the next batch without explicit user approval (the plan halts at each gate).

---

## Prerequisites (Task 0)

Before starting, verify the environment.

- [ ] **Step 1: Confirm current branch and clean working tree**

Run:
```bash
git rev-parse --abbrev-ref HEAD
git status --short
```
Expected: `feat/design-system`, empty status.

- [ ] **Step 2: Confirm API and web are up**

Run:
```bash
curl -s http://localhost:3001/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```
Expected: `{"status":"ok"}` from API, `200` from web. If not, follow `~/.claude/projects/-home-oci-pms/memory/deploy_procedure.md`.

- [ ] **Step 3: Confirm pilot spec still green**

Run:
```bash
pnpm --filter @pms/ui-audit test 2>&1 | tail -5
```
Expected: `12 passed`.

- [ ] **Step 4: Confirm pilot artifacts exist**

Run:
```bash
ls docs/ui-audit/features/03-booking-create.yml docs/ui-audit/screenshots/ | head -3
ls docs/ui-audit/screenshots/ | wc -l
```
Expected: feature YAML present, ≥ 24 screenshots.

Do not proceed if any prerequisite fails. Stop and ask the user.

---

# Phase 1: Harness setup

Five harness commits before any section work starts. Each commit passes the existing 12 pilot tests (regression check in Task 7).

## Task 1: Extract shared helpers into `src/shared.ts`

**Files:**
- Modify: `tools/ui-audit/src/shared.ts`
- Modify: `tools/ui-audit/src/03-booking-create.spec.ts:49-91` (remove local copies)

- [ ] **Step 1: Add helpers to shared.ts**

Append to `tools/ui-audit/src/shared.ts`:

```ts
export const WEB_URL = process.env.AUDIT_WEB_URL ?? 'http://localhost:3000';

export async function loginAsAdmin(page: Page): Promise<void> {
  const resp = await page.context().request.post(`${WEB_URL}/api/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
    headers: { 'content-type': 'application/json' },
  });
  if (!resp.ok()) {
    throw new Error(`Login failed: ${resp.status()} ${await resp.text()}`);
  }
}

export async function setLocaleAndGoto(
  page: Page,
  locale: 'ru' | 'en',
  path: string,
): Promise<void> {
  await loginAsAdmin(page);
  await page.context().addCookies([{ name: 'locale', value: locale, url: WEB_URL }]);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

export async function setNativeValue(
  page: Page,
  selector: string,
  value: string,
  index = 0,
): Promise<void> {
  await page.locator(selector).nth(index).evaluate((el, val) => {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

export async function pickFirstSelectOption(
  page: Page,
  selector: string,
): Promise<string> {
  return page.locator(selector).evaluate((el) => {
    const sel = el as HTMLSelectElement;
    for (const opt of Array.from(sel.options)) {
      if (opt.value && opt.value.length > 0) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return opt.value;
      }
    }
    return '';
  });
}
```

- [ ] **Step 2: Remove local copies from 03-booking-create.spec.ts**

In `tools/ui-audit/src/03-booking-create.spec.ts`:
- Remove the local `loginAsAdmin`, `setLocaleAndGoto`, `forceDateValue`, and `pickFirstSelectableOption` functions (lines 49–91).
- Update the import to pull new helpers from shared:

```ts
import {
  auditScreenshot,
  wireErrorCollectors,
  loginAsAdmin,
  setLocaleAndGoto,
  setNativeValue,
  pickFirstSelectOption,
  API_URL,
  GBH_PROPERTY_ID,
  type ConsoleError,
  type NetworkError,
} from './shared.ts';
```
- Replace callsites: `forceDateValue(page, 0, date)` → `setNativeValue(page, 'input[type="date"]', date, 0)`. Same for index 1.
- Replace `setLocaleAndGoto(page, locale)` → `setLocaleAndGoto(page, locale, '/bookings/new')`.
- Replace `pickFirstSelectableOption` → `pickFirstSelectOption` (single call site renames).

- [ ] **Step 3: Run pilot spec**

Run:
```bash
pnpm --filter @pms/ui-audit test 2>&1 | tail -5
```
Expected: `12 passed`.

- [ ] **Step 4: Commit**

```bash
cd /home/oci/pms
git add tools/ui-audit/src/shared.ts tools/ui-audit/src/03-booking-create.spec.ts
git commit -m "$(cat <<'EOF'
feat(ui-audit): extract login, setLocaleAndGoto, setNativeValue to shared

Refactors pilot's local helpers into reusable shared module so subsequent
section specs can import them. No behaviour change; 12/12 pilot tests green.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## Task 2: Add `src/seed-refs.ts` with canonical UUIDs

**Files:**
- Create: `tools/ui-audit/src/seed-refs.ts`

- [ ] **Step 1: Query seed data via API to confirm UUIDs**

Run (login cookie not needed — these endpoints are open):
```bash
curl -s "http://localhost:3001/api/properties" | head -c 500
curl -s "http://localhost:3001/api/room-types?propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad" | head -c 800
curl -s "http://localhost:3001/api/rate-plans?propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad" | head -c 800
curl -s "http://localhost:3001/api/rooms?propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad" | head -c 1000
```
Record: property id, at least one room-type id (Standard Double), rack rate plan, promo rate plan, one available room, one OOS room.

- [ ] **Step 2: Write seed-refs.ts**

Create `tools/ui-audit/src/seed-refs.ts`:

```ts
/**
 * Canonical seed UUIDs for Grand Baltic Hotel (GBH) property.
 * Values verified against seed.ts on 2026-04-21.
 * Update if seed.ts changes — verify via api-probe (see src/api-probe.ts).
 */

export const SEED = {
  property: {
    GBH: 'ff1d9135-dfb9-4baa-be46-0e739cd26dad',
  },
  roomType: {
    standardDouble: 'e8f25fcd-bdaf-43bb-b39f-4d9ad6d83c84',
  },
  ratePlan: {
    // Base rate (default-picked in new booking form)
    RACK: '<FILL FROM Step 1>',
    // Non-base, lower rate used for rate-switch tests
    PROMO: '28d39f1c-87bd-4824-b3e8-788053b6ff37',
  },
  room: {
    // Verified OOS at seed time — used for room-unavailable scenarios
    oos: '6762e1df-44b0-48cf-915e-97ac366cc297',
  },
  profileType: {
    individual: 'individual',
    company: 'company',
    travelAgent: 'travel_agent',
    source: 'source',
    contact: 'contact',
  },
  auth: {
    adminUsername: 'admin',
    adminPassword: 'admin123',
  },
} as const;
```

Fill `SEED.ratePlan.RACK` from the Step 1 output (look for the plan with `isBaseRate: true` or `code: "RACK"`).

- [ ] **Step 3: Commit**

```bash
git add tools/ui-audit/src/seed-refs.ts
git commit -m "$(cat <<'EOF'
feat(ui-audit): add seed-refs.ts with canonical GBH UUIDs

Centralises seed UUIDs so every section spec imports from one place.
Verified against seed.ts on 2026-04-21.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## Task 3: Add `src/build-gate.ts` globalSetup

**Files:**
- Create: `tools/ui-audit/src/build-gate.ts`
- Modify: `tools/ui-audit/playwright.config.ts`

- [ ] **Step 1: Write build-gate.ts**

Create `tools/ui-audit/src/build-gate.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const BUILD_ID_PATH = path.join(REPO_ROOT, 'apps/web/.next/BUILD_ID');

export default async function buildGate(): Promise<void> {
  if (!fs.existsSync(BUILD_ID_PATH)) {
    throw new Error(
      `apps/web/.next/BUILD_ID missing. Run 'pnpm --filter @pms/web build' before running the audit.`,
    );
  }

  const buildMtime = fs.statSync(BUILD_ID_PATH).mtimeMs;
  // Last commit touching apps/web:
  let lastWebCommitTsSec = 0;
  try {
    lastWebCommitTsSec = Number(
      execSync('git log -1 --format=%ct -- apps/web', { cwd: REPO_ROOT }).toString().trim(),
    );
  } catch {
    // no git history — skip check
  }
  const lastWebCommitTsMs = lastWebCommitTsSec * 1000;

  if (lastWebCommitTsMs && buildMtime < lastWebCommitTsMs) {
    throw new Error(
      `Stale .next/ detected: BUILD_ID mtime ${new Date(buildMtime).toISOString()} is older than last apps/web commit ${new Date(lastWebCommitTsMs).toISOString()}. Run 'pnpm --filter @pms/web build' before running the audit.`,
    );
  }

  const buildId = fs.readFileSync(BUILD_ID_PATH, 'utf8').trim();
  console.log(`[build-gate] BUILD_ID=${buildId}, mtime=${new Date(buildMtime).toISOString()}`);
}
```

- [ ] **Step 2: Wire globalSetup in playwright.config.ts**

In `tools/ui-audit/playwright.config.ts`, add to the exported config:

```ts
  globalSetup: './src/build-gate.ts',
```

- [ ] **Step 3: Verify build is fresh, run pilot**

Run:
```bash
pnpm --filter @pms/web build 2>&1 | tail -3
pnpm --filter @pms/ui-audit test 2>&1 | tail -8
```
Expected: build succeeds, pilot shows `[build-gate] BUILD_ID=…` line before `12 passed`.

- [ ] **Step 4: Commit**

```bash
git add tools/ui-audit/src/build-gate.ts tools/ui-audit/playwright.config.ts
git commit -m "$(cat <<'EOF'
feat(ui-audit): build-gate globalSetup to catch stale .next/

Fails fast if apps/web/.next/BUILD_ID is missing or older than the last
commit that touched apps/web. Prevents the pilot-retro #3 scenario
(screenshots of stale UI after branch switch).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## Task 4: Add `src/api-probe.ts` globalSetup

**Files:**
- Create: `tools/ui-audit/src/api-probe.ts`
- Modify: `tools/ui-audit/playwright.config.ts`

- [ ] **Step 1: Write api-probe.ts**

Create `tools/ui-audit/src/api-probe.ts`:

```ts
import { SEED } from './seed-refs.ts';

const API = process.env.AUDIT_API_URL ?? 'http://localhost:3001';
const PROPERTY = `?propertyId=${SEED.property.GBH}`;

const REQUIRED_ENDPOINTS: { path: string; expectMinTotal?: number }[] = [
  { path: '/health' },
  { path: '/api/properties' },
  { path: `/api/business-date${PROPERTY}` },
  { path: `/api/room-types${PROPERTY}`, expectMinTotal: 1 },
  { path: `/api/rooms${PROPERTY}`, expectMinTotal: 1 },
  { path: `/api/rate-plans${PROPERTY}`, expectMinTotal: 1 },
  { path: `/api/profiles${PROPERTY}&type=individual`, expectMinTotal: 0 },
  { path: `/api/profiles${PROPERTY}&type=company` },
  { path: `/api/profiles${PROPERTY}&type=travel_agent` },
  { path: `/api/profiles${PROPERTY}&type=source` },
  { path: `/api/transaction-codes${PROPERTY}` },
];

export default async function apiProbe(): Promise<void> {
  const failures: string[] = [];
  for (const ep of REQUIRED_ENDPOINTS) {
    try {
      const res = await fetch(`${API}${ep.path}`);
      if (!res.ok) {
        failures.push(`${ep.path} → ${res.status}`);
        continue;
      }
      if (ep.expectMinTotal !== undefined) {
        const body = (await res.json()) as { total?: number; length?: number };
        const count = body.total ?? (Array.isArray(body) ? (body as unknown as unknown[]).length : 0);
        if (count < ep.expectMinTotal) {
          failures.push(`${ep.path} → only ${count} items (need ≥ ${ep.expectMinTotal})`);
        }
      }
    } catch (e) {
      failures.push(`${ep.path} → threw: ${(e as Error).message}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `api-probe failed:\n  - ${failures.join('\n  - ')}\n\nFix seed or API before continuing.`,
    );
  }
  console.log(`[api-probe] ${REQUIRED_ENDPOINTS.length} endpoints OK`);
}
```

- [ ] **Step 2: Chain api-probe after build-gate**

Merge both globalSetup steps. Replace `globalSetup: './src/build-gate.ts'` with a new orchestrator:

Create `tools/ui-audit/src/global-setup.ts`:
```ts
import buildGate from './build-gate.ts';
import apiProbe from './api-probe.ts';

export default async function globalSetup(): Promise<void> {
  await buildGate();
  await apiProbe();
}
```

In `playwright.config.ts`, update:
```ts
  globalSetup: './src/global-setup.ts',
```

- [ ] **Step 3: Run pilot**

```bash
pnpm --filter @pms/ui-audit test 2>&1 | tail -10
```
Expected: `[build-gate] …` and `[api-probe] 11 endpoints OK` both print before `12 passed`.

- [ ] **Step 4: Commit**

```bash
git add tools/ui-audit/src/api-probe.ts tools/ui-audit/src/global-setup.ts tools/ui-audit/playwright.config.ts
git commit -m "$(cat <<'EOF'
feat(ui-audit): api-probe globalSetup to catch endpoint drift

Validates every endpoint listed in the audit plan before tests run;
detects paginated-response mismatches via expectMinTotal. Prevents
pilot-retro #1 scenario (plan referenced /api/business-dates but real
route is singular).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## Task 5: Extend `src/fixtures.ts` with profile-type fixtures

**Files:**
- Modify: `tools/ui-audit/src/fixtures.ts`

- [ ] **Step 1: Add ensureCompanies, ensureTravelAgents, ensureSources**

Append to `tools/ui-audit/src/fixtures.ts` after `ensureGuests`:

```ts
async function ensureProfilesOfType(
  type: 'company' | 'travel_agent' | 'source',
  minCount: number,
  prefix: string,
): Promise<number> {
  const res = await fetch(
    `${API_URL}/api/profiles?propertyId=${GBH_PROPERTY_ID}&type=${type}`,
  );
  const page = (await res.json()) as ProfilesPage;
  if (page.total >= minCount) return page.total;

  const toCreate = minCount - page.total;
  for (let i = 0; i < toCreate; i++) {
    const body = {
      propertyId: GBH_PROPERTY_ID,
      type,
      companyName: `${prefix}-${Date.now()}-${i}`,
      email: `${prefix.toLowerCase()}-${Date.now()}-${i}@example.test`,
      force: true,
    };
    const r = await fetch(`${API_URL}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      throw new Error(`POST /api/profiles (${type}) failed: ${r.status} ${await r.text()}`);
    }
  }
  return minCount;
}

export const ensureCompanies     = (min = 1) => ensureProfilesOfType('company',      min, 'AuditCo');
export const ensureTravelAgents  = (min = 1) => ensureProfilesOfType('travel_agent', min, 'AuditTA');
export const ensureSources       = (min = 1) => ensureProfilesOfType('source',       min, 'AuditSrc');

export async function ensureActiveBusinessDate(): Promise<string> {
  const res = await fetch(
    `${API_URL}/api/business-date?propertyId=${GBH_PROPERTY_ID}`,
  );
  if (!res.ok) {
    throw new Error(`GET /api/business-date failed: ${res.status}`);
  }
  const body = (await res.json()) as { businessDate?: string; date?: string };
  return body.businessDate ?? body.date ?? '';
}
```

If the `companyName` field differs (`name`, `title`) — inspect the schema by reading `apps/api/src/routes/profiles.ts`, adjust.

- [ ] **Step 2: Run pilot to verify no breakage**

```bash
pnpm --filter @pms/ui-audit test 2>&1 | tail -5
```
Expected: `12 passed`.

- [ ] **Step 3: Commit**

```bash
git add tools/ui-audit/src/fixtures.ts
git commit -m "$(cat <<'EOF'
feat(ui-audit): fixtures for all profile types + active business date

Adds ensureCompanies/TravelAgents/Sources and ensureActiveBusinessDate
helpers for sections that need non-individual profiles or business-date
state (night-audit, rate-plans with TA).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## Task 6: Add `scripts/aggregate.ts` and `scripts/validate-yaml.ts`

**Files:**
- Create: `tools/ui-audit/scripts/aggregate.ts`
- Create: `tools/ui-audit/scripts/validate-yaml.ts`
- Modify: `tools/ui-audit/package.json`
- Create: `tools/ui-audit/scripts/README.md`

- [ ] **Step 1: Install yaml dep**

```bash
cd /home/oci/pms/tools/ui-audit
pnpm add -D yaml@^2.5.0
```

- [ ] **Step 2: Write aggregate.ts**

Create `tools/ui-audit/scripts/aggregate.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_DIR = path.resolve(__dirname, '../../../docs/ui-audit');
const FEATURES_DIR = path.join(AUDIT_DIR, 'features');
const INDEX_PATH = path.join(AUDIT_DIR, 'index.yml');

type Status = 'ok' | 'partial' | 'broken' | 'missing' | 'pending';

function countBugs(feature: { bugs?: unknown[] } | null): number {
  return Array.isArray(feature?.bugs) ? feature!.bugs!.length : 0;
}

function main(): void {
  const index = parse(fs.readFileSync(INDEX_PATH, 'utf8')) as {
    sections: { id: string; file: string; status: Status; bugs: number; priority: string }[];
    totals: Record<string, number>;
    generated: string | null;
    app_commit: string | null;
  };

  const totals: Record<Status | 'bugs' | 'sections', number> = {
    sections: index.sections.length,
    ok: 0, partial: 0, broken: 0, missing: 0, pending: 0, bugs: 0,
  };

  for (const section of index.sections) {
    const featurePath = path.join(AUDIT_DIR, section.file);
    if (!fs.existsSync(featurePath)) {
      section.status = 'pending';
      section.bugs = 0;
    } else {
      const feature = parse(fs.readFileSync(featurePath, 'utf8')) as {
        status?: Status; bugs?: unknown[];
      };
      section.status = feature.status ?? 'pending';
      section.bugs = countBugs(feature);
    }
    totals[section.status]++;
    totals.bugs += section.bugs;
  }

  index.totals = totals;
  fs.writeFileSync(INDEX_PATH, stringify(index));
  console.log('index.yml aggregated:', totals);
}

main();
```

- [ ] **Step 3: Write validate-yaml.ts**

Create `tools/ui-audit/scripts/validate-yaml.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEATURES_DIR = path.resolve(__dirname, '../../../docs/ui-audit/features');

const REQUIRED_FIELDS = [
  'id', 'title', 'route', 'locales_tested',
  'ui', 'steps', 'edge_cases',
  'api_calls_observed', 'console_errors', 'network_errors',
  'bugs', 'status', 'last_audited', 'screenshots_dir',
];

const VALID_STATUS = ['ok', 'partial', 'broken', 'missing', 'pending'];

function main(): void {
  const errors: string[] = [];
  for (const file of fs.readdirSync(FEATURES_DIR)) {
    if (!file.endsWith('.yml') || file === '_template.yml') continue;
    const fullPath = path.join(FEATURES_DIR, file);
    let doc: Record<string, unknown>;
    try {
      doc = parse(fs.readFileSync(fullPath, 'utf8')) as Record<string, unknown>;
    } catch (e) {
      errors.push(`${file}: YAML parse error: ${(e as Error).message}`);
      continue;
    }
    for (const f of REQUIRED_FIELDS) {
      if (!(f in doc)) errors.push(`${file}: missing field '${f}'`);
    }
    const status = doc.status as string;
    if (status && !VALID_STATUS.includes(status)) {
      errors.push(`${file}: invalid status '${status}' (must be one of ${VALID_STATUS.join('|')})`);
    }
    const steps = doc.steps as { screenshots?: string[] }[] | undefined;
    if (Array.isArray(steps)) {
      for (const step of steps) {
        for (const ss of step.screenshots ?? []) {
          const ssPath = path.resolve(__dirname, '../../../docs/ui-audit/screenshots', ss);
          if (!fs.existsSync(ssPath)) {
            errors.push(`${file}: screenshot not found: ${ss}`);
          }
        }
      }
    }
  }
  if (errors.length > 0) {
    console.error('validate-yaml failed:');
    for (const e of errors) console.error('  -', e);
    process.exit(1);
  }
  console.log('validate-yaml: all feature YAMLs OK');
}

main();
```

- [ ] **Step 4: Add scripts to package.json**

In `tools/ui-audit/package.json`, add to `"scripts"`:

```json
    "aggregate": "tsx scripts/aggregate.ts",
    "validate-yaml": "tsx scripts/validate-yaml.ts"
```

Install tsx if not present:
```bash
pnpm add -D tsx
```

- [ ] **Step 5: Run both against pilot artifacts**

```bash
pnpm --filter @pms/ui-audit aggregate
pnpm --filter @pms/ui-audit validate-yaml
```
Expected: `index.yml aggregated: { sections: 24, ok: 1, ... pending: 23, bugs: 0 }` and `all feature YAMLs OK`.

- [ ] **Step 6: Commit**

```bash
git add tools/ui-audit/scripts/ tools/ui-audit/package.json tools/ui-audit/pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(ui-audit): aggregate and validate-yaml scripts

aggregate.ts recomputes index.yml totals from features/*.yml.
validate-yaml.ts shape-checks each feature + verifies referenced
screenshots exist. Run after every section.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## Task 7: Update `_template.yml` to match pilot schema

**Files:**
- Modify: `docs/ui-audit/features/_template.yml`

- [ ] **Step 1: Rewrite template**

Overwrite `docs/ui-audit/features/_template.yml` with:

```yaml
# Template. Copy to features/NN-<slug>.yml and fill. Schema verified
# against pilot (03-booking-create). Validate with `pnpm --filter @pms/ui-audit validate-yaml`.

id: <section.slug>
title: "<human-readable title>"
route: /<path>
depends_on: []
locales_tested: [ru, en]

ui:
  header: { ru: "", en: "" }
  required_fields: []
  optional_fields: []
  buttons: {}

steps: []
# Example step:
# - id: "01-empty-form"
#   action: "Open page under admin; form renders empty"
#   screenshots: [NN-slug-01-empty-form-ru.png, NN-slug-01-empty-form-en.png]

edge_cases: []
# Example edge case:
# - id: empty-submit
#   description: "Submit empty form"
#   expected: "HTML5 required blocks submit; no POST"
#   observed: "OK — screenshot 02"

api_calls_observed: []
# Example:
# - { method: GET,  path: "/api/properties" }
# - { method: POST, path: "/api/bookings", status: 201, note: "happy-path" }

console_errors: []
# Example:
# - locale: ru
#   scenario: room-unavailable
#   text: "Failed to load resource: 400"
#   verdict: expected

network_errors: []
# Example:
# - locale: ru
#   scenario: room-unavailable
#   status: 400
#   method: POST
#   url: "http://localhost:3000/api/bookings"
#   verdict: expected

bugs: []
# Example bug:
# - id: BUG-042
#   severity: low
#   scenario: empty-submit
#   observed: "Submit button stays enabled after click"
#   screenshot: NN-slug-02-empty-validation-ru.png

help_rewrite_hints:
  # Set topic: null if no matching help topic exists for this section.
  topic: <help-topic-id-or-null>
  current: ""
  actual: ""
  rewrite: |

retro:
  time_minutes: 0
  unblocker_fixes: []
  methodology_deltas: []

status: pending   # ok | partial | broken | missing | pending
last_audited: null
screenshots_dir: docs/ui-audit/screenshots/
```

- [ ] **Step 2: Re-validate pilot YAML against new schema**

```bash
pnpm --filter @pms/ui-audit validate-yaml
```
Expected: passes. If pilot YAML missing `retro:` block, add it:

```yaml
retro:
  time_minutes: 90
  unblocker_fixes: []
  methodology_deltas:
    - "loginAsAdmin required on feat/design-system (BUG-001 reverted)"
    - "Pre-flight must run pnpm build to refresh .next/"
    - "API endpoints drift from plan (/api/business-date singular; profiles paginated)"
    - "React date inputs need setNativeValue"
    - "errors.json must live outside outputDir"
```

- [ ] **Step 3: Commit**

```bash
git add docs/ui-audit/features/_template.yml docs/ui-audit/features/03-booking-create.yml
git commit -m "$(cat <<'EOF'
docs(ui-audit): align _template.yml with pilot schema + backfill pilot retro

Template now matches the shape of the pilot's 03-booking-create.yml
(console/network error objects with locale+scenario+verdict,
api_calls_observed with optional status/note, retro block).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## Task 8: Regression verification

- [ ] **Step 1: Full clean run**

```bash
pnpm --filter @pms/web build 2>&1 | tail -3
pnpm --filter @pms/ui-audit test 2>&1 | tail -8
pnpm --filter @pms/ui-audit aggregate
pnpm --filter @pms/ui-audit validate-yaml
```
Expected: all green. If any step fails, stop and fix before starting batches.

- [ ] **Step 2: Confirm working tree clean**

```bash
cd /home/oci/pms && git status --short
```
Expected: empty.

---

# Section Audit Protocol (shared reference)

Each section task below follows this 8-step protocol. Where the protocol says "per-section specifics," consult that task's preamble.

1. **Read route source** — `apps/web/src/app/<route>/page.tsx` plus any co-located components. Note all user-interactive elements, required/optional fields, buttons.
2. **Read i18n strings** — `apps/web/src/lib/i18n/locales/{ru,en}.ts` to capture exact labels for the `ui.*` block of the YAML.
3. **Enumerate 4–6 scenarios** — always include: empty-page happy-path, at least one edge case, one error path if API can reject. Per-section "Scenarios" block suggests candidates.
4. **Write spec** at `tools/ui-audit/src/NN-<slug>.spec.ts` using this skeleton (fork from pilot):

```ts
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditScreenshot, wireErrorCollectors, setLocaleAndGoto, setNativeValue,
  API_URL, type ConsoleError, type NetworkError,
} from './shared.ts';
import { SEED } from './seed-refs.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECTION_ID = 'NN-slug';

const errorsByProject: Record<string, Record<string, { console: ConsoleError[]; network: NetworkError[] }>> = {};
const apiCallsByProject: Record<string, { method: string; path: string; status: number }[]> = {};

test.describe('NN <slug>', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const proj = testInfo.project.name;
    const errors = wireErrorCollectors(page);
    errorsByProject[proj] ??= {};
    errorsByProject[proj][testInfo.title] = errors;
    apiCallsByProject[proj] ??= [];
    page.on('response', (res) => {
      const url = new URL(res.url());
      if (url.pathname.startsWith('/api/')) {
        apiCallsByProject[proj].push({
          method: res.request().method(),
          path: url.pathname + url.search,
          status: res.status(),
        });
      }
    });
  });

  // one test per scenario — see per-section task

  test.afterAll(async ({}, testInfo) => {
    const proj = testInfo.project.name;
    const outDir = path.resolve(__dirname, '../audit-data');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${SECTION_ID}-errors.json`);
    const existing = fs.existsSync(outPath)
      ? JSON.parse(fs.readFileSync(outPath, 'utf8'))
      : { errors: {}, api: {} };
    existing.errors[proj] = errorsByProject[proj];
    existing.api[proj] = apiCallsByProject[proj];
    fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));
  });
});
```

5. **Run**: `pnpm --filter @pms/ui-audit exec playwright test src/NN-<slug>.spec.ts 2>&1 | tail -15`. Iterate until green, or record the failure as a bug + status=`broken`/`partial`.
6. **Fill YAML** at `docs/ui-audit/features/NN-<slug>.yml` from `_template.yml`. Fields: derived from code-read (ui), scenario list (steps/edge_cases), `audit-data/NN-<slug>-errors.json` (api_calls_observed, console_errors, network_errors), triage decisions (bugs, status), help-topic mapping (help_rewrite_hints).
7. **Triage bugs** — for each real bug (see §8 of audit plan for status criteria):
   - append to `docs/ui-audit/bugs.yml` with id `BUG-NNN` (next free number)
   - append a mirror entry to `docs/backlog.json` using `BUG-NNN` as id
   - reference from the YAML `bugs:` list
8. **Finalize**:
   ```bash
   pnpm --filter @pms/ui-audit aggregate
   pnpm --filter @pms/ui-audit validate-yaml
   ```
9. **Commit**:
   ```bash
   git add tools/ui-audit/src/NN-<slug>.spec.ts \
           docs/ui-audit/features/NN-<slug>.yml \
           docs/ui-audit/screenshots/NN-slug-*.png \
           docs/ui-audit/index.yml \
           docs/ui-audit/bugs.yml \
           docs/backlog.json
   git commit -m "feat(ui-audit): section NN <slug> — <status>"
   ```

**If a section is blocked** (critical finding, > 2 unblocker fixes, or spec green requires > 2h), halt the batch: create `docs/ui-audit/batch-<letter>-halt.md` with the reason, commit, stop.

**Scenario counts per section** are suggestions. If a section is genuinely simpler (e.g., pure read-only view), 2–3 scenarios is fine. Status=`ok` requires at least: happy-path (ru+en) + one edge case.

---

# Phase 2: Batch A — P0 core (5 sections)

Sections: 01 dashboard, 02 bookings-list, 04 booking-detail, 06 checkin-checkout, 10 folio.

## Task A1: Section 01 — Dashboard (`/`)

**Files:**
- Create: `tools/ui-audit/src/01-dashboard.spec.ts`
- Create: `docs/ui-audit/features/01-dashboard.yml`
- Create: `docs/ui-audit/screenshots/01-dashboard-*.png`

**Route:** `/` → resolves to `apps/web/src/app/page.tsx` (or the dashboard component co-located). Check for a `redirect` in `middleware.ts`.

**Help topic:** `dashboard`.

**Suggested scenarios (4):**
- `01-empty-state-happy-path`: Load dashboard under admin; verify KPI cards (occupied/vacant/dirty/clean/inspected) render numeric values.
- `02-arrivals-today`: Verify Arrivals Today list loads; if bookings exist for today, at least one row shown; else empty-state text visible.
- `03-click-through-bookings`: Click "Arrivals Today" section header / link → navigates to `/bookings?tab=arrivals` (or equivalent).
- `04-business-date-visible`: Verify business date shown in topbar; compare value against `GET /api/business-date` response.

**Edge case flagged by plan §6.01:** "what dashboard shows if no open business-date" — investigate but do NOT force-close a business date. If hard to reproduce, note in `edge_cases` as `not_tested`.

- [ ] **Step 1: Execute protocol steps 1–9 for section 01**

Follow the 9-step "Section Audit Protocol" above with these specifics:
- Slug: `dashboard`
- Section ID: `01-dashboard`
- Route: `/`
- Help topic: `dashboard`
- Target scenarios listed above

Run, fill YAML, triage, commit. Use commit message:
```
feat(ui-audit): section 01 dashboard — <ok|partial|broken>
```

## Task A2: Section 02 — Bookings list (`/bookings`)

**Files:**
- Create: `tools/ui-audit/src/02-bookings-list.spec.ts`
- Create: `docs/ui-audit/features/02-bookings-list.yml`

**Route:** `/bookings` → `apps/web/src/app/bookings/page.tsx`.

**Help topic:** `bookings`.

**Suggested scenarios (5):**
- `01-tab-all`: Load page; default tab (All) shows ≥ 1 booking.
- `02-tab-arrivals`: Click Arrivals tab; list filters to today's check-ins (validate via `GET /api/bookings?arrivalsOn=…`).
- `03-tab-in-house`: Click In-House tab; only `status=checked_in` shown.
- `04-status-filter`: Apply status filter (e.g., Confirmed); UI updates; URL query syncs (if applicable).
- `05-click-row-navigates`: Click a booking row → navigate to `/bookings/[id]`, confirm detail page loads.

**Fixtures:** If list is empty (`GET /api/bookings` returns 0), the pilot's `ensureGuests` + a manual POST to `/api/bookings` for one confirmed booking against `SEED.ratePlan.RACK` and `SEED.roomType.standardDouble` is needed. Add a fixture `ensureBooking` in `fixtures.ts` in a preamble step.

- [ ] **Step 1: Add ensureBooking fixture if needed**

Before starting the spec, inspect current bookings:
```bash
curl -s "http://localhost:3001/api/bookings?propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad&limit=5" | head -c 300
```
If `total == 0`, add to `tools/ui-audit/src/fixtures.ts`:

```ts
export async function ensureBooking(minCount = 1): Promise<void> {
  const r = await fetch(`${API_URL}/api/bookings?propertyId=${GBH_PROPERTY_ID}&limit=1`);
  const page = (await r.json()) as { total: number };
  if (page.total >= minCount) return;
  // Minimal happy-path body — adapt if schema changes.
  const guestsRes = await fetch(`${API_URL}/api/profiles?propertyId=${GBH_PROPERTY_ID}&type=individual&limit=1`);
  const guestId = ((await guestsRes.json()) as { data: { id: string }[] }).data[0]?.id;
  if (!guestId) throw new Error('ensureBooking needs at least one guest — run ensureGuests first');
  const today = new Date();
  const ci = new Date(today); ci.setDate(today.getDate() + 1);
  const co = new Date(today); co.setDate(today.getDate() + 3);
  // … build booking payload matching /api/bookings POST schema …
}
```
Verify the exact POST schema at `apps/api/src/routes/bookings.ts` before completing. Commit fixture update as a separate pre-section commit:
```
feat(ui-audit): add ensureBooking fixture
```

- [ ] **Step 2: Execute protocol steps 1–9 for section 02**

Commit: `feat(ui-audit): section 02 bookings-list — <status>`

## Task A3: Section 04 — Booking detail (`/bookings/[id]`)

**Files:**
- Create: `tools/ui-audit/src/04-booking-detail.spec.ts`
- Create: `docs/ui-audit/features/04-booking-detail.yml`

**Route:** `/bookings/[id]` → `apps/web/src/app/bookings/[id]/page.tsx`. Uses booking created in batch pre-flight; pick first `GET /api/bookings?limit=1` id.

**Help topic:** `bookings`.

**Suggested scenarios (5):**
- `01-summary-tab-happy`: Load detail page → Summary tab visible with guest/dates/room info.
- `02-folio-visible`: Folio section present (rendered below summary or in separate tab — depends on layout).
- `03-action-cancel`: Click Cancel → dialog → confirm; status transitions to `cancelled`; POST `/api/bookings/:id/cancel` returns 200.
- `04-action-reinstate`: After cancel, click Reinstate; status back to `confirmed`. (⚠ FEAT-011 flag in plan: check where cancellation reason goes — expected to be visible in history/audit log or lost. Record observation without fixing.)
- `05-action-checkin-gated`: Click Check-In on `confirmed` booking; if room is dirty, dialog asks for force; if OOO/OOS, hard block. Do not actually complete checkin (leaves state clean).

**Fixtures:** needs one `confirmed` booking. Reuse from batch prep.

- [ ] **Step 1: Execute protocol steps 1–9 for section 04**

Commit: `feat(ui-audit): section 04 booking-detail — <status>`

## Task A4: Section 06 — Check-in / Check-out flow

**Files:**
- Create: `tools/ui-audit/src/06-checkin-checkout.spec.ts`
- Create: `docs/ui-audit/features/06-checkin-checkout.yml`

**Route:** flow through `/bookings/[id]` actions. No standalone page.

**Help topic:** `check-in-out`.

**Suggested scenarios (5):**
- `01-checkin-clean-room`: Create a confirmed booking on a clean room; Check-In action succeeds; status → `checked_in`; `POST /api/bookings/:id/check-in` 200.
- `02-checkin-dirty-force`: Booking with dirty room → Check-In opens force-confirm dialog → Confirm → success.
- `03-checkin-oos-blocked`: Booking with OOS room → Check-In blocked (button disabled or hard error).
- `04-checkout-zero-balance`: Checked-in booking, folio balance = 0 → Check-Out action succeeds; status → `checked_out`.
- `05-checkout-nonzero-balance-warning`: Checked-in booking with unpaid charges → Check-Out shows warning about outstanding balance. Do not force past it (read-only observation).

**Fixtures:** `ensureBooking`, plus a variant targeting a dirty room and one targeting OOS room. Add `ensureCheckedInBooking` to `fixtures.ts` if helpful.

**Complexity note:** Multiple state transitions. Use `test.describe.serial()` so tests run in deterministic order if they share booking state.

- [ ] **Step 1: Execute protocol steps 1–9 for section 06**

Commit: `feat(ui-audit): section 06 checkin-checkout — <status>`

## Task A5: Section 10 — Folio

**Files:**
- Create: `tools/ui-audit/src/10-folio.spec.ts`
- Create: `docs/ui-audit/features/10-folio.yml`

**Route:** `/bookings/[id]` → FolioSection. Component at `apps/web/src/app/bookings/[id]/folio-section.tsx` (verify filename).

**Help topic:** `folio`.

**Suggested scenarios (5):**
- `01-window-stack-render`: Open booking detail of a checked-in booking with > 1 folio window; verify all windows render stacked (not tabbed).
- `02-post-charge`: Open post-charge form on window 1; pick a charge transaction code (e.g., Room) from `/api/transaction-codes`; amount 1000; submit; row appears; balance updates.
- `03-post-payment`: Post a payment (e.g., Cash) equal to outstanding balance; balance → 0.
- `04-zero-balance-window`: Verify empty window and zero-balance window both render without error.
- `05-positive-balance-highlight`: A window with positive balance shows highlighted total (verify CSS class or badge in DOM).

**Fixtures:** `ensureCheckedInBooking` (dependency on A4).

- [ ] **Step 1: Execute protocol steps 1–9 for section 10**

Commit: `feat(ui-audit): section 10 folio — <status>`

## Task A6: Batch A retro + user gate

**Files:**
- Create: `docs/ui-audit/batch-a-retro.md`

- [ ] **Step 1: Write batch retro**

Template:

```md
# Batch A Retrospective

**Date:** <YYYY-MM-DD>
**Sections covered:** 01, 02, 04, 06, 10 (5 sections)
**Status histogram:** ok=X partial=X broken=X
**Bugs filed:** X (BUG-NNN..BUG-NNN)
**Unblocker fixes:** X

## New helpers added / fixtures extended
- <list>

## Methodology deltas
- <list>

## Risks for remaining batches
- <list>

## Ready for batch B?
- [ ] Yes — user approval recorded.
```

Fill with real numbers and observations.

- [ ] **Step 2: Aggregate and validate**

```bash
pnpm --filter @pms/ui-audit aggregate
pnpm --filter @pms/ui-audit validate-yaml
```

- [ ] **Step 3: Commit batch-a retro**

```bash
git add docs/ui-audit/batch-a-retro.md docs/ui-audit/index.yml
git commit -m "$(cat <<'EOF'
docs(ui-audit): batch A retro (sections 01, 02, 04, 06, 10)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: USER GATE — STOP**

Post to user:

> Batch A complete. Retro at `docs/ui-audit/batch-a-retro.md`. Sections done: 01, 02, 04, 06, 10. Status: <summary>. Awaiting your approval to proceed to Batch B.

**Do not start Task B1 until user says "go" or equivalent.**

---

# Phase 3: Batch B — P0 ops (3 sections)

Sections: 09 housekeeping, 12 night-audit, 17 rate-plans config.

## Task B1: Section 09 — Housekeeping (`/housekeeping`)

**Files:**
- Create: `tools/ui-audit/src/09-housekeeping.spec.ts`
- Create: `docs/ui-audit/features/09-housekeeping.yml`

**Route:** `/housekeeping`.

**Help topic:** `housekeeping` (verify exact id in help-content.tsx; may be absent — if so, set `help_rewrite_hints.topic: null`).

**Suggested scenarios (4):**
- `01-list-render`: Load page; tasks list/kanban renders; at least one task visible (or empty-state).
- `02-generate-tasks`: If "Generate tasks for today" button present, click → new tasks appear.
- `03-assign-task`: Pick a task; assign to a user (via dropdown/button); `PUT/POST /api/housekeeping/:id` 200.
- `04-complete-task`: Mark task Complete; task status updates; if linked to a room, room's HK status transitions (verify via `GET /api/rooms/:id`).

- [ ] **Step 1: Execute protocol steps 1–9 for section 09**

Commit: `feat(ui-audit): section 09 housekeeping — <status>`

## Task B2: Section 12 — Night Audit (`/night-audit`)

**Files:**
- Create: `tools/ui-audit/src/12-night-audit.spec.ts`
- Create: `docs/ui-audit/features/12-night-audit.yml`

**Route:** `/night-audit`.

**Help topic:** `night-audit`.

**Warning:** Night audit **closes the business date and opens the next one** — it's a stateful operation. The spec must capture the state, observe, and if the audit is actually run, restore state via DB snapshot or manual reset.

**Suggested scenarios (4):**
- `01-preflight-checklist`: Load page; pre-checklist items visible (e.g., all arrivals checked in, no unpaid checkouts). If items are "blocking," the audit button is disabled.
- `02-blocking-items-listed`: If there ARE blocking items for the current seed state, verify they're named and actionable.
- `03-daily-details`: Verify the "daily details" summary (occupancy, revenue, arrivals/departures counts) matches `GET /api/metrics/daily` or equivalent.
- `04-button-disabled-unless-clean`: Confirm the "Run night audit" button exists but is disabled or requires all preflight cleared. **Do NOT click it** in this spec.

**C3 note:** If the only way to test meaningfully is to run the audit, halt the section with partial status + note "audit execution requires DB snapshot harness — deferred".

- [ ] **Step 1: Before writing spec, snapshot DB**

```bash
pg_dump pms_dev > /tmp/pms-batch-b-night-audit-snapshot.sql
ls -la /tmp/pms-batch-b-night-audit-snapshot.sql
```
Keep the snapshot path in the section YAML `retro.unblocker_fixes` metadata.

- [ ] **Step 2: Execute protocol steps 1–9 for section 12**

Commit: `feat(ui-audit): section 12 night-audit — <status>`

## Task B3: Section 17 — Rate Plans config (`/configuration/rate-plans`)

**Files:**
- Create: `tools/ui-audit/src/17-configuration-rate-plans.spec.ts`
- Create: `docs/ui-audit/features/17-configuration-rate-plans.yml`

**Route:** `/configuration/rate-plans`.

**Help topic:** `rate-plans`.

**Suggested scenarios (5):**
- `01-list-render`: Load page; rate-plan list renders; at least `RACK` + `PROMO` present.
- `02-one-base-rate`: Exactly one plan has ★ Base Rate flag.
- `03-create-new-plan`: Open New; fill code/name/description; submit; plan appears.
- `04-matrix-edit`: Pick existing plan; open rate matrix; edit one cell (room type × season); save; `PUT /api/rate-plans/:id/room-rates` 200; value persists on reload.
- `05-delete-blocked-when-booked`: Try to delete a plan with existing bookings (RACK) → UI blocks or API 409.

**Fixtures:** none specific.

- [ ] **Step 1: Execute protocol steps 1–9 for section 17**

Commit: `feat(ui-audit): section 17 rate-plans — <status>`

## Task B4: Batch B retro + user gate

- [ ] **Step 1: Write batch retro**

`docs/ui-audit/batch-b-retro.md`, same template as batch A.

- [ ] **Step 2: Aggregate, validate, commit**

```bash
pnpm --filter @pms/ui-audit aggregate
pnpm --filter @pms/ui-audit validate-yaml
git add docs/ui-audit/batch-b-retro.md docs/ui-audit/index.yml
git commit -m "docs(ui-audit): batch B retro (sections 09, 12, 17)"
```

- [ ] **Step 3: USER GATE — STOP**

Post: "Batch B complete… awaiting approval to proceed to Batch C."

---

# Phase 4: Batch C — P1 (9 sections)

Sections: 05, 07, 08, 11, 15, 16, 18, 19, 22. These are mostly CRUD patterns — expect fast per-section execution once the first 2–3 land.

## Task C1: Section 05 — Booking edit (`/bookings/[id]/edit`)

**Help topic:** `bookings`.

**Suggested scenarios (4):**
- `01-load-edit-form`: Open edit page for a confirmed booking; editable fields visible (dates, room, adults/children, notes).
- `02-edit-dates-save`: Change dates; submit; `PUT /api/bookings/:id` 200; redirect to detail; values updated.
- `03-edit-blocked-after-checkin`: Open edit page for a checked-in booking — form either redirects, shows read-only, or blocks save with a message.
- `04-validation-checkout-before-checkin`: Set checkOut = checkIn - 1; dateError shown; submit disabled. (Same helper as pilot.)

- [ ] **Execute protocol** — commit `feat(ui-audit): section 05 booking-edit — <status>`.

## Task C2: Section 07 — Rooms list (`/rooms`)

**Help topic:** `rooms`.

**Suggested scenarios (4):**
- `01-list-render`: Load; rooms list or matrix renders; counts match `GET /api/rooms?propertyId=…&total`.
- `02-filter-hk-dirty`: Apply HK filter → Dirty; only dirty rooms shown; URL query sync.
- `03-filter-room-type`: Apply room-type filter → Standard Double; only matching rooms.
- `04-click-navigate`: Click a room → `/rooms/[id]`.

- [ ] **Execute protocol** — commit `feat(ui-audit): section 07 rooms-list — <status>`.

## Task C3: Section 08 — Room detail (`/rooms/[id]`)

**Help topic:** `rooms`.

**Suggested scenarios (4):**
- `01-load-detail`: Open `/rooms/[id]` for a clean room; detail renders; current HK status visible; no current booking banner.
- `02-hk-transition`: Change HK status Dirty → Clean → Inspected; `PUT /api/rooms/:id/hk-status` 200 for each; status updates.
- `03-set-ooo`: Put room OOO with dates + reason; `PUT /api/rooms/:id` 200; banner shows OOO.
- `04-restore-from-ooo`: Clear OOO; room returns to normal status.

- [ ] **Execute protocol** — commit `feat(ui-audit): section 08 room-detail — <status>`.

## Task C4: Section 11 — Profiles (`/guests`)

**Help topic:** `guests`.

**Suggested scenarios (5):**
- `01-list-render`: Load; guests list; counts match API.
- `02-filter-type`: Switch type (individual/company/travel_agent); list re-filters.
- `03-create-guest`: New individual with first/last/email; submit; `POST /api/profiles` 201; appears in list.
- `04-view-guest-history`: Open a guest; history tab shows past bookings list.
- `05-edit-guest`: Edit a guest's email; `PUT /api/profiles/:id` 200; value persists.

- [ ] **Execute protocol** — commit `feat(ui-audit): section 11 profiles — <status>`.

## Task C5: Section 15 — Configuration: Property

**Help topic:** `configuration`.

**Suggested scenarios (3):**
- `01-load-view`: Load `/configuration/property`; fields pre-filled from GBH.
- `02-edit-text`: Change the description/address field; save; `PUT /api/properties/:id` 200.
- `03-validation-rooms-count`: Try to set `numberOfRooms` below actual room count → UI/API rejects.

- [ ] **Execute protocol** — commit `feat(ui-audit): section 15 config-property — <status>`.

## Task C6: Section 16 — Configuration: Room Types

**Help topic:** `configuration`.

**Suggested scenarios (4):**
- `01-list-create`: List view; create new type; appears.
- `02-edit`: Edit name; save; persists.
- `03-associated-rooms`: Open a type with rooms; associated rooms list visible.
- `04-delete-blocked`: Try delete type that has rooms or bookings → blocked.

- [ ] **Execute protocol** — commit `feat(ui-audit): section 16 config-room-types — <status>`.

## Task C7: Section 18 — Configuration: Transaction Codes

**Help topic:** `configuration`.

**Suggested scenarios (4):**
- `01-list-create`: Create new txn code (type: charge).
- `02-toggle-manual-post`: Toggle manualPostAllowed; save; persists.
- `03-edit`: Edit description; save.
- `04-delete-blocked`: Delete code with transactions → blocked.

- [ ] **Execute protocol** — commit `feat(ui-audit): section 18 config-txn-codes — <status>`.

## Task C8: Section 19 — Configuration: Packages

**Help topic:** `configuration`.

**Suggested scenarios (4):**
- `01-list-create`: Create package with name + code + price.
- `02-edit-components`: Add a component (charge line).
- `03-attach-to-rate-plan`: Attach package to RACK; verify via rate-plan detail.
- `04-delete`: Delete unused package.

- [ ] **Execute protocol** — commit `feat(ui-audit): section 19 config-packages — <status>`.

## Task C9: Section 22 — Help (`/help`)

**Help topic:** self-referential — the help system itself.

**Suggested scenarios (4):**
- `01-hub-render`: Load `/help`; all 9 topic cards visible; status/color legend present.
- `02-open-topic-bookings`: Click Bookings card → `/help/bookings`; content renders non-empty.
- `03-all-topics-non-empty`: For each topic id in `help-content.tsx`, open `/help/<id>` and assert `main` has non-empty text content. Iterate programmatically in a single test.
- `04-missing-topic-404`: Open `/help/nonexistent` → 404 page (or graceful handling).

- [ ] **Execute protocol** — commit `feat(ui-audit): section 22 help — <status>`.

## Task C10: Batch C retro + user gate

- [ ] **Step 1: Write `docs/ui-audit/batch-c-retro.md`** (same template).
- [ ] **Step 2: Aggregate, validate, commit** (same commands).
- [ ] **Step 3: USER GATE — STOP.** Post: "Batch C complete. 9 sections. Status: <summary>. Awaiting approval for Batch D."

---

# Phase 5: Batch D — P2 (6 sections)

Sections: 13, 14, 20, 21, 23, 24. Smaller-scope.

## Task D1: Section 13 — Cashier (`/cashier`)

**Help topic:** none (skip `help_rewrite_hints.topic` = null).

**Suggested scenarios (3):**
- `01-load-view`: Load page; what is shown (cashier workspace, pending charges, etc.).
- `02-primary-operation`: Execute the main advertised operation (shift open? post? — read code to decide).
- `03-empty-state`: Verify handling when no transactions today.

- [ ] **Execute protocol** — commit `feat(ui-audit): section 13 cashier — <status>`.

## Task D2: Section 14 — Tape chart (`/tape-chart`)

**Help topic:** none.

**Special note:** Drag-and-drop of bookings may or may not be implemented. Native drag API is hard in Playwright; prefer `dragTo` or skip drag scenario if not trivial.

**Suggested scenarios (4):**
- `01-render-timeline`: Load; timeline shows rooms on Y-axis, dates on X; booking bars visible where expected.
- `02-switch-period`: Change period (week/month/day); view updates.
- `03-click-bar`: Click a booking bar → navigates to `/bookings/[id]`.
- `04-drag-move` (if supported): Drag a booking bar to another room cell → `PUT /api/bookings/:id` with new roomId. If drag isn't implemented or Playwright can't reach it, record as `not_tested` in edge_cases.

- [ ] **Execute protocol** — commit `feat(ui-audit): section 14 tape-chart — <status>`.

## Task D3: Section 20 — Configuration: Guarantee Codes

**Help topic:** `configuration`.

**Suggested scenarios (3):** list, create, edit, delete (CRUD-only, pattern like section 18).

- [ ] **Execute protocol** — commit `feat(ui-audit): section 20 config-guarantee-codes — <status>`.

## Task D4: Section 21 — Configuration: Profiles (`/configuration/profiles`)

**Help topic:** none or `guests` (verify — if the page is separate from `/guests`, document as `missing` candidate).

**Suggested scenarios (2):**
- `01-load-view`: Load page; what it shows vs `/guests`.
- `02-difference-from-guests`: Document delta (if any). If the page is a duplicate/vestigial, set status=`partial` or `missing`.

- [ ] **Execute protocol** — commit `feat(ui-audit): section 21 config-profiles — <status>`.

## Task D5: Section 23 — Login (`/login`)

**Help topic:** none.

**Suggested scenarios (3):**
- `01-load`: Navigate to `/login` while logged out; form renders (username, password, submit).
- `02-happy-login`: Submit admin/admin123; redirect to `/`; cookie set.
- `03-invalid-credentials`: Submit admin/wrong; error message shown; no redirect.

- [ ] **Execute protocol** — commit `feat(ui-audit): section 23 login — <status>`.

## Task D6: Section 24 — i18n + theme

**Help topic:** none.

**Suggested scenarios (3):**
- `01-locale-toggle`: Find locale toggle; switch ru → en; page re-renders with english strings (sample 3 buttons across 2 pages).
- `02-theme-toggle` (if implemented): Switch theme; CSS class updates.
- `03-no-hardcoded-strings`: Visit 5 sampled pages in en locale; no russian text should leak through. (Visual-regression style; spot-check selectors.)

- [ ] **Execute protocol** — commit `feat(ui-audit): section 24 i18n-theme — <status>`.

## Task D7: Batch D retro + user gate

- [ ] **Step 1: Write `docs/ui-audit/batch-d-retro.md`**.
- [ ] **Step 2: Aggregate, validate, commit**.
- [ ] **Step 3: USER GATE — STOP.** Post: "Batch D complete. Ready for full-run finalization."

---

# Phase 6: Finalization

## Task F1: Aggregate full-run retro

**Files:**
- Create: `docs/ui-audit/full-run-retro.md`

- [ ] **Step 1: Write full-run retro**

Template:

```md
# UI Audit Full-Run Retrospective

**Dates:** <start>–<end>
**Branch:** feat/design-system
**Sections completed:** 24/24 (pilot 03 + 23 full-run)
**Status histogram:**
  ok: N
  partial: N
  broken: N
  missing: N
**Bugs filed:** N (BUG-NNN..BUG-NNN)
**Total commits:** N

## Cross-section patterns
- <top 3–5 recurring bug types>
- <top 3–5 recurring help deltas>

## Methodology refinements (beyond pilot)
- <what the batches added to the harness>

## Time spent
- Batch A: Nh (Navg per section)
- Batch B: Nh
- Batch C: Nh
- Batch D: Nh
- Total: Nh

## Handoff to help-rewrite initiative
- Sections with help_rewrite_hints filled: N
- Sections flagged as needing a new help topic: <list>

## Open questions / deferred work
- <list>
```

Fill with real data.

- [ ] **Step 2: Final aggregate + validate**

```bash
pnpm --filter @pms/ui-audit aggregate
pnpm --filter @pms/ui-audit validate-yaml
pnpm --filter @pms/ui-audit test 2>&1 | tail -5
```
Expected: all green; `index.yml.totals.pending == 0`.

- [ ] **Step 3: Commit**

```bash
git add docs/ui-audit/full-run-retro.md docs/ui-audit/index.yml
git commit -m "$(cat <<'EOF'
docs(ui-audit): full-run complete — retro + final aggregate

All 24 sections audited. Status histogram and bug list in full-run-retro.md.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

## Task F2: PR-readiness handoff

- [ ] **Step 1: Verify final state**

```bash
cd /home/oci/pms
git status --short           # must be empty
git log --oneline main..HEAD | head -40
ls docs/ui-audit/features/ | wc -l   # expect 25 (24 + _template)
find docs/ui-audit/screenshots -name '*.png' | wc -l   # expect >= 200
```

- [ ] **Step 2: Report to user**

Post:
> Full-run complete. 24 sections on `feat/design-system`. Status: <summary>. Bugs filed: N. Next: user to open PR combining design-system + audit, and to scope help-rewrite initiative as a separate plan.

Do NOT open the PR without explicit user instruction.

---

# Stop criteria (from spec §12)

### Happy path (full-run done)
- [ ] All 24 features/*.yml exist; `totals.pending == 0`.
- [ ] Every referenced screenshot exists.
- [ ] Full test suite green.
- [ ] All batch retros committed.
- [ ] full-run-retro.md committed.
- [ ] `git status` clean.
- [ ] User notified.

### Halt
Triggered by:
- Critical-severity finding → stop current section, commit `docs(ui-audit): blocked — critical finding in NN`.
- > 2 unblocker fixes in a batch → batch-halt doc, stop.
- Batch wall-clock > 2× estimate → halt that batch, retro early, discuss.
- Hard error in `api-probe` that can't be resolved in 30 min → halt, investigate seed.

---

# Appendix: Help-topic mapping (from spec §16)

Verified against current `apps/web/src/app/help/[topic]/help-content.tsx` before starting Task A1.

| Section | Help topic id | Notes |
|---|---|---|
| 01 dashboard | `dashboard` | |
| 02 bookings-list | `bookings` | |
| 03 booking-create | `bookings` | (pilot, done) |
| 04 booking-detail | `bookings` | |
| 05 booking-edit | `bookings` | |
| 06 checkin-checkout | `check-in-out` | |
| 07 rooms-list | `rooms` | |
| 08 room-detail | `rooms` | |
| 09 housekeeping | `housekeeping` | verify id at Task B1 |
| 10 folio | `folio` | |
| 11 profiles | `guests` | |
| 12 night-audit | `night-audit` | |
| 13 cashier | null | no topic |
| 14 tape-chart | null | |
| 15 config-property | `configuration` | |
| 16 config-room-types | `configuration` | |
| 17 rate-plans | `rate-plans` or `configuration` | verify at Task B3 |
| 18 config-txn-codes | `configuration` | |
| 19 config-packages | `configuration` | |
| 20 config-guarantee-codes | `configuration` | |
| 21 config-profiles | `guests` or null | |
| 22 help | null (self-referential; skip hints) | |
| 23 login | null | |
| 24 i18n-theme | null | |

If the verification at section-start reveals a drift (e.g., `rate-plans` is a sub-section of `configuration` not a standalone topic), record in the section YAML and in the batch retro.

---

# Appendix: Section → spec-filename convention

- `01-dashboard.spec.ts`
- `02-bookings-list.spec.ts`
- `04-booking-detail.spec.ts`
- `05-booking-edit.spec.ts`
- `06-checkin-checkout.spec.ts`
- `07-rooms-list.spec.ts`
- `08-room-detail.spec.ts`
- `09-housekeeping.spec.ts`
- `10-folio.spec.ts`
- `11-profiles.spec.ts`
- `12-night-audit.spec.ts`
- `13-cashier.spec.ts`
- `14-tape-chart.spec.ts`
- `15-configuration-property.spec.ts`
- `16-configuration-room-types.spec.ts`
- `17-configuration-rate-plans.spec.ts`
- `18-configuration-transaction-codes.spec.ts`
- `19-configuration-packages.spec.ts`
- `20-configuration-guarantee-codes.spec.ts`
- `21-configuration-profiles.spec.ts`
- `22-help.spec.ts`
- `23-login.spec.ts`
- `24-i18n-theme.spec.ts`

YAML files mirror these names under `docs/ui-audit/features/` with `.yml` extension.
