# UI Audit Execution — Design

**Created:** 2026-04-21
**Related plan:** [`docs/ui-audit-plan.md`](../../ui-audit-plan.md)
**Scaffolding:** [`docs/ui-audit/`](../../ui-audit/)
**Status:** approved by user, ready for writing-plans

---

## 1. Overview

Plan `docs/ui-audit-plan.md` defines a 24-section headless Playwright audit across the PMS UI, producing YAML + screenshots that will drive a rewrite of the in-app help content. The plan is comprehensive but has never been executed end-to-end; its YAML schema, time estimates, and subagent-orchestration assumptions are unverified.

This spec defines **how** we execute the plan, in two phases:

- **Pilot phase** — one autonomous session runs section `03 booking-create` end-to-end, produces artifacts, writes a retrospective identifying any methodology gaps. The user reviews pilot output before green-lighting full-run.
- **Full-run phase** — subsequent sessions run the remaining 23 sections under a parallel subagent architecture, using the corrected methodology from the pilot.

The pilot is deliberately scoped to validate methodology, not to produce comprehensive audit coverage.

## 2. Goals

- **Primary:** validate that the audit plan is executable as written, by running one section all the way through.
- **Secondary:** produce a complete, committed audit artifact for section 03 (YAML + screenshots + bugs + retro).
- **Tertiary:** produce a concrete corrections list for the plan/template before the full-run commits to 23 more sections.

## 3. Scope

### In scope (pilot)

- Section `03 booking-create` fully audited per plan §7 protocol, in both `ru` and `en` locales.
- Initialize `tools/ui-audit/` as a new pnpm workspace package with Playwright.
- Populated artifacts in `docs/ui-audit/`: `features/03-booking-create.yml`, `scripts/03-booking-create.spec.ts`, `screenshots/03-booking-create-*.png`, `bugs.yml`, `backlog.json` (append), `index.yml` (section 03 updated).
- `docs/ui-audit/pilot-retro.md` capturing methodology observations, time/token measurements, and required corrections for full-run.
- Unblocker-only code fixes (C3 policy, §7).

### Out of scope (pilot)

- Any other audit section (01, 02, 04, …). Even if "quickly verifiable" — no.
- Harness refactoring for parallel subagent execution (pilot is monolithic; parallel infra lands with full-run).
- Rewriting help content (a separate downstream initiative after full-run completes).
- README/docs additions beyond what the plan protocol requires.
- Dependency upgrades in `apps/web`.

### Full-run (deferred, designed here but executed later)

- Sections 01, 02, 04–24 per plan priorities (P0 → P1 → P2).
- Subagent-per-section execution model (see §6.2).
- §6.2 is the starting shape; pilot retro is expected to produce concrete adjustments before the full-run plan is written.

## 4. Infrastructure

### 4.1. New package: `tools/ui-audit/`

Directory layout:

```
tools/ui-audit/
  package.json          # name: "@pms/ui-audit", private: true
  tsconfig.json         # extends repo root tsconfig, strict
  playwright.config.ts  # headless chromium, ru+en projects, retries=0, baseURL from env
  .gitignore            # playwright-report/, test-results/, node_modules/
  src/
    shared.ts           # helpers: waitForApi, navigateWithLocale, takeLocaleScreenshot, collectConsoleErrors, collectNetworkErrors
    fixtures.ts         # API-based seed helpers (create profile, create rate plan if pre-flight short)
    03-booking-create.spec.ts
```

Registered in root `pnpm-workspace.yaml`.

Dev dependencies: `@playwright/test`, `typescript`, `@types/node`. Nothing else.

Scripts in package.json:
- `test` — `playwright test`
- `test:ru` — `playwright test --project=ru`
- `test:en` — `playwright test --project=en`
- `install-browsers` — `playwright install chromium`

### 4.2. Artifact split

- **Harness** (code, Playwright config, reusable helpers) → `tools/ui-audit/`.
- **Reports** (YAML, screenshots, bugs.yml, index.yml, retro) → `docs/ui-audit/` (the existing scaffolded location; the human-readable audit output).

The harness is a tool; it could be deleted after the audit completes without losing the audit itself.

### 4.3. Configuration

`playwright.config.ts`:
- `baseURL` from env `AUDIT_WEB_URL`, default `http://localhost:3000`
- Projects: `{ name: 'ru', use: { locale: 'ru' } }`, `{ name: 'en', use: { locale: 'en' } }`
- `headless: true`, `retries: 0`, `workers: 1` (pilot is sequential)
- Screenshot path hook routes to `docs/ui-audit/screenshots/`

## 5. Pre-flight

Before the pilot begins, these checks run automatically. Output logged verbatim for the retro.

| # | Check | Auto-remediation |
|---|---|---|
| 1 | `curl http://localhost:3001/health` → 200 | One attempt via `memory/deploy_procedure.md`, else stop |
| 2 | `curl http://localhost:3000/` → 200 | Same as #1 |
| 3 | `curl /api/properties` includes property with `code: "GBH"` | Stop (missing seed) |
| 4 | `curl /api/business-dates?propertyId=<GBH>&status=open` ≥ 1 | One attempt: POST to open today; else stop |
| 5 | `curl /api/rate-plans?propertyId=<GBH>` ≥ 1 active | One attempt: POST default plan; else stop |
| 6 | `curl /api/room-types?propertyId=<GBH>` ≥ 1 | Stop (missing seed) |
| 7 | `curl /api/profiles?type=guest` ≥ 3 guests | One attempt: POST 3 fixture guests via fixtures.ts; else stop |
| 8 | `pg_dump` → `/tmp/pms-pilot-snapshot-YYYYMMDD-HHMM.sql` | Stop if pg_dump fails |

**Failure rules:**
- Each pre-flight check gets at most one auto-remediation attempt.
- Across the whole pre-flight phase, total auto-remediation attempts are capped at 2. If the first check fails and its remediation doesn't restore it, the audit won't keep trying to patch a broken environment — it stops.
- Any remaining failure → stop, write pilot-retro.md with exact failure output, commit as `docs(audit): pilot blocked — pre-flight failure`, wait for user.

**Additional verification:** visit `/bookings/new` via Playwright and confirm no redirect to `/login` (auth is disabled per BUG-001; verify that assumption still holds).

## 6. Execution model

### 6.1. Pilot — monolithic

The pilot runs entirely in the orchestrator session (Opus 4.7, high effort). No subagent dispatch. Rationale:

- One section × Opus is affordable.
- Full context of all problems encountered feeds a higher-quality retrospective.
- Zero handoff risk — the whole point of the pilot is to produce reliable observations for the full-run design.

**Pilot workflow (serial):**

1. Pre-flight (§5).
2. Scaffold `tools/ui-audit/` package (one-time setup).
3. Read `apps/web/src/app/bookings/new/page.tsx` and direct dependencies.
4. Enumerate scenarios (4–6 items): empty submit, happy path, checkOut ≤ checkIn, unavailable room, inline new-guest creation, rate-plan → rateAmount population.
5. Write `03-booking-create.spec.ts` with scenarios and screenshot capture per step.
6. Run `pnpm --filter @pms/ui-audit test:ru` and `test:en`, collect console/network errors.
7. Fill `docs/ui-audit/features/03-booking-create.yml` per `_template.yml` structure.
8. Triage any bugs found → `bugs.yml` + `docs/backlog.json`.
9. Write `help_rewrite_hints` block in the YAML (Opus-quality text).
10. Update `docs/ui-audit/index.yml` (status, generated timestamp, app_commit).
11. Write `pilot-retro.md` (§10).
12. Commits (§8).

### 6.2. Full-run — subagent-per-section (design, deferred)

For future sessions after pilot approval. Recorded here so full-run planning has concrete starting point.

- **Orchestrator** (Opus 4.7, high effort) runs in the main session. Responsibilities: pre-flight, subagent dispatch, verification of subagent output, Opus-quality tasks (help_rewrite_hints polishing, severity triage, status decisions, retro-per-section notes), commits, index.yml updates.
- **Section subagent** (`Agent(subagent_type=general-purpose, model=sonnet)`, high effort) per section. Receives a self-contained brief containing: plan path, template path, pilot-approved methodology reference, section-specific scenarios (from plan §6 section description), return-format spec. Responsibilities: read page source, write spec, run Playwright, collect artifacts, fill YAML, return structured report. Does NOT commit.
- **Parallelism:** up to 3 concurrent subagents on independent sections (e.g., Configuration subsections 15, 16, 18 run together). Orchestrator throttles and merges results sequentially.
- **Verification:** orchestrator reads YAML syntax, confirms every screenshot referenced exists, spot-checks spec correctness. One retry on incomplete artifacts with explicit diff of what's missing.

The full-run structure MUST be revisited after pilot-retro — adjustments are expected.

## 7. Model & effort routing

| Stage | Model | Effort | Runs in |
|---|---|---|---|
| Pre-flight execution | n/a (shell) | low | orchestrator |
| Package scaffolding | Opus | medium | orchestrator (pilot) |
| Read page.tsx, enumerate scenarios | Opus (pilot) / Sonnet (full-run subagent) | medium/high | as applicable |
| Write Playwright spec | Opus (pilot) / Sonnet (full-run subagent) | high | as applicable |
| Run Playwright + collect artifacts | (mechanical) | low | as applicable |
| Fill YAML per template | (templated from collected data) | low | as applicable |
| Bug severity triage | Opus | high | orchestrator |
| `help_rewrite_hints` writing | Opus | high | orchestrator |
| status decision (ok/partial/broken) | Opus | high | orchestrator |
| pilot-retro / per-section retro | Opus | high | orchestrator |

For the pilot, "orchestrator" = the only session; all work is Opus. For full-run, subagent tasks run Sonnet; only the Opus-labeled stages stay in the main session.

## 8. Bug handling policy (C3 — unblocker-only fixes)

**Rule:** during the audit, code changes outside of `docs/ui-audit/` and `tools/ui-audit/` are allowed ONLY when they unblock the currently-audited scenario from completing.

**In all other cases** — including cosmetic i18n bugs, minor copy issues, obvious typos — document only. No inline fixes. Accumulate in `bugs.yml` + `backlog.json`.

**When applying an unblocker fix:**
- Fix is strictly scoped to the current scenario's blocker.
- Fix lives in its own commit, separate from audit artifact commits. Commit prefix `fix(<area>):`.
- If the fix changes UI, retake the affected screenshot and update the YAML.
- Pre-existing tests must still pass (`pnpm test` or equivalent for the touched area).

**Critical-severity finding (data loss, auth bypass, financial calculation error, silent data corruption):**
- Stop the audit immediately.
- Record observation in `pilot-retro.md` under "Critical findings".
- Do NOT attempt to fix.
- Commit current state (`docs(audit): pilot blocked — critical finding`) and wait for user.

## 9. Locale coverage

Pilot tests both `ru` and `en`. YAML `ui.buttons.*`, `ui.required_fields.*`, and all `label_ru`/`label_en` fields populated from actual observed text in each locale.

Each happy-path screenshot captured in both locales (`…-ru.png`, `…-en.png`). Edge-case screenshots captured in `ru` only unless the edge case involves text that differs between locales (e.g., error messages).

## 10. Pilot retrospective document

Location: `docs/ui-audit/pilot-retro.md`.

```md
# Pilot Retrospective — Section 03 (booking-create)

## Execution
- Started: <ISO timestamp>
- Ended: <ISO timestamp>
- Duration: <minutes>
- Outcome: completed | blocked-partial | blocked-preflight
- Main-context tokens used: <approx>
- Commit(s): <sha list>

## Methodology validation
- YAML schema — what fit, what didn't
- Template coverage — fields that were added or unused
- Playwright patterns worth keeping in shared.ts
- Screenshot naming convention — adequate or revise

## Time extrapolation
- Pilot: X min for 1 section
- Estimate for 24 sections at same rate: ~N hours
- Risks that would make full-run take 2–3× longer

## Changes needed before full-run
- [ ] Updates to `_template.yml`: …
- [ ] Updates to plan §N: …
- [ ] Additional helpers to add to `shared.ts`: …
- [ ] Adjustments to subagent brief (§6.2): …

## Critical findings
(Empty if none.)

## Bugs found
- BUG-NNN (link to bugs.yml)

## Unblocker fixes applied
- <sha> — <short rationale>

## Open questions for user
- …
```

## 11. Commit structure

Pilot produces these commits, in order:

1. `feat(tools): scaffold tools/ui-audit package with Playwright` — package.json, tsconfig, playwright.config.ts, shared.ts skeleton.
2. `fix(<area>): <desc>` — 0..N unblocker fixes. Each commit atomic. Skipped if no fixes needed.
3. `feat(audit): pilot — section 03 booking-create` — the spec, YAML, screenshots, bugs.yml, backlog.json, index.yml update.
4. `docs(audit): pilot retrospective` — `pilot-retro.md`.

If pilot is halted (pre-flight or critical finding), commits stop at whichever step was reached, plus `docs(audit): pilot blocked — <reason>` describing the halt.

All commits pass pre-commit hooks. Never use `--no-verify`.

## 12. Stop criteria

### Pilot-done (happy path)
All of:
- [ ] `docs/ui-audit/features/03-booking-create.yml` exists and validates as YAML.
- [ ] All screenshots referenced in the YAML exist on disk at the referenced paths.
- [ ] `docs/ui-audit/scripts/03-booking-create.spec.ts` exists and runs green under `test:ru` and `test:en`.
- [ ] `docs/ui-audit/bugs.yml` and `docs/backlog.json` updated (or unchanged if no bugs found).
- [ ] `docs/ui-audit/index.yml` section 03 status set to one of `ok`/`partial`/`broken`; `generated` and `app_commit` populated.
- [ ] `docs/ui-audit/pilot-retro.md` complete per §10.
- [ ] All commits per §11 made, `git status` clean.
- [ ] Short summary posted in the session conversation.

→ Stop. Wait for user review.

### Pilot-stop (halted)

Triggered by any of:
- Pre-flight fails after one auto-remediation attempt.
- Critical-severity finding (§8).
- Playwright installation fails twice in this environment.
- Any single scenario fails > 2 retries without progress (suggests methodology gap).
- Hard time cap exceeded: pilot > 2 hours wall-clock.

→ Write partial pilot-retro.md with "blocked" outcome and cause, commit current state per §11, stop.

## 13. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Playwright fails to install in this env | low | Try twice, then retro with alternatives (puppeteer, raw CDP) — do not improvise further. |
| Auth-disabled assumption (BUG-001) has reverted | low | Pre-flight step: visit `/bookings/new`, assert no redirect to `/login`. |
| Pilot runs > 2h | medium | Hard time cap → stop after current step, retro. |
| Section 03 turns out to not exercise enough of the methodology | medium | Retro explicitly notes X/Y methodology aspects verified, Z not — do NOT add more sections to compensate. |
| Accidental drift into refactoring (C3 violation) | medium | Each code commit passes mental filter: "does this unblock the current scenario specifically?" If not, revert. |
| YAML schema turns out to be wrong on real data | medium | This is a primary pilot goal — retro captures deltas as concrete change list, not freeform notes. |
| Context bloat inside pilot session (many Playwright logs) | low | Use `--reporter=line`, redirect verbose logs to file, read only summary back. |
| Screenshots land in wrong directory | low | shared.ts helper centralizes screenshot path construction. |

## 14. Transition to full-run

After user approves pilot output:

1. Apply changes from pilot-retro "Changes needed before full-run" to `_template.yml`, `plan`, and `shared.ts`. Commit as `chore(audit): pre-full-run adjustments from pilot retro`.
2. New session executes full-run per §6.2. Starting point: `writing-plans` skill produces a concrete implementation plan for the 23 remaining sections with subagent dispatch.
3. Full-run produces per-section commits following the same pattern as pilot.

The full-run plan is explicitly out of scope for this spec — it will be written after pilot retro feeds into it.

---

## Appendix A — Acceptance (pilot)

User approves pilot when:
- Section 03 artifacts are complete per §12 pilot-done criteria.
- `pilot-retro.md` gives a clear, actionable delta list for any plan/template changes.
- No surprises: any deviations from this design were documented and justified inline in the retro.
