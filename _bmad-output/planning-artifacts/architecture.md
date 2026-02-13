---
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter
  - step-04-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-pms-2026-02-12.md
  - docs/opera-research-notes.md
  - docs/plans/2026-02-09-pms-mvp-design.md
  - docs/plans/2026-02-13-phase-4-financial-core.md
workflowType: architecture
project_name: pms
user_name: Oci
date: 2026-02-12
lastEdited: '2026-02-13'
editHistory:
  - date: '2026-02-13'
    changes: 'Add Financial Core (business_dates, transaction_codes, folio_transactions) — tables, APIs, domain logic, NFRs. Move billing from deferred to core. Add FR43-FR60 coverage.'
---

# Architecture Decision Document

_This document defines architectural decisions for PMS — an open-source Property Management System. It covers the brownfield project entering Phase 3 (Bookings) through Phase 7 (Auth), building on existing Phases 0-2._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
60 FRs organized into 11 capability areas: Booking Management (FR1-7), Availability & Rates (FR8-12), Check-in (FR13-17), Check-out (FR18-22), Housekeeping (FR23-26), Dashboard (FR27-31), Guest Management (FR32-34, existing), Auth (FR35-39), Tape Chart (FR40-42), Business Date (FR43-45), Transaction Codes (FR46-48), Folio Management (FR49-54), Night Audit (FR55-60).

Architecturally, the FRs reveal:
- **Booking is the central entity** — 21 of 60 FRs directly involve bookings
- **State machine is the core logic** — booking status + housekeeping status transitions drive all operations
- **Search is a cross-cutting concern** — search by guest name, confirmation number, room number across multiple contexts
- **Dashboard is a read-heavy aggregation** — arrivals, departures, in-house, occupancy summary
- **Folio is the financial backbone** — append-only debit/credit ledger tied to business date, drives check-out and night audit
- **Night Audit is the daily batch operation** — atomic transaction closing the business day

**Non-Functional Requirements:**
- Performance: API < 200ms p95, search < 1s for 60K+ records, availability < 500ms, Night Audit < 60s for 200 rooms
- Security: bcrypt auth, session cookies, RBAC at API level, explicit field whitelists on mutations
- Reliability: DB constraints prevent double-booking, transactions for multi-table writes, Night Audit atomicity (single DB transaction), folio append-only (no UPDATE/DELETE), idempotent Night Audit, partial unique index for 1 open business date
- Integration: MCP server for Opera migration, REST API for future integrations

**Scale & Complexity:**
- Complexity level: Medium
- Primary domain: Full-stack web (monorepo)
- Single-property MVP, ~200 rooms, ~60K guests, ~100K bookings expected
- Single server deployment (Docker Compose)

### Technical Constraints & Dependencies

- **Existing codebase:** Phases 0-2 complete — schema, API routes, frontend pages for rooms and guests
- **Drizzle ORM:** Schema-first, push-based migrations, PostgreSQL only
- **Monorepo:** pnpm workspaces + Turborepo — packages must be independent
- **Domain package:** `packages/domain/` exists with state machine — must remain pure (no framework deps)
- **No ORM in domain:** Business logic must not import Drizzle — only plain types

### Cross-Cutting Concerns

1. **Booking status state machine** — affects API, domain, frontend (status transition buttons)
2. **Room status updates** — check-in/check-out must atomically update both booking and room
3. **Availability calculation** — must consider bookings + room type + date range + excluded statuses
4. **Confirmation number generation** — must be unique per property, used across search/check-in/check-out
5. **Authentication** — all API routes (except health) must require auth, RBAC for role-based access
6. **Business date** — all financial operations and dashboard queries reference business date, not system clock
7. **Folio append-only invariant** — no UPDATE/DELETE on folio_transactions; corrections only via counter-entries

---

## Starter Template Evaluation

### Existing Project Foundation (Brownfield)

This is a brownfield project — the starter is already established. No new project initialization needed.

**Existing Stack (Phases 0-2):**

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 22 LTS |
| Language | TypeScript | 5.x |
| Frontend | Next.js | 15 (App Router) |
| CSS | Tailwind CSS | 4.x |
| Backend | Fastify | 5.x |
| ORM | Drizzle ORM | latest |
| Database | PostgreSQL | 16 |
| Validation | Zod | 3.x |
| Monorepo | pnpm + Turborepo | latest |
| Package manager | pnpm | 9.x |

**Decisions Already Made by Existing Codebase:**

- Monorepo structure with `apps/` and `packages/`
- Fastify REST API with decorator-based DB injection
- Next.js Server Components for data fetching
- Client Components for forms and interactivity
- Drizzle schema-first approach with `pgTable`
- `apiFetch()` helper for server-to-API calls
- Direct `fetch()` for client-side mutations

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Phase 3 Implementation):**
1. Booking schema with `booking_nights` table
2. Availability check algorithm
3. Confirmation number generation strategy
4. Atomic check-in/check-out transactions

**Critical Decisions (Block Phase 5 — Financial Core):**
5. Business date schema with partial unique index (1 open date per property)
6. Debit/credit folio model (separate columns, not signed amount)
7. Append-only folio invariant (no UPDATE/DELETE)
8. Night Audit atomicity (single DB transaction for all steps)
9. Tax rate preservation per-transaction (appliedTaxRate)
10. Transaction code self-FK for adjustment codes

**Important Decisions (Shape Architecture):**
11. Authentication library choice
12. RBAC implementation approach
13. Tape chart data structure

**Deferred Decisions (Post-MVP):**
- Multi-window folio routing (windows 1-8)
- Rate management (seasonal, restrictions)
- Multi-property schema changes
- WebSocket for real-time updates
- Cashier open/close sessions

### Data Architecture

**Database:** PostgreSQL 16 via Drizzle ORM (already decided)

**New Tables for Phase 3:**

`rate_plans` — Already defined in `packages/db/src/schema/bookings.ts`:
- id, propertyId, code, name, description, isActive, timestamps

`bookings` — Already defined:
- id, propertyId, guestId, roomId (nullable FK → rooms), roomTypeId, ratePlanId
- confirmationNumber (unique), checkIn (date), checkOut (date)
- status (varchar: confirmed|checked_in|checked_out|cancelled|no_show)
- adults, children, specialRequests, totalAmount (cached), timestamps

`booking_nights` — **NEW, not yet created:**
- id (uuid PK), bookingId (FK → bookings), date (date), ratePlanId (FK → rate_plans), amount (numeric 10,2), timestamps
- Composite unique constraint: (bookingId, date) — one entry per night per booking

**New Tables for Phase 5 (Financial Core):**

`business_dates`:
- id (uuid PK), propertyId (FK → properties), date (date), status (open|closed), closedAt, closedBy, createdAt
- Unique constraint: (propertyId, date)
- **Partial unique index**: `UNIQUE (propertyId) WHERE status = 'open'` — guarantees exactly 1 open business date per property at DB level

`transaction_codes`:
- id (uuid PK), propertyId (FK → properties), code (varchar), description, groupCode (ROOM|PAYMENT|TAX|FB|MISC|ADJUSTMENT), transactionType (charge|payment), isManualPostAllowed, isActive, adjustmentCodeId (self-FK → transaction_codes, nullable), sortOrder, createdAt
- Unique constraint: (propertyId, code)
- Self-FK `adjustmentCodeId` links revenue codes to their adjustment counterpart (e.g., ROOM → ADJ_ROOM)

`folio_transactions`:
- id (uuid PK), propertyId, bookingId, businessDateId, transactionCodeId (all FK)
- folioWindow (1-8, default 1)
- **debit** (numeric 10,2, default 0), **credit** (numeric 10,2, default 0) — exactly one > 0 per row
- quantity, description, isSystemGenerated, appliedTaxRate (nullable, for TAX entries only)
- parentTransactionId (nullable — links tax → charge, adjustment → original)
- postedBy (NIGHT_AUDIT|user:xxx|SYSTEM), createdAt
- **Append-only**: no UPDATE or DELETE. Corrections via counter-entries (adjustment transactions)

**Property extension (Phase 5):**
- Add `taxRate` (numeric 5,2, default 0) to `properties` table — single VAT rate for MVP

**Availability Check Algorithm:**

```
available_count(propertyId, roomTypeId, checkIn, checkOut) =
  total_rooms(propertyId, roomTypeId, excluding OOO/OOS)
  - count(bookings WHERE roomTypeId = X
          AND status IN ('confirmed', 'checked_in')
          AND checkIn < :checkOut
          AND checkOut > :checkIn)
```

This is the standard date-range overlap query. Lives in `packages/domain/availability.ts` as a pure function that receives counts, and in API route as the actual DB query.

**Confirmation Number Strategy:**
- Format: `PMS-NNNNNN` (zero-padded sequential)
- Generated via PostgreSQL sequence: `CREATE SEQUENCE confirmation_seq`
- Drizzle raw SQL: `SELECT nextval('confirmation_seq')` at booking creation
- Unique per database (single property MVP — globally unique is fine)

**Migration Approach:**
- Drizzle `db:generate` + `db:migrate` for schema changes
- Self-FK for adjustmentCodeId via raw SQL migration (Drizzle doesn't support self-reference in `.references()`)
- Seed script extended for rate plans, sample bookings, business date, and 12 transaction codes

### Authentication & Security

**Auth Library:** Better Auth (already noted in MVP design as option)
- Decision: Use **session-based auth with Fastify plugin**
- Sessions stored in PostgreSQL (no Redis needed for MVP)
- Secure, HTTP-only cookies
- bcrypt password hashing (10+ rounds)

**RBAC Model:**
- 3 roles: `admin`, `front_desk`, `housekeeping`
- Stored in `users` table (new Phase 7): id, username, passwordHash, role, propertyId
- Enforced via Fastify preHandler hook that checks `request.user.role`
- Role → allowed route prefixes mapping

**API Security:**
- All routes except `GET /health` require authentication
- CORS whitelist: frontend origin only
- No API keys for MVP (internal network only)
- **Mutation endpoints use explicit field whitelists** — no `...request.body` spread (prevents mass assignment attacks)

### API & Communication Patterns

**API Style:** REST (already established)

**New Endpoints for Phase 3-7:**

```
# Bookings
POST   /api/bookings              — Create booking
GET    /api/bookings              — List (filters: status, dateFrom, dateTo, guestId)
GET    /api/bookings/:id          — Get booking detail
PUT    /api/bookings/:id          — Update booking (only status=confirmed, explicit field whitelist)
PATCH  /api/bookings/:id/status   — Transition status (check-in, check-out, cancel, no-show)

# Availability
GET    /api/availability          — Query (propertyId, roomTypeId?, from, to)

# Rate Plans
GET    /api/rate-plans            — List (propertyId)
POST   /api/rate-plans            — Create (admin only)
PUT    /api/rate-plans/:id        — Update (admin only)

# Dashboard
GET    /api/dashboard/arrivals    — Today's arrivals (by business date)
GET    /api/dashboard/departures  — Today's departures (by business date)
GET    /api/dashboard/in-house    — Current in-house
GET    /api/dashboard/summary     — Occupancy summary

# Business Date (Phase 5)
GET    /api/business-date         — Get current open business date (propertyId)
POST   /api/business-date/initialize — Create first business date (one-time setup)

# Folio (Phase 5)
GET    /api/bookings/:bookingId/folio       — Get folio (transactions, balance, summary)
POST   /api/bookings/:bookingId/folio/post  — Manual charge (transactionCodeId, amount)
POST   /api/bookings/:bookingId/folio/payment — Payment (transactionCodeId, amount)
POST   /api/bookings/:bookingId/folio/adjust  — Adjust/reverse transaction (transactionId, reason)

# Night Audit (Phase 5)
POST   /api/night-audit/preview   — Preview (propertyId in query) — what will happen
POST   /api/night-audit/run       — Run full Night Audit (propertyId in body)

# Tape Chart (Phase 6)
GET    /api/tape-chart            — Grid data (propertyId, from, to)

# Auth (Phase 7)
POST   /api/auth/login            — Login
POST   /api/auth/logout           — Logout
GET    /api/auth/me               — Current user
```

**Error Handling Standard:**
- Success: direct JSON response, appropriate status code
- Error: `{ error: "Human-readable message" }` with HTTP status
- 400 for validation errors, 404 for not found, 409 for conflicts (double-booking), 401/403 for auth

**Check-in/Check-out Transactions:**
Check-in and check-out modify multiple tables atomically:

```typescript
// Check-in: must be a transaction
await db.transaction(async (tx) => {
  // 1. Verify booking status = 'confirmed'
  // 2. Verify room is clean/inspected + vacant
  // 3. Update booking: status → 'checked_in', roomId → assigned room
  // 4. Update room: occupancyStatus → 'occupied'
});

// Check-out: must be a transaction
await db.transaction(async (tx) => {
  // 1. Verify booking status = 'checked_in'
  // 2. Verify folio balance <= 0 (zero or credit)
  // 3. Update booking: status → 'checked_out'
  // 4. Update room: housekeepingStatus → 'dirty', occupancyStatus → 'vacant'
});
```

**Night Audit Transaction Pattern:**
Night Audit executes ALL steps in a single DB transaction:

```typescript
// Night Audit: single atomic transaction
await db.transaction(async (tx) => {
  // 1. Idempotency guard — reject if ROOM charges already exist for this business date
  // 2. No-shows: confirmed + checkInDate < businessDate → no_show
  // 3. Room charges: for each checked_in → insert folio_transaction (debit)
  // 4. Tax charges: for each room charge → insert folio_transaction (debit, appliedTaxRate)
  // 5. HK update: occupied rooms → housekeepingStatus = 'dirty'
  // 6. Sync room statuses
  // 7. Close business date: status → 'closed', closedAt = now()
  // 8. Open next: insert new business_date (date+1, status='open')
  // If ANY step fails → entire transaction rolls back
});
```

### Frontend Architecture

**Rendering Strategy (already established):**
- Server Components: data-fetching pages (booking list, detail, dashboard)
- Client Components: interactive forms (booking form, status buttons, search)

**New Pages for Phase 3-7:**

```
/bookings                — Booking list with filters (Server Component)
/bookings/new            — Create booking form (Client Component)
/bookings/:id            — Booking detail + status actions + folio tab (Server + Client)
/dashboard               — Front desk dashboard (Server Component)
/night-audit             — Night Audit preview + run (Client Component)
/tape-chart              — Visual room grid (Client Component — heavy interactivity)
/login                   — Login page (Client Component)
```

**State Management:** None (URL params + Server Components). Forms use local React state.

**Component Patterns:**
- Pages in `apps/web/src/app/` following Next.js App Router conventions
- Shared UI components (if needed) in `apps/web/src/components/`
- API client: `apiFetch()` for Server Components, direct `fetch()` for Client Components

### Infrastructure & Deployment

**Development:** Docker Compose (PostgreSQL) + `pnpm dev` (Turborepo parallel)
**Production MVP:** Single server — Docker Compose with API + Web + PostgreSQL containers
**CI:** TypeScript typecheck + lint (already configured via Turborepo)

No cloud deployment, no Kubernetes, no CDN for MVP. Self-hosted on hotel premises or VPS.

---

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database Naming (established by Phases 0-2):**
- Tables: `snake_case` plural (`bookings`, `rate_plans`, `booking_nights`, `business_dates`, `transaction_codes`, `folio_transactions`)
- Columns: `snake_case` (`check_in`, `property_id`, `confirmation_number`, `applied_tax_rate`)
- Foreign keys: `{referenced_table_singular}_id` (`guest_id`, `room_type_id`, `business_date_id`, `transaction_code_id`)
- Drizzle field names: `camelCase` (`checkIn`, `propertyId`, `confirmationNumber`, `appliedTaxRate`)

**API Naming (established):**
- Endpoints: `/api/{resource}` plural, kebab-case (`/api/rate-plans`, `/api/bookings`, `/api/business-date`, `/api/night-audit`)
- Route params: `:id` format (`/api/bookings/:id`)
- Nested resources: `/api/bookings/:bookingId/folio`
- Query params: `camelCase` (`propertyId`, `dateFrom`, `dateTo`)
- JSON response fields: `camelCase` (Drizzle returns camelCase by default)

**Code Naming (established):**
- Files: `kebab-case.ts` for routes, `camelCase.ts` for schema (`guests.ts`, `state-machine.ts`, `financial.ts`)
- Functions: `camelCase` (`canTransitionBooking`, `assertHousekeepingTransition`, `calculateFolioBalance`, `calculateTax`)
- Types/Interfaces: `PascalCase` (`BookingStatus`, `HousekeepingStatus`, `FolioTransaction`, `NightAuditPreCheck`)
- Constants: `UPPER_SNAKE_CASE` (`BOOKING_STATUSES`, `VALID_BOOKING_TRANSITIONS`)
- React components: `PascalCase` files and exports (`SearchForm`, `GuestForm`, `FolioTab`)

### Structure Patterns

**Route files:** One file per resource in `apps/api/src/routes/` — export `FastifyPluginAsync`, register in `app.ts`

**Schema files:** One file per domain entity group in `packages/db/src/schema/` — re-exported from `index.ts`

**Domain logic:** Pure functions in `packages/domain/src/` — no Drizzle, no Fastify imports. Only `@pms/shared` types allowed.

**Frontend pages:** Next.js App Router structure — `apps/web/src/app/{route}/page.tsx`

### Format Patterns

**API Response Format:**
- Success: Direct JSON (no wrapper). Array for lists, object for single entities.
- Error: `{ error: "message" }` with appropriate HTTP status code.
- No pagination envelope for MVP — flat arrays with `limit` query param.

**Date/Time in API:**
- Dates: ISO date strings `"2026-02-12"` (no time component for check-in/check-out dates)
- Timestamps: ISO datetime strings `"2026-02-12T14:30:00.000Z"`
- All dates in API are UTC. Frontend formats to local timezone for display.

**Money/Numeric in API:**
- Monetary values: strings from Drizzle `decimal` columns (e.g., `"4500.00"`)
- Domain functions accept `number` (parsed at API boundary)
- Tax rate: number as percentage (e.g., `20.00` means 20%)

**Null Handling:**
- Nullable fields returned as `null` in JSON, never omitted
- Optional request body fields: omit or set to `null`

### Process Patterns

**Error Handling in API Routes:**
```typescript
// Pattern: early return on error
const [booking] = await app.db.select()...
if (!booking) return reply.status(404).send({ error: "Booking not found" });
```

**Status Transitions:**
```typescript
// Pattern: always use domain function, never check inline
import { assertBookingTransition } from "@pms/domain";

try {
  assertBookingTransition(booking.status, newStatus);
} catch (err) {
  return reply.status(400).send({ error: err.message });
}
```

**Database Transactions:**
```typescript
// Pattern: use tx parameter, not app.db inside transaction
await app.db.transaction(async (tx) => {
  await tx.update(bookings)...
  await tx.update(rooms)...
});
```

**Folio Operations (append-only):**
```typescript
// Pattern: only INSERT, never UPDATE/DELETE on folio_transactions
// Charge:
await tx.insert(folioTransactions).values({
  bookingId, businessDateId, transactionCodeId,
  debit: amount, credit: "0",
  isSystemGenerated: false, postedBy: `user:${userId}`,
});

// Payment:
await tx.insert(folioTransactions).values({
  bookingId, businessDateId, transactionCodeId,
  debit: "0", credit: amount,
  ...
});

// Adjustment (reversal): mirror debit/credit from original
await tx.insert(folioTransactions).values({
  bookingId, businessDateId,
  transactionCodeId: originalCode.adjustmentCodeId,
  debit: original.credit, credit: original.debit,
  parentTransactionId: original.id,
  ...
});
```

### Enforcement Guidelines

**All implementations MUST:**
1. Use domain functions for status transitions — never check status inline
2. Use transactions for operations touching multiple tables
3. Return `{ error: "message" }` for all error responses
4. Validate inputs at API boundary (Fastify route level), not in domain
5. Keep `packages/domain/` free of framework dependencies
6. Use existing `apiFetch()` pattern for server-side API calls in frontend
7. Use explicit field whitelists for mutation endpoints — never spread request body
8. Never UPDATE or DELETE folio_transactions — append-only with counter-entries
9. Reference business date (not system clock) for all financial operations and dashboard queries

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
pms/
├── apps/
│   ├── api/                          — Fastify REST API
│   │   ├── src/
│   │   │   ├── app.ts                — App builder, plugin/route registration
│   │   │   ├── server.ts             — Server entry point
│   │   │   ├── db.ts                 — Database decorator plugin
│   │   │   └── routes/
│   │   │       ├── health.ts         — GET /health
│   │   │       ├── properties.ts     — /api/properties (existing)
│   │   │       ├── room-types.ts     — /api/room-types (existing)
│   │   │       ├── rooms.ts          — /api/rooms (existing)
│   │   │       ├── guests.ts         — /api/guests (existing)
│   │   │       ├── bookings.ts       — /api/bookings (Phase 3) ← existing
│   │   │       ├── rate-plans.ts     — /api/rate-plans (Phase 3) ← existing
│   │   │       ├── availability.ts   — /api/availability (Phase 3) ← existing
│   │   │       ├── dashboard.ts      — /api/dashboard/* (Phase 4) ← NEW
│   │   │       ├── business-date.ts  — /api/business-date (Phase 5) ← NEW
│   │   │       ├── folio.ts          — /api/bookings/:bookingId/folio (Phase 5) ← NEW
│   │   │       ├── night-audit.ts    — /api/night-audit (Phase 5) ← REWRITE
│   │   │       ├── tape-chart.ts     — /api/tape-chart (Phase 6) ← NEW
│   │   │       └── auth.ts           — /api/auth/* (Phase 7) ← NEW
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          — Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx           — Landing page
│       │   │   ├── rooms/page.tsx     — Rooms list (existing)
│       │   │   ├── guests/            — Guest pages (existing)
│       │   │   │   ├── page.tsx
│       │   │   │   ├── search-form.tsx
│       │   │   │   ├── [id]/page.tsx
│       │   │   │   └── new/
│       │   │   ├── bookings/          — Phase 3 ← existing
│       │   │   │   ├── page.tsx       — Booking list
│       │   │   │   ├── [id]/page.tsx  — Booking detail + folio tab
│       │   │   │   └── new/
│       │   │   │       ├── page.tsx
│       │   │   │       └── booking-form.tsx
│       │   │   ├── dashboard/         — Phase 4 ← NEW
│       │   │   │   └── page.tsx
│       │   │   ├── night-audit/       — Phase 5 ← NEW
│       │   │   │   └── page.tsx       — Preview + Run
│       │   │   ├── tape-chart/        — Phase 6 ← NEW
│       │   │   │   └── page.tsx
│       │   │   └── login/             — Phase 7 ← NEW
│       │   │       └── page.tsx
│       │   └── lib/
│       │       └── api.ts             — API client helper (existing)
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── db/                            — Drizzle ORM + PostgreSQL
│   │   ├── src/
│   │   │   ├── connection.ts          — createDb() factory
│   │   │   ├── index.ts              — Re-exports
│   │   │   ├── schema/
│   │   │   │   ├── index.ts           — Re-exports all tables
│   │   │   │   ├── properties.ts      — properties table (existing) + taxRate (Phase 5)
│   │   │   │   ├── rooms.ts           — roomTypes + rooms tables (existing)
│   │   │   │   ├── guests.ts          — guests table (existing)
│   │   │   │   ├── bookings.ts        — ratePlans + bookings (existing) + bookingNights ← EXTEND
│   │   │   │   └── financial.ts       — businessDates + transactionCodes + folioTransactions ← NEW (Phase 5)
│   │   │   └── seed.ts               — Seed script
│   │   ├── drizzle/                   — Generated migrations
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── domain/                        — Pure business logic
│   │   ├── src/
│   │   │   ├── index.ts              — Re-exports
│   │   │   ├── booking/
│   │   │   │   ├── state-machine.ts   — Status transitions (existing)
│   │   │   │   └── availability.ts    — Availability check logic ← NEW
│   │   │   ├── folio.ts               — Balance calculation, canCheckOut, calculateTax ← NEW (Phase 5)
│   │   │   └── night-audit.ts         — NightAuditPreCheck, evaluateNightAudit ← NEW (Phase 5)
│   │   └── package.json
│   │
│   └── shared/                        — Shared types + Zod schemas
│       ├── src/
│       │   ├── index.ts
│       │   └── types/
│       │       ├── index.ts
│       │       └── booking.ts         — BookingStatus, HousekeepingStatus, OccupancyStatus (existing)
│       └── package.json
│
├── tools/
│   └── mcp-server/                    — Python MCP server for Oracle Opera
│
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

### Architectural Boundaries

**API Boundaries:**
- All data access goes through REST API — frontend never touches DB directly
- `apps/api/` depends on `@pms/db` (schema + connection) and `@pms/domain` (business logic) and `@pms/shared` (types)
- Each route file is a self-contained Fastify plugin

**Domain Boundaries:**
- `packages/domain/` depends ONLY on `@pms/shared` (types)
- No Drizzle, no Fastify, no Node.js APIs — pure TypeScript functions
- Testable with plain unit tests (no mocks needed)
- Financial domain functions: `calculateFolioBalance()`, `canCheckOut()`, `calculateTax()`, `evaluateNightAudit()`

**Data Boundaries:**
- `packages/db/` owns all table definitions and migrations
- Schema changes always via Drizzle generate + migrate
- Self-FK (adjustmentCodeId) via raw SQL in migration
- Seed script is the single source for demo data (including business date + 12 transaction codes)

**Frontend Boundaries:**
- `apps/web/` depends on nothing — communicates only via HTTP to API
- Server Components call `apiFetch()` (server-side fetch)
- Client Components call `fetch()` directly to API URL

### Requirements to Structure Mapping

| Capability Area | API Route | Frontend Page | Domain Logic | DB Schema |
|----------------|-----------|---------------|--------------|-----------|
| Booking CRUD | `routes/bookings.ts` | `bookings/` | `booking/state-machine.ts` | `schema/bookings.ts` |
| Availability | `routes/availability.ts` | (used in booking form) | `booking/availability.ts` | `schema/bookings.ts` + `rooms.ts` |
| Rate Plans | `routes/rate-plans.ts` | (used in booking form) | — | `schema/bookings.ts` |
| Check-in/out | `routes/bookings.ts` (PATCH status) | `bookings/[id]/page.tsx` | `booking/state-machine.ts` | `bookings` + `rooms` |
| Housekeeping | `routes/rooms.ts` (PATCH status) | `rooms/page.tsx` | `booking/state-machine.ts` | `schema/rooms.ts` |
| Dashboard | `routes/dashboard.ts` | `dashboard/page.tsx` | — | `bookings` + `rooms` |
| Auth | `routes/auth.ts` | `login/page.tsx` | — | `users` (new) |
| Tape Chart | `routes/tape-chart.ts` | `tape-chart/page.tsx` | — | `bookings` + `rooms` |
| Business Date | `routes/business-date.ts` | (header component) | — | `schema/financial.ts` |
| Folio | `routes/folio.ts` | `bookings/[id]/page.tsx` (folio tab) | `folio.ts` | `schema/financial.ts` |
| Night Audit | `routes/night-audit.ts` | `night-audit/page.tsx` | `night-audit.ts` | `schema/financial.ts` + `bookings.ts` |
| Transaction Codes | `routes/folio.ts` (or dedicated) | (used in charge form) | — | `schema/financial.ts` |

### Data Flow

```
Browser → Next.js Server Component → apiFetch() → Fastify API → Drizzle → PostgreSQL
Browser → Next.js Client Component → fetch() ──────→ Fastify API → Drizzle → PostgreSQL

Fastify API route:
  1. Parse request (params, query, body)
  2. Validate input (inline or Zod)
  3. Call domain logic if needed (state machine, availability, folio balance)
  4. Execute DB query via app.db (Drizzle)
  5. Return JSON response

Night Audit (special):
  1. Parse propertyId
  2. Get current business date
  3. Idempotency guard (check existing ROOM charges for this date)
  4. Open single DB transaction
  5. Execute all steps (no-show, charges, tax, HK, sync, close date, open next)
  6. Commit or rollback
  7. Return summary
```

---

## Architecture Validation

### PRD Coverage Check

| FR Range | Coverage | Notes |
|----------|----------|-------|
| FR1-7 (Booking CRUD) | Covered | `routes/bookings.ts` + `booking/state-machine.ts` |
| FR8-12 (Availability) | Covered | `routes/availability.ts` + `booking/availability.ts` + `booking_nights` |
| FR13-17 (Check-in) | Covered | `routes/bookings.ts` PATCH + transaction pattern |
| FR18-22 (Check-out) | Covered | `routes/bookings.ts` PATCH + folio balance check + transaction pattern |
| FR23-26 (Housekeeping) | Covered | `routes/rooms.ts` existing PATCH + state machine |
| FR27-31 (Dashboard) | Covered | `routes/dashboard.ts` with aggregation queries + business date |
| FR32-34 (Guests) | Already exists | Phase 2 complete |
| FR35-39 (Auth) | Covered | `routes/auth.ts` + session + RBAC preHandler |
| FR40-42 (Tape Chart) | Covered | `routes/tape-chart.ts` + grid component |
| FR43-45 (Business Date) | Covered | `routes/business-date.ts` + `schema/financial.ts` (partial unique index) |
| FR46-48 (Transaction Codes) | Covered | `schema/financial.ts` + seed (12 codes) + adjustmentCodeId self-FK |
| FR49-54 (Folio) | Covered | `routes/folio.ts` + `domain/folio.ts` (balance, canCheckOut, calculateTax) |
| FR55-60 (Night Audit) | Covered | `routes/night-audit.ts` + `domain/night-audit.ts` + atomic transaction |

### NFR Validation

| NFR | Architectural Support |
|-----|----------------------|
| API < 200ms p95 | Single DB, no microservices, indexed queries |
| Search < 1s / 60K | ILIKE with indexes, pagination via limit |
| Availability < 500ms | Date-range overlap query with proper indexes on (roomTypeId, checkIn, checkOut, status) |
| Night Audit < 60s / 200 rooms | Single transaction, bulk inserts, no external calls |
| bcrypt auth | Better Auth / custom with bcrypt |
| Session cookies | Fastify cookie plugin, PostgreSQL session store |
| RBAC | preHandler hook checking request.user.role |
| No body spread | Explicit field whitelists on PUT/POST mutation endpoints |
| DB prevents double-booking | Availability check before insert + database constraints |
| Transactions | Drizzle `db.transaction()` for check-in/check-out/night-audit |
| Night Audit atomicity | All steps in single `db.transaction()` — all succeed or all rollback |
| Night Audit idempotency | Guard checks existing ROOM charges for current business date |
| Folio append-only | No UPDATE/DELETE on folio_transactions; reversals via counter-entries |
| appliedTaxRate preservation | Tax rate stored per-transaction, not looked up from property at query time |
| 1 open business date | Partial unique index: `UNIQUE (propertyId) WHERE status = 'open'` |

### Consistency Validation

- All naming follows established Phase 0-2 conventions
- All new routes follow existing plugin pattern
- All new schema follows existing `pgTable` + `camelCase` field pattern
- Domain logic remains framework-free
- Financial schema in dedicated `financial.ts` file (keeps `bookings.ts` focused)
- No new dependencies needed for Phase 3-5 (Drizzle, Fastify, Next.js already in place)
