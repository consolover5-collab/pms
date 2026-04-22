# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**pms-auto** — a lightweight, open-source reimplementation of core Oracle Opera PMS V5 Front Desk functionality (reservations, check-in/out, room management, folios, night audit). UI is primarily Russian (ru-RU) with an English locale.

A far more detailed rule set for AI agents lives in **`docs/project-context.md`** — read it before making non-trivial changes. The highlights are distilled below.

## Monorepo Layout

pnpm workspace + Turborepo. Workspaces declared in `pnpm-workspace.yaml`:

- `apps/api` — Fastify 5 API (TypeScript, ESM, `tsx watch`), port **3001**
- `apps/web` — Next.js 16 App Router + React 19 + Tailwind 4, port **3000**
- `packages/db` — Drizzle ORM schema, migrations (`drizzle/`), connection factory, seed
- `packages/domain` — **framework-free** business logic (booking/HK state machines, folio math). Must not import fastify/drizzle/next.
- `packages/shared` — shared TypeScript types only (no runtime utilities)
- `tools/ui-audit` — Playwright-based UI audit harness (ru + en projects)
- `tools/mcp-server` — Python MCP server for querying the reference Oracle Opera DB

Internal packages reference each other as `"@pms/<name>": "workspace:*"`.

## Common Commands

Run from the repo root unless noted.

```bash
# Install
pnpm install

# Dev (runs web + api in parallel via Turbo)
pnpm dev
# Cold start: web may show fetch errors until api is up — normal.

# Quality gates (all pass before commit)
pnpm typecheck
pnpm lint
pnpm build

# Database (delegates to @pms/db via turbo)
pnpm db:generate    # drizzle-kit generate — after schema edits
pnpm db:migrate     # drizzle-kit migrate
pnpm db:seed        # FULL RESET + reseed (GBH property, 54 rooms, 10 guests, 10 bookings)

# i18n sanity check (API error codes ↔ web locale files)
pnpm check:i18n

# Reset Turbo cache if builds misbehave
pnpm turbo clean
```

### Per-package scripts

```bash
# API
pnpm --filter @pms/api dev
pnpm --filter @pms/api test                 # node:test on src/lib/validation.test.ts
pnpm --filter @pms/api test:integration     # src/routes/integration.test.ts
pnpm --filter @pms/api typecheck

# Web
pnpm --filter @pms/web dev
pnpm --filter @pms/web lint                 # eslint (eslint-config-next)
pnpm --filter @pms/web build

# DB
pnpm --filter @pms/db db:generate
pnpm --filter @pms/db db:migrate
pnpm --filter @pms/db db:seed
pnpm --filter @pms/db db:studio             # Drizzle Studio

# Domain (pure logic — has real unit tests)
pnpm --filter @pms/domain test

# UI audit (Playwright)
pnpm --filter @pms/ui-audit install-browsers
pnpm --filter @pms/ui-audit test            # both locales
pnpm --filter @pms/ui-audit test:ru
pnpm --filter @pms/ui-audit test:en
```

### Running a single test

Tests use **Node.js built-in `node:test` via `tsx`** — no Vitest/Jest. There is no global `test` turbo task; invoke Node directly:

```bash
# From apps/api
npx tsx --test src/lib/validation.test.ts
npx tsx --test src/routes/integration.test.ts

# From packages/domain
npx tsx --test src/booking/state-machine.test.ts
npx tsx --test src/folio.test.ts
```

New test files need to be added to the corresponding package's `test` script — there is no glob runner.

### Environment

Copy `.env.example` → `.env` at the repo root. Expected files:

- `.env` (repo root, loaded by `apps/api/src/server.ts`) — `DATABASE_URL`, `API_PORT`, `API_HOST`
- `apps/web/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:3001`
- `packages/db/.env` — `DATABASE_URL` (for drizzle-kit CLI)

`.mcp.json` (root) holds Opera DB credentials for the MCP server and is git-ignored.

## High-Level Architecture

### API (Fastify 5)

Entrypoint: `apps/api/src/server.ts` → `buildApp()` in `apps/api/src/app.ts`, which registers (in order) cors, cookie, `dbPlugin`, `authPlugin`, then one route module per resource under `apps/api/src/routes/` (bookings, profiles, rooms, folio, night-audit, housekeeping, cashier, tape-chart, dashboard, …).

- Each route file exports a `FastifyPluginAsync` and is registered via `app.register()` in `app.ts`.
- `apps/api/src/db.ts` decorates the Fastify instance with `app.db` (a Drizzle instance). Use `app.db.transaction(async (tx) => …)` and pass `tx` through — do not reach back to `app.db` inside a transaction.
- `apps/api/src/plugins/auth.ts` provides session-cookie auth (`pms_session`) + role gates (`admin` / `front_desk` / `housekeeping`). Public routes are `GET /health` and `POST /api/auth/login` only. If you see auth behaving "oddly", check this plugin before assuming a bug.
- Shared validation lives in `apps/api/src/lib/validation.ts` (UUID, date ranges, room conflicts, HK transitions). Reuse it — don't hand-roll.
- Pagination contract: `{ data: [...], total: N }` with `?limit=<=100&offset=`.
- Confirmation numbers are generated inside `routes/bookings.ts`; do not generate them elsewhere.

### Web (Next.js 16 App Router)

`apps/web/src/app/` routes: `bookings`, `cashier`, `configuration`, `guests`, `help`, `housekeeping`, `login`, `night-audit`, `rooms`, `tape-chart`, plus root `page.tsx` / `layout.tsx`.

- Server Components by default; add `"use client"` only for hooks/browser APIs.
- Server-side data fetching: `apiFetch(path, opts?)` in `apps/web/src/lib/api.ts` — it injects `NEXT_PUBLIC_API_URL` and forwards cookies from `next/headers`. Client-side: use plain `fetch()`.
- `@/` alias → `apps/web/src/` works **only in `@pms/web`**. Other packages use relative imports.
- Currency formatting: `formatCurrency()` from `apps/web/src/lib/format.ts` (ru-RU, 2 decimals). Never format money outside the web app.
- Role-aware UI via `useUser()` in `@/lib/use-user.ts`.
- i18n locales: `apps/web/src/lib/i18n/locales/` — kept in sync with API error codes by `scripts/check-i18n.mjs`.

### Database (Drizzle + PostgreSQL)

- Schema: `packages/db/src/schema/{properties,rooms,profiles,bookings,booking-daily-details,financial,housekeeping,packages,users}.ts`, re-exported from `packages/db/src/schema/index.ts`.
- Connection factory: `createDb(url)` in `packages/db/src/connection.ts` (`drizzle-orm/postgres-js`). `decimal`/`numeric` columns come back as **strings** — keep them as strings end-to-end.
- Migrations under `packages/db/drizzle/` are generated, never hand-written. Change schema → `pnpm db:generate` → `pnpm db:migrate`.
- All FKs use `onDelete: "restrict"` — before deleting, `SELECT COUNT(*)` on every dependent table (including soft-deleted rows) and return `400` with a user-facing reason if anything references it.
- UUID PKs generated by the DB (`gen_random_uuid()` default). Never pass `id` on INSERT.
- Status/code columns are `varchar` with a `// Valid values: …` comment (intentional — avoids `ALTER TYPE` churn). Validation happens in API route handlers, not at the DB level.

### Domain package

`packages/domain/src/` holds:

- `booking/state-machine.ts` — valid `BookingStatus` transitions and the parallel housekeeping transitions (`VALID_HK_TRANSITIONS`).
- `folio.ts` — folio calculations.

This package must stay framework-free so the unit tests above can run in isolation. New business logic belongs here **with** a test — the isolation is meaningless otherwise.

## Non-Obvious Conventions

These bite if you don't know them (full list in `docs/project-context.md`):

- **`moduleResolution: bundler`** across the repo — do **not** append `.js` to relative imports.
- **Tailwind 4** is CSS-only (`@import "tailwindcss"` in `globals.css`). Do not create `tailwind.config.js`.
- **ESM**: `__dirname` is unavailable — derive it with `fileURLToPath(import.meta.url)`.
- **Native modules** (`bcrypt`, `esbuild`, `sharp`, `unrs-resolver`) are listed in `pnpm.onlyBuiltDependencies` in the root `package.json`. Add new native deps there or pnpm won't compile them.
- **Business date**: never `new Date()` as a business day — read from the `business_dates` table.
- **Money**: Drizzle returns strings; the web renders via `formatCurrency()`. Don't coerce to `number`.
- **Property scoping**: every DB query filters by `propertyId`. Forgetting this WHERE is a data-leak bug.
- **Room status is 2D**: `housekeepingStatus` (clean/dirty/pickup/inspected/out_of_order/out_of_service) and `occupancyStatus` (vacant/occupied) are independent fields. Change them separately, via `validateRoomStatusUpdate()`.
- **Folio**: append-only. No UPDATE/DELETE of folio transactions.
- **Check-in**: wrap in a transaction with `SELECT … FOR UPDATE` to prevent double-assignment races.
- **Night audit**: idempotent — skip `(bookingId, businessDate)` pairs already posted.
- **Soft delete**: records are never hard-deleted. Check `deletedAt` / status filters.
- **Fastify replies**: always `return reply.status(x).send(...)` on early exits; Fastify 5 does not serialize `undefined`.
- **Next.js navigation**: after a save/submit use `router.replace()`, not `router.push()` — avoids back-button loops.
- **Guest search**: 300 ms debounce via `setTimeout/clearTimeout`, not a library.
- **No `const enum`** and no namespace re-exports — breaks under `isolatedModules`.
- **Domain typing**: export explicit return types from functions in `packages/domain/` (consumers in `@pms/api` rely on them).

## Opera-First Workflow

Before implementing any new business rule, cross-check Opera first (see `docs/SYSTEM_PROMPT.md` and `docs/opera-first-methodology.md`):

1. Query the reference Opera DB through the MCP tools (`mcp__opera__query`, `mcp__opera__describe_table`, `mcp__opera__distinct_values`, etc.) to see the real shape and status codes.
2. Compare to our Drizzle schema in `packages/db/src/schema/`; note gaps and out-of-scope items.
3. Replicate **outcomes and integrity rules**, not table structure — our schema is clean-room and must stay Oracle-identifier-free.
4. Out-of-scope for MVP (do not build): packages/elements, routing/split folios, fixed charges, memberships, complex tax, TA commissions, groups/allotments, HK task assignment, channel managers, multi-property.

Status code mapping (Opera → ours) is defined in `docs/SYSTEM_PROMPT.md`; stick to it when translating Opera behavior.

## Git / Commits

- Develop on the branch dictated by your task brief; default upstream branch is `main`.
- Conventional Commits: `feat:` `fix:` `refactor:` `docs:` `test:` etc.
- Pre-commit expectation: `pnpm typecheck && pnpm lint && pnpm build` plus the relevant `node:test` suites all green.

## Further Reading

- `docs/project-context.md` — full rule set for AI agents (authoritative; supersedes this file on conflict).
- `docs/SYSTEM_PROMPT.md` — Opera-first methodology, MVP scope, Opera↔ours status mapping.
- `docs/INSTALLATION.md` — local setup (draft).
- `docs/help/` — user-facing feature docs (ru).
- `docs/plans/` — phase design documents.
- `docs/ui-audit-plan.md` + `docs/ui-audit/` — UI audit plan and per-section YAML reports.
