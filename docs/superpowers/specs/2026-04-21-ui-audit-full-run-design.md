# UI Audit Full-Run — Design

**Created:** 2026-04-21
**Predecessor:** [`2026-04-21-ui-audit-execution-design.md`](./2026-04-21-ui-audit-execution-design.md) (pilot)
**Pilot retro:** [`docs/ui-audit/pilot-retro.md`](../../ui-audit/pilot-retro.md)
**Plan reference:** [`docs/ui-audit-plan.md`](../../ui-audit-plan.md) §6 (section list), §10 (priorities)
**Status:** approved — decisions resolved in §16, ready for writing-plans

---

## 1. Overview

Pilot (section 03) validated the YAML schema, the harness architecture, and the general Playwright patterns. It also surfaced six methodology gaps (pilot-retro.md §"Что пришлось корректировать") that must be fixed in the harness **before** the remaining 23 sections are executed.

This design covers:

1. One-time adjustments to `tools/ui-audit/` and `docs/ui-audit/` infra that apply retro fixes.
2. Execution model for the 23 remaining sections in batches.
3. Stop criteria, acceptance, and risks.

The resulting implementation plan (one session, `superpowers:writing-plans`) will cite this spec and be executed with or without subagents depending on §16.2.

## 2. Goals

- **Primary:** produce complete, committed audit artifacts (YAML + screenshots + bugs + per-section retros) for sections 01, 02, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24 — totalling 23 sections.
- **Secondary:** produce an aggregated `docs/ui-audit/full-run-retro.md` summarising status across all 24 sections and feeding downstream help-rewrite work.
- **Tertiary:** deliver a clean `docs/ui-audit/index.yml` with every section set to one of `ok`/`partial`/`broken`/`missing`/`pending=0`, and `totals` auto-computed.

## 3. Scope

### In scope

- The 23 remaining sections audited per pilot methodology (see §5).
- Pre-full-run harness adjustments (§4).
- Per-section artifacts: spec `.ts`, YAML report, screenshots (ru+en), per-section retro block inside the YAML.
- Index + bugs aggregation, final retro.
- Unblocker-only code fixes (C3 policy unchanged from pilot).

### Out of scope

- Help content rewrite (`apps/web/src/app/help/[topic]/help-content.tsx`) — deferred to its own initiative once all 24 YAMLs are in.
- Refactoring outside `tools/ui-audit/` and `docs/ui-audit/` (except unblockers).
- Retrofitting pilot artifacts (section 03 stays as-is unless a bug forces regeneration).
- Adding new sections beyond the 24 already listed in the plan.

## 4. Prerequisites

All must be true before writing the implementation plan:

- [ ] User has reviewed `docs/ui-audit/pilot-retro.md` and approved or amended its recommendations.
- [ ] Section 03 artifacts untouched since pilot commit `91219ac`.
- [ ] Branch `feat/design-system` still builds (`pnpm build`) and passes `pnpm --filter @pms/ui-audit test`.
- [ ] Auth still enabled on `feat/design-system` (no revert of BUG-001 in this direction).
- [ ] Decisions in §16 resolved.

## 5. Pre-full-run adjustments

One-time setup, landed as separate commits before section work starts.

### 5.1. Harness upgrades (`tools/ui-audit/`)

| # | File | Change | Why |
|---|---|---|---|
| 1 | `src/shared.ts` | Add `loginAsAdmin(page)` and fold into `setLocaleAndGoto(page, locale, path)` | Pilot retro §2 — every authenticated section needs it; eliminate per-spec duplication |
| 2 | `src/shared.ts` | Add `setNativeValue(locator, value)` helper | Pilot retro §5 — React-controlled native inputs (date, number) need setter-via-prototype + manual dispatch |
| 3 | `src/seed-refs.ts` (new) | Export UUID map: property, rooms (by code), room-types (by code), rate-plans (by code), profiles (by type) | Pilot retro §6 — centralise seed references |
| 4 | `src/fixtures.ts` | Add `ensureGuests`, `ensureCompanies`, `ensureTravelAgents`, `ensureSources`, `ensureActiveBusinessDate` | Pre-flight guarantees for sections that touch profile types beyond `individual` |
| 5 | `src/api-probe.ts` (new) | Probe every endpoint listed in `docs/ui-audit-plan.md` §1 + each section's expected endpoints; block spec run on 404 | Pilot retro §1 — endpoint names in the plan drifted from real routes |
| 6 | `src/build-gate.ts` (new) | Read `.next/BUILD_ID`, log it, fail fast if absent or older than current git HEAD of `apps/web` | Pilot retro §3 — stale `.next/` caused "old UI" screenshots |
| 7 | `src/error-collector.ts` (new) | Move `wireErrorCollectors` + JSON-sidecar write into a dedicated module with per-section path (`audit-data/<section>-errors.json`) | Pilot retro §6 — formalise what pilot did ad-hoc |
| 8 | `playwright.config.ts` | `globalSetup` → `build-gate.ts` + `api-probe.ts`; `workers: 1` (per-section), `retries: 0` | Tests must not run against broken build or missing endpoints |

### 5.2. Artifact tooling (`docs/ui-audit/scripts/`)

| # | File | Change |
|---|---|---|
| 1 | `scripts/aggregate.ts` (new) | Read every `features/*.yml`, recompute `index.yml.totals` (ok/partial/broken/missing/pending + bugs count). Run as `pnpm --filter @pms/ui-audit aggregate` |
| 2 | `scripts/validate-yaml.ts` (new) | Schema-check every `features/*.yml` against a lightweight shape spec; fail CI-style on drift |

### 5.3. Template update

| File | Change |
|---|---|
| `docs/ui-audit/features/_template.yml` | Align blocks with pilot's real YAML: `console_errors`/`network_errors` with `{locale, scenario, ...}` objects, `api_calls_observed` with method+path+optional status/note, `help_rewrite_hints.{current, actual, rewrite}` |

### 5.4. Commits for §5

1. `feat(ui-audit): extract setLocaleAndGoto, setNativeValue, seed-refs`
2. `feat(ui-audit): add build-gate and api-probe globalSetup`
3. `feat(ui-audit): fixtures for all profile types + active business date`
4. `feat(ui-audit): aggregate + validate-yaml scripts`
5. `docs(ui-audit): align _template.yml with pilot schema`

Before any section starts, `pnpm --filter @pms/ui-audit test` must still be green (the updated section-03 spec stays green with the extracted helpers).

## 6. Execution model

### 6.1. Batching

23 sections split into **four batches by priority and domain coupling**:

- **Batch A (P0, booking core, 5 sections):** 01 dashboard, 02 bookings-list, 04 booking-detail, 06 checkin-checkout, 10 folio
- **Batch B (P0, operations, 3 sections):** 09 housekeeping, 12 night-audit, 17 configuration-rate-plans
- **Batch C (P1, 9 sections):** 05 booking-edit, 07 rooms-list, 08 room-detail, 11 profiles, 15 config-property, 16 config-room-types, 18 config-txn-codes, 19 config-packages, 22 help
- **Batch D (P2, 6 sections):** 13 cashier, 14 tape-chart, 20 config-guarantee-codes, 21 config-profiles, 23 login, 24 i18n-theme

Rationale for batching: batches are session-sized units (see §7), users review between batches, each batch has a common helper theme (e.g., batch A needs folio-aware fixtures; batch B needs business-date manipulation).

### 6.2. Per-section workflow (identical for every section)

1. Read page source + i18n strings for the route.
2. Enumerate 4–6 scenarios including happy-path, empty-submit, at least one edge case.
3. Write `NN-<slug>.spec.ts` using shared helpers.
4. Run ru + en projects; confirm 100% green or triage failures.
5. Fill `features/NN-<slug>.yml` using §5.3 schema.
6. Triage any real bugs → `bugs.yml` + `docs/backlog.json`.
7. Commit section artifacts as one commit: `feat(ui-audit): section NN <slug> — <status>`.

### 6.3. Between-section and between-batch steps

- After each section: `pnpm --filter @pms/ui-audit aggregate && pnpm --filter @pms/ui-audit validate-yaml`.
- After each batch: write `docs/ui-audit/batch-<letter>-retro.md` (5–20 lines, just deltas from methodology). Commit as `docs(ui-audit): batch <letter> retro`.
- User review gate between batches (optional — see §16.1).

### 6.4. Final steps (after batch D)

1. Write `docs/ui-audit/full-run-retro.md` (aggregate methodology + timeline + cross-section patterns).
2. Ensure `index.yml.totals.pending = 0`.
3. Commit: `docs(ui-audit): full-run complete — retro + aggregate`.

## 7. Session / model / time budget

**Estimated cost per section** (from pilot): ~1–1.5h Opus with helpers. After §5 adjustments, target is **~45 min** per section (auth + native-input + seed-refs no longer per-spec work).

**Per-batch budget:**

| Batch | Sections | Est. wall-clock | Notes |
|---|---:|---:|---|
| A | 5 | 4–5h | P0, booking core |
| B | 3 | 2–3h | P0, operations (night-audit is more scenarios) |
| C | 9 | 7–9h | P1, mostly config CRUD — patterns repeat fast |
| D | 6 | 4–5h | P2, smaller scope per section |
| §5 setup | — | 2h | One-time |
| **Total** | 23 | **19–24h** | Plus inter-session context reloads |

Model routing unchanged from pilot execution-design §7: Opus for scenario enumeration, YAML filling, `help_rewrite_hints`, status decisions, retros; (optional Sonnet subagents per §16.2).

## 8. Bug handling policy

Unchanged from pilot execution-design §8. C3 unblocker-only. Critical-severity findings halt the batch, not the full run.

**Batch-level halt rule:** if a batch accumulates >2 unblocker fixes, stop and write `docs/ui-audit/batch-<letter>-halt.md` before continuing. Suggests an underlying platform bug worth a separate fix branch.

## 9. Locale coverage

Unchanged: ru + en per section, per scenario. Screenshots for every scenario in both locales unless the scenario is locale-agnostic (e.g., button-click without visible text).

## 10. Retro documents

Three levels:

1. **Per-section retro** — 3–10 lines inside the section YAML `retro:` block (new field, §5.3):
   ```yaml
   retro:
     time_minutes: 42
     unblocker_fixes: []
     methodology_deltas: []
   ```
2. **Per-batch retro** — `docs/ui-audit/batch-<letter>-retro.md` — consolidated findings across that batch, any new helpers proposed.
3. **Full-run retro** — `docs/ui-audit/full-run-retro.md` — pattern analysis, aggregate status, gaps, hand-off to help-rewrite initiative.

## 11. Commit structure

- `feat(ui-audit): <extract/add/fix> <thing>` — §5 setup commits.
- `feat(ui-audit): section NN <slug> — <status>` — one per section.
- `fix(<area>): <desc>` — unblocker fixes, separate commits, same rules as pilot §8.
- `docs(ui-audit): batch <letter> retro` — per batch.
- `docs(ui-audit): full-run complete — retro + aggregate` — final.

All pass pre-commit hooks. Never `--no-verify`.

## 12. Stop criteria

### Full-run-done (happy path)

- [ ] 24 `features/*.yml` files exist; none have `status: pending`.
- [ ] Every screenshot referenced in every YAML exists on disk.
- [ ] All spec files compile and pass under current `pnpm --filter @pms/ui-audit test`.
- [ ] `index.yml.totals` matches the aggregate of section statuses; `totals.pending == 0`.
- [ ] `bugs.yml` contains every triaged bug; each has a matching `docs/backlog.json` entry.
- [ ] `full-run-retro.md` complete per §10.
- [ ] `git status` clean on `feat/design-system`.

### Full-run-halted

Triggered by any of:

- Critical-severity finding (C3 §8 rules).
- More than 2 unblocker fixes in a single batch without resolution (§8 batch-level halt).
- Batch wall-clock > 2× estimate.
- `api-probe.ts` fails hard and cannot be fixed within 30 min.
- User explicitly halts between batches.

→ Write batch-halt or section-halt doc, commit current state, stop.

## 13. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Sections have genuinely broken functionality (status=broken) | high | Expected — status is an output, not a failure. C3 policy prevents scope creep. |
| Harness helpers insufficient for a particular section (e.g., Tape Chart has drag-drop) | medium | Section retro proposes helper addition; if blocking, halt batch and extend harness in its own commit. |
| Context bloat per session after ~5 sections | medium | Each session handles one batch, max 9 sections. New session per batch. |
| Subagent handoff loses context (if §16.2 = parallel) | medium | Each subagent gets self-contained brief referencing this spec + pilot methodology + section-specific scenarios. Orchestrator verifies all artifacts. |
| Seed drift mid-run (someone edits `seed.ts`) | low | `seed-refs.ts` + `api-probe.ts` catch on next section start. |
| YAML schema evolves mid-run | low | `validate-yaml.ts` runs after every section — drift surfaces fast. |
| Help-content writing quality drops in batch D fatigue | medium | Opus for `help_rewrite_hints` always. Skip `help_rewrite_hints` if section has no corresponding help topic (several P2 sections don't). |

## 14. Acceptance

User approves full-run when:

- §12 pilot-done criteria satisfied.
- `full-run-retro.md` identifies: total time spent, final status histogram, top 5 cross-section bug patterns, recommendations for help-rewrite initiative.
- No committed code outside `tools/ui-audit/` and `docs/ui-audit/` except documented unblocker fixes.

## 15. Transition to help-rewrite initiative

Explicit: out of scope for this run. After full-run acceptance:

- New spec/plan pair for help-rewrite, driven by `help_rewrite_hints` blocks from all 24 YAMLs.
- Likely Opus-heavy, prose-writing, potentially localisation-sensitive.
- Not started in the same session or branch as full-run.

## 16. Decisions (resolved 2026-04-21)

| # | Topic | Decision |
|---|---|---|
| 16.1 | Review gates | **Mandatory user review between every batch** (A→B→C→D). Four gates total. |
| 16.2 | Execution model | **Single-session sequential, Opus end-to-end.** No subagent dispatch. |
| 16.3 | Branch strategy | **Continue on `feat/design-system`.** One PR at the end containing design-system + full audit. |
| 16.4 | Backlog emission | **Each bug → dedicated `docs/backlog.json` entry** mirroring pilot pattern. |
| 16.5 | `help_rewrite_hints` scope | **Only sections with a matching help topic** in `apps/web/src/app/help/[topic]/help-content.tsx`. Sections without a topic skip the block. Observations about missing topics go into batch retros. |

Implications baked into the plan:

- Four explicit user-review stops: after batch A (5 P0-core sections), B (3 P0-ops), C (9 P1), D (6 P2).
- Each batch is a separate session; new sessions start by re-reading this spec + pilot-retro + previous batch retros.
- PR opened only after batch D retro is committed and accepted.
- `help_rewrite_hints` mapping is locked: sections 01 (topic: n/a — skip), 02 (bookings), 04 (bookings), 05 (bookings), 06 (check-in-out), 07 (rooms), 08 (rooms), 09 (housekeeping), 10 (folio), 11 (profiles), 12 (night-audit), 13 (n/a — skip), 14 (n/a — skip), 15 (config), 16 (config), 17 (rate-plans), 18 (config), 19 (config), 20 (config), 21 (profiles), 22 (self: help section), 23 (n/a — skip), 24 (n/a — skip). The exact topic ids will be verified from `help-content.tsx` at the start of the plan and any drift recorded as a batch-retro note.

---

## Appendix A — Sections already in scope vs. remaining

Already done (pilot): **03 booking-create** → ok.

Remaining (23): 01, 02, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24.

## Appendix B — Notable per-section pre-reads

Sections that likely need extra helper work (flagged during pilot planning):

- **14 tape-chart** — drag-drop of bookings across room/date cells; native drag API vs Playwright `dragTo` needs verification.
- **12 night-audit** — server-side state mutation (closes business date); needs pre/post snapshot and `ensureActiveBusinessDate` cleanup after the scenario.
- **10 folio** — posts charges via `/api/folio/charges`; fixture needs at least one checked-in booking.
- **22 help** — no form interaction, but content coverage check against `help-content.tsx` keys; different scenario shape.
- **24 i18n-theme** — cross-cutting; exercises locale cookie switch and theme toggle; scenarios are mostly visual-diff.

These are not blockers — plan will handle inline.
