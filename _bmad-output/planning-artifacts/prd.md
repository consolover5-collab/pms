---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
  - step-e-01-discovery
  - step-e-02-review
  - step-e-03-edit
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-pms-2026-02-12.md
  - docs/opera-research-notes.md
  - docs/plans/2026-02-09-pms-mvp-design.md
  - docs/plans/2026-02-11-phase-1-rooms-refactor.md
  - docs/plans/2026-02-12-phase-2-guests.md
  - docs/plans/2026-02-13-phase-4-financial-core.md
  - docs/opera-help-analysis.md
workflowType: prd
classification:
  projectType: web_fullstack
  domain: hospitality
  complexity: medium
  projectContext: brownfield
documentCounts:
  briefCount: 1
  researchCount: 2
  brainstormingCount: 0
  projectDocsCount: 6
lastEdited: '2026-02-13'
editHistory:
  - date: '2026-02-13'
    changes: 'Add Financial Core (Business Date, Folio, Transaction Codes, Night Audit v2) to MVP scope. +2 journeys, +18 FRs, +4 NFRs, +1 phase.'
---

# Product Requirements Document - PMS

**Author:** Oci
**Date:** 2026-02-12
**Last Edited:** 2026-02-13

## Executive Summary

PMS is an open-source Property Management System that replaces Oracle Opera PMS V5 for independent hotels. It covers three essential operational modules — **Reservations**, **Front Desk**, and **Cashiering** (folio, charges, payments, night audit) — for a single hotel property.

**Product type:** Full-stack web application (Next.js 15 frontend + Fastify 5 API + PostgreSQL)
**Domain:** Hospitality / Hotel Operations
**Project context:** Brownfield — Phases 0-3 complete (monorepo, rooms, guests, bookings). Entering Phase 4 (Front Desk Operations).

**Core differentiator:** Open-source, self-hosted PMS with clean-room architecture informed by real Opera data (167 rooms, 135K bookings, 61K guests) but built from hospitality industry standards (HTNG, OTA), not vendor code. Full data ownership.

**Current state:**
- Monorepo with Fastify API, Next.js frontend, Drizzle ORM, PostgreSQL
- Properties, room types, rooms with 2D status model (housekeeping + occupancy)
- Guests with search, detail, create (10 migrated Opera profiles)
- Bookings with CRUD, status transitions, rate plans, availability check
- MCP server for Oracle Opera read-only access

**What this PRD covers:** Phase 4 (Front Desk) through Phase 7 (Auth), completing the MVP. Phase 5 (Financial Core) is the critical addition — business date, folio transactions, and night audit.

---

## Success Criteria

### User Success

- **Booking creation:** Front desk agent creates a new booking (select guest, room type, dates, rate) in under 60 seconds
- **Check-in flow:** Complete check-in (find booking → assign room → status transition) in under 30 seconds
- **Check-out flow:** Review folio balance + check-out + room status update in under 30 seconds
- **Guest lookup:** Search returns results within 1 second across 60K+ guest records
- **Availability check:** Room availability query responds within 500ms for any date range up to 90 days
- **Zero double-bookings:** Availability engine prevents assigning a room to overlapping bookings
- **Night audit:** Complete Night Audit cycle (no-shows, room+tax charges, HK update, date roll) in under 60 seconds for 167 rooms
- **Folio visibility:** Front desk agent can view folio balance and transaction history for any checked-in guest in under 2 seconds
- **Payment posting:** Front desk agent can post a manual charge or payment to a folio in under 15 seconds

### Business Success

- **Operational replacement:** System handles 100% of daily front desk operations for a single property
- **Financial tracking:** Every occupied room night generates an auditable room charge + tax record
- **Data migration:** All rooms, guests, and active bookings migrated from Opera V5 to PostgreSQL
- **Zero Oracle dependency:** Hotel runs entirely on open-source stack
- **Developer adoption:** External contributors can add features without training beyond reading code

### Technical Success

- **API response time:** All CRUD operations complete within 200ms
- **Night Audit atomicity:** All Night Audit steps execute as single DB transaction — all succeed or all roll back
- **Type safety:** End-to-end TypeScript with Zod validation at API boundaries
- **Domain isolation:** Business logic in `packages/domain/` with zero framework dependencies
- **Test coverage:** State machines, availability logic, and folio balance calculation covered by unit tests

### Measurable Outcomes

| Metric | Target | Measurement |
|--------|--------|-------------|
| Core workflow coverage | 100% of check-in/check-out/night audit | Feature checklist |
| API latency p95 | < 200ms | Server-side measurement |
| Night Audit duration | < 60s for 167 rooms | End-to-end timing |
| Data migration completeness | 100% rooms, guests, active bookings | Record count validation |
| System uptime | 99.5% during hotel hours | Health check monitoring |
| Guest search latency | < 1s for 60K records | Query benchmark |
| Folio balance accuracy | 100% — SUM(debit) - SUM(credit) matches expected | Automated reconciliation |

---

## Product Scope

### MVP - Minimum Viable Product

**The smallest version that lets a front desk agent work an entire shift:**

1. Create and manage bookings (CRUD + status transitions)
2. Check-in guests (assign room, transition status)
3. Check-out guests (verify folio balance, release room, mark dirty)
4. View room availability for date ranges
5. Update housekeeping statuses
6. View arrivals/departures dashboard
7. Post charges and payments to guest folios
8. Run Night Audit (room+tax charges, no-shows, date roll)
9. Basic authentication (login/logout)

### Growth Features (Post-MVP)

- Tape chart / visual room grid with drag-and-drop
- Multi-window folio routing (routing charges between folio windows 1-8)
- Cashier open/close sessions
- Deposit ledger (pre-stay payments)
- Accounts Receivable (direct billing)
- Rate management (seasonal pricing, restrictions)
- Reporting dashboards (occupancy, revenue, forecast)
- Folio printing / PDF export

### Vision (Future)

- Multi-property support with centralized guest profiles
- Channel manager integration (Booking.com, Expedia)
- Group bookings and allotments
- Mobile housekeeping app
- Guest self-service portal
- Multi-currency support

---

## User Journeys

### Journey 1: Marina Creates a Booking (Front Desk Agent — Happy Path)

**Opening scene:** Marina answers the phone. A guest wants to book a Standard Double for next Friday through Sunday. Marina opens the PMS booking form.

**Rising action:** She types the guest's last name — the search instantly shows matching profiles. She selects the guest, picks "Standard Double" room type, enters the dates. The system shows 8 rooms available for those dates and suggests a rate of 4,500 RUB/night.

**Climax:** Marina clicks "Create Booking." The system generates confirmation number #PMS-00234, calculates total 9,000 RUB for 2 nights, and saves with status "confirmed."

**Resolution:** Marina reads the confirmation number to the guest. The booking appears in the arrivals list for Friday. Done in 45 seconds.

**Capabilities revealed:** Guest search, room type availability check, booking creation, confirmation number generation, rate calculation, arrivals list.

### Journey 2: Marina Checks In a Guest (Front Desk Agent — Check-in Flow)

**Opening scene:** Friday morning. Marina sees 12 arrivals on today's dashboard. A guest approaches the desk with a confirmation number.

**Rising action:** Marina searches by confirmation number, finds the booking. Status: "confirmed." She clicks "Check In." The system shows available clean rooms of the booked type — 6 Standard Doubles are clean & vacant.

**Climax:** Marina selects room 305, confirms the assignment. The system transitions the booking to "checked_in" and room 305 to "occupied."

**Resolution:** Marina hands the guest the key. Room 305 disappears from available rooms. The in-house count updates to show 1 more occupied room.

**Capabilities revealed:** Arrivals dashboard, booking search by confirmation number, room assignment from available pool, status transitions (booking + room), in-house tracking.

### Journey 3: Marina Checks Out a Guest (Front Desk Agent — Check-out with Folio)

**Opening scene:** Sunday noon. A guest returns their key and wants to check out.

**Rising action:** Marina searches by room number 305 and finds the active booking. She opens the folio tab — it shows 2 room charges (4,500 RUB each, posted by Night Audit), 2 tax charges (900 RUB each at 20% VAT), and 1 minibar charge (350 RUB). Total balance: 11,150 RUB.

**Climax:** Marina takes the guest's credit card and posts a card payment for 11,150 RUB. The folio balance drops to zero. She clicks "Check Out." The system transitions the booking to "checked_out" and room 305 to "dirty/vacant."

**Resolution:** The folio shows a complete audit trail of all charges and the payment. The room appears on the housekeeping list as dirty.

**Capabilities revealed:** Search by room number, folio balance display, manual charge posting, payment posting, zero-balance check-out, automatic room status update.

### Journey 4: Dmitry Migrates Data from Opera (IT Admin)

**Opening scene:** Dmitry has installed the PMS on the hotel's server. PostgreSQL is running, the seed data shows a demo hotel. Now he needs to migrate real data from Opera V5.

**Rising action:** He configures the MCP server with Oracle connection credentials. Using the migration scripts, he imports the property profile, 167 rooms with correct types, and 61K guest records. Then he migrates active and recent bookings.

**Climax:** He runs the validation script. All rooms match. All guests imported. Active bookings show correct statuses and room assignments.

**Resolution:** Dmitry switches the front desk to the new PMS. Marina logs in and sees the real hotel data. Oracle can be decommissioned.

**Capabilities revealed:** Migration tooling, data validation, property/room/guest/booking import, Oracle bridge (MCP server).

### Journey 5: Housekeeping Supervisor Updates Room Status

**Opening scene:** After morning checkouts, the housekeeping supervisor opens the rooms list filtered by "dirty" status.

**Rising action:** She assigns rooms to her team. As each room is cleaned, she updates status: dirty → pickup (cleaning in progress) → clean. The floor supervisor inspects and marks: clean → inspected.

**Climax:** Room 305 shows "inspected + vacant" — it's ready for today's arrivals. Marina can now assign it to an incoming guest.

**Resolution:** The front desk sees real-time housekeeping status without phone calls. The arrivals dashboard shows which rooms are ready.

**Capabilities revealed:** Room filtering by status, housekeeping status transitions (dirty → pickup → clean → inspected), real-time status visibility across roles.

### Journey 6: Night Auditor Closes the Day

**Opening scene:** It's 2 AM. The night auditor opens the Night Audit page. The current business date shows "2026-02-13 — OPEN." The dashboard shows 95 rooms occupied, 3 confirmed bookings that never checked in.

**Rising action:** She clicks "Preview." The system shows: 3 no-shows to mark, 95 room charges to post (total 427,500 RUB), 95 tax charges (85,500 RUB at 20% VAT), 95 rooms to mark dirty. No due-outs with open balances — all clear.

**Climax:** She clicks "Run Night Audit." The system executes all steps atomically: marks 3 no-shows, posts 190 folio transactions (95 room + 95 tax), updates 95 rooms to dirty, closes business date 2026-02-13, opens 2026-02-14.

**Resolution:** The dashboard now shows business date 2026-02-14. All room charges are visible on guest folios. The Night Audit log confirms: 3 no-shows, 95 charges, 512,900 RUB total revenue. The process took 8 seconds.

**Capabilities revealed:** Business date management, Night Audit preview, atomic execution (all-or-nothing), room+tax posting, no-show processing, HK status update, business date roll.

### Journey 7: Marina Posts a Minibar Charge and Takes Payment

**Opening scene:** A guest in room 412 calls the front desk asking to add minibar items to their bill. Marina opens the booking for room 412.

**Rising action:** She opens the folio tab and clicks "Post Charge." She selects transaction code "Minibar" from the dropdown, enters amount 850 RUB, and adds description "2x water, 1x juice, 1x chocolate." The charge appears in the folio as a debit.

**Climax:** The guest comes to the desk later wanting to pay the minibar separately. Marina clicks "Post Payment," selects "Cash," enters 850 RUB. The system records the credit. The folio balance for this window remains at the room charge level only.

**Resolution:** The folio shows the complete audit trail: minibar charge at 14:30, cash payment at 16:15. Both entries are immutable — if a correction is needed, Marina would use "Adjust" to create a counter-entry.

**Capabilities revealed:** Manual charge posting with transaction codes, payment posting, append-only audit trail, folio balance updates, adjustment via counter-entry.

### Journey Requirements Summary

| Capability Area | Journeys |
|----------------|----------|
| Booking CRUD + status machine | 1, 2, 3 |
| Guest search (name, phone, confirmation#, room#) | 1, 2, 3 |
| Room availability check | 1, 2 |
| Room assignment | 2 |
| Check-in/check-out flows | 2, 3 |
| Folio management (charges, payments, balance) | 3, 6, 7 |
| Night Audit (room+tax posting, no-show, date roll) | 6 |
| Business date management | 6 |
| Housekeeping status management | 3, 5 |
| Dashboard (arrivals/departures/in-house) | 2, 3, 5 |
| Rate calculation | 1 |
| Data migration | 4 |
| Authentication | All |

---

## Domain-Specific Requirements

### Hospitality Industry Standards

- **2D Room Status Model:** Housekeeping status (clean/dirty/pickup/inspected/out_of_order/out_of_service) is independent from occupancy status (vacant/occupied). This is the industry standard per HTNG specifications.
- **Check-in/Check-out Times:** Property-level configuration (default 14:00/12:00). Bookings reference dates, not datetimes. Actual check-in/out timestamps recorded separately.
- **Confirmation Numbers:** Unique per property, sequential or formatted. Used as primary guest-facing identifier.
- **Night-based Pricing:** Hotels charge per night, not per day. A 2-night stay (Fri-Sun) has 2 rate entries (Fri night, Sat night). Rate can differ per night.
- **Business Date:** The hotel's operational date, independent of system clock. Changes only after Night Audit completion, not at midnight. All financial transactions reference business date, not wall-clock time.
- **Folio / Guest Account:** Every checked-in booking has a folio (account). Charges are debits, payments are credits. Balance = SUM(debit) - SUM(credit). Zero balance required for check-out.
- **Append-Only Transactions:** Financial transactions are never modified or deleted after posting. Corrections are made via counter-entries (adjustments). This ensures a complete audit trail.

### Data Integrity Constraints

- A room cannot be assigned to two overlapping bookings with status "checked_in"
- Room assignment is optional at booking creation, required at check-in
- Booking status transitions follow a strict state machine (no arbitrary jumps)
- Guest profile is required for every booking (no anonymous bookings)
- Exactly one open business date per property at any time (enforced by partial unique DB index)
- Night Audit is idempotent — duplicate runs for same business date are rejected
- Folio transactions reference a valid open or closed business date

### Clean-Room Implementation

- No Oracle/Opera vendor codes, table names, or naming conventions in the codebase
- Room type codes are our own: STD, STD_TWN, SUP, PRM, JRS, STE
- Transaction codes are our own: ROOM, ROOM_TAX, PAY_CASH, PAY_CARD, etc.
- All schema design follows hospitality industry patterns, not any specific vendor
- Opera research notes are internal documentation only (not shipped with product)

---

## Web Application Specific Requirements

### Architecture

- **Monorepo:** pnpm + Turborepo with apps (api, web) and packages (db, domain, shared)
- **Frontend:** Next.js 15 App Router, Server Components for data fetching, Client Components for interactivity
- **Backend:** Fastify 5 REST API, stateless, database via decorator plugin
- **Database:** PostgreSQL via Drizzle ORM, schema-first with migrations
- **Validation:** Zod schemas in `packages/shared`, validated at API boundaries

### API Design

- RESTful endpoints under `/api/` prefix
- JSON request/response
- Consistent error format: `{ error: string }`
- HTTP status codes: 200 (OK), 201 (Created), 400 (Bad Request), 404 (Not Found)
- Pagination via `limit` and `offset` query parameters where needed
- Mutation endpoints use explicit field whitelists (no spread of request body)

### Frontend Patterns

- Server Components for read operations (rooms list, guest search results, booking details)
- Client Components for forms and interactive elements (booking form, search input, status buttons)
- `apiFetch()` helper for server-side API calls
- Direct `fetch()` for client-side mutations
- No client-side state management library — URL params + server components

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — deliver the minimum feature set that lets a front desk agent work an entire shift without falling back to Opera or paper.

**Resource Requirements:** Solo developer with AI assistance. TypeScript full-stack skills. No dedicated DBA, QA, or designer needed for MVP.

### MVP Feature Set (Phases 3-7)

**Core User Journeys Supported:** Booking creation, check-in, check-out with folio, night audit, housekeeping updates, arrivals/departures dashboard.

**Must-Have Capabilities:**

**Phase 3 — Bookings (core data + logic) [COMPLETE]:**
- Rate plans table (id, propertyId, code, name, baseRate, isActive)
- Bookings table (id, propertyId, guestId, roomTypeId, roomId, ratePlanId, confirmationNumber, checkIn, checkOut, status, adults, children, specialRequests)
- Booking status state machine in domain package
- Availability check in domain package
- Booking CRUD API endpoints
- Availability query endpoint
- Confirmation number generation
- Seed: rate plans + sample bookings from Opera data
- Frontend: booking form, booking list, booking detail

**Phase 4 — Front Desk Operations:**
- Room assignment UI (select from available clean rooms)
- Check-in flow (find booking → assign room → transition status)
- Check-out flow (verify folio balance → transition booking → update room status)
- Housekeeping status update UI
- Dashboard: today's arrivals, departures, in-house guests

**Phase 5 — Financial Core:**
- Business dates table (propertyId, date, status=open/closed) with partial unique index enforcing 1 open date
- Transaction codes table (code, description, groupCode, transactionType, adjustmentCodeId)
- Folio transactions table (bookingId, businessDateId, transactionCodeId, debit, credit, appliedTaxRate, parentTransactionId)
- API: get current business date, initialize first business date
- API: get folio, post charge, post payment, adjust transaction
- Night Audit v2: preview + run (atomic DB transaction — no-show → room+tax posting → HK update → sync → close date → open next)
- Tax rate on property, preserved per-transaction via appliedTaxRate
- Domain: folio balance calculation, Night Audit eligibility check, tax calculation
- Seed: business date + 12 transaction codes
- Frontend: business date in header, folio tab on booking page, Night Audit page, charge/payment forms

**Phase 6 — Tape Chart:**
- Availability grid API (rooms x dates matrix)
- Visual room grid frontend
- Color-coded booking blocks

**Phase 7 — Auth + Polish:**
- Authentication (login/logout)
- Role-based access (admin, front-desk, housekeeping)
- Error handling, loading states, edge cases

### Post-MVP Features

**Phase 8+:**
- Multi-window folio routing (windows 1-8)
- Cashier open/close sessions
- Deposit ledger (pre-stay payments)
- Accounts Receivable (direct billing)
- Rate management (seasonal, restrictions)
- Reporting dashboards
- Folio printing / PDF export
- Multi-property support

### Risk Mitigation Strategy

**Technical risks:**
- Availability check performance at scale → Test with production-volume data (335K booking_nights) early
- Concurrent booking conflicts → Use database-level constraints + optimistic locking
- Night Audit failure mid-execution → Single DB transaction ensures atomicity; partial state impossible
- Tax rate changes → appliedTaxRate preserved per-transaction; historical data unaffected

**Market risks:**
- Low — this is an internal operational tool, not a consumer product. Validation is binary: does it replace Opera for daily operations?

**Resource risks:**
- Solo developer scope → Phased delivery. Each phase is independently useful. Phase 3 alone adds booking management to existing rooms/guests.

---

## Functional Requirements

### Booking Management

- FR1: Front desk agent can create a booking by selecting a guest, room type, date range, rate plan, and number of adults/children
- FR2: System generates a unique confirmation number for each booking
- FR3: Front desk agent can view a list of bookings filtered by status, date range, or guest name
- FR4: Front desk agent can view booking details including guest info, room assignment, rate, and status history
- FR5: Front desk agent can update booking details (dates, room type, rate plan, guest, special requests) via explicit field whitelist while status is "confirmed"
- FR6: Front desk agent can cancel a booking, transitioning status from "confirmed" to "cancelled"
- FR7: Front desk agent can mark a booking as no-show, transitioning from "confirmed" to "no_show"

### Availability & Rate Management

- FR8: System can determine available room count by room type for any date range
- FR9: System prevents creating a booking when no rooms of the requested type are available for the date range
- FR10: System calculates total booking cost based on rate plan and number of nights
- FR11: System stores per-night rate breakdown (booking_nights) to support rate changes mid-stay
- FR12: Admin can create and manage rate plans with code, name, base rate, and active status

### Check-in Operations

- FR13: Front desk agent can check in a guest by finding their booking and assigning a room
- FR14: System shows only rooms that are clean/inspected and vacant for the booked room type during room assignment
- FR15: System transitions booking status from "confirmed" to "checked_in" upon check-in
- FR16: System transitions room occupancy from "vacant" to "occupied" upon check-in
- FR17: Front desk agent can search bookings by confirmation number for quick check-in lookup

### Check-out Operations

- FR18: Front desk agent can check out a guest by finding their active booking
- FR19: System displays folio balance before check-out; check-out requires zero or negative balance
- FR20: System transitions booking status from "checked_in" to "checked_out" upon check-out
- FR21: System transitions room housekeeping status to "dirty" and occupancy to "vacant" upon check-out
- FR22: Front desk agent can search in-house bookings by room number

### Housekeeping Management

- FR23: Housekeeping staff can update room housekeeping status following valid transitions (dirty → pickup → clean → inspected)
- FR24: Housekeeping staff can view rooms filtered by housekeeping status
- FR25: Front desk agent can set a room to out_of_order or out_of_service status
- FR26: System prevents assigning out_of_order/out_of_service rooms to bookings

### Dashboard & Reporting

- FR27: Front desk agent can view today's expected arrivals (bookings with check-in date = business date, status = confirmed)
- FR28: Front desk agent can view today's expected departures (bookings with check-out date = business date, status = checked_in)
- FR29: Front desk agent can view current in-house guests (all bookings with status = checked_in)
- FR30: Dashboard shows room occupancy summary (total rooms, occupied, vacant, out of order)
- FR31: Dashboard displays current business date prominently

### Guest Management (Existing — Phase 2)

- FR32: Front desk agent can search guests by name, email, or phone with instant results
- FR33: Front desk agent can create a new guest profile during booking creation
- FR34: Front desk agent can view and edit guest profile details

### Authentication & Authorization

- FR35: Users can log in with username and password
- FR36: System restricts access based on user role (admin, front-desk, housekeeping)
- FR37: Housekeeping role can only access room status updates
- FR38: Front desk role can access bookings, guests, room management, and folio operations
- FR39: Admin role can access all features including rate plan management, transaction code configuration, and user management

### Tape Chart (Visual Availability)

- FR40: Front desk agent can view a visual grid of rooms vs dates showing booking occupancy
- FR41: Tape chart color-codes cells by booking status (confirmed, checked-in, checked-out)
- FR42: Front desk agent can click a booking block on the tape chart to view booking details

### Business Date Management

- FR43: System maintains a single open business date per property, independent of system clock
- FR44: System provides API to retrieve current business date for any property
- FR45: Admin can initialize the first business date during system setup

### Transaction Codes

- FR46: System provides configurable transaction codes with code, description, group (ROOM, PAYMENT, TAX, FB, MISC, ADJUSTMENT), and type (charge/payment)
- FR47: Each revenue transaction code links to its adjustment code for correction operations
- FR48: Transaction codes can be marked as manual-post-allowed or system-only (Night Audit)

### Folio Management

- FR49: Front desk agent can view a booking's folio showing all transactions (debit/credit), grouped by date, with running balance
- FR50: Front desk agent can post a manual charge to a folio by selecting a transaction code (must be manual-post-allowed) and entering amount
- FR51: Front desk agent can post a payment to a folio by selecting a payment transaction code and entering amount
- FR52: Front desk agent can adjust (reverse) a posted transaction, creating a counter-entry linked to the original via the original code's adjustment code
- FR53: System calculates folio balance as SUM(debit) - SUM(credit) and displays it on the booking detail page
- FR54: System prevents check-out when folio balance is positive (guest still owes)

### Night Audit

- FR55: Night auditor can preview Night Audit results before execution (no-show count, rooms to charge, estimated revenue, warnings)
- FR56: Night auditor can run Night Audit, which executes atomically: mark no-shows → post room charges → post tax charges → update HK statuses → close business date → open next business date
- FR57: Night Audit posts room charge (debit) and tax charge (debit, with appliedTaxRate preserved) for each checked-in booking
- FR58: Night Audit rejects duplicate execution for the same business date (idempotency guard)
- FR59: Night Audit marks all confirmed bookings with check-in date before current business date as no-show
- FR60: Night Audit updates all occupied rooms' housekeeping status to "dirty"

---

## Non-Functional Requirements

### Performance

- All API endpoints respond within 200ms (p95) under normal load
- Guest search returns results within 1 second for databases up to 100K guest records
- Availability check completes within 500ms for date ranges up to 90 days
- Night Audit completes within 60 seconds for 200 rooms (all steps inclusive)
- Frontend pages load within 2 seconds on standard broadband connection
- Tape chart renders within 3 seconds for 200 rooms x 30 days

### Security

- All passwords hashed with bcrypt (minimum 10 rounds)
- Session-based authentication with secure, HTTP-only cookies
- API endpoints require authentication except health check
- Role-based access control enforced at API level
- No sensitive data (passwords, tokens) in API responses or logs
- CORS configured for known frontend origins only
- Mutation endpoints use explicit field whitelists — no unfiltered request body spread

### Reliability

- Database constraints prevent double-booking at the data level
- Booking status transitions enforced by domain logic (state machine) — invalid transitions rejected
- All database writes use transactions where multiple tables are affected
- Night Audit executes as single DB transaction — all steps succeed or all roll back
- Night Audit is idempotent — duplicate runs for same business date are rejected with error
- Folio transactions are append-only — no UPDATE or DELETE after creation; corrections via counter-entries only
- Tax rate at time of posting preserved per-transaction (appliedTaxRate) — immune to future rate changes
- Exactly one open business date per property enforced by partial unique database index
- Graceful error handling — API returns structured error responses, frontend shows user-friendly messages

### Integration

- MCP server provides read-only bridge to Oracle Opera V5 for data migration
- REST API enables future integrations (channel manager, payment gateway)
- Database schema supports future extensions without breaking changes (nullable foreign keys for optional relations)

---

## Appendix: Technical Reference

### Booking Status State Machine

```
confirmed ──→ checked_in ──→ checked_out
    │
    ├──→ cancelled
    │
    └──→ no_show
```

Valid transitions:
- confirmed → checked_in, cancelled, no_show
- checked_in → checked_out
- checked_out, cancelled, no_show → (terminal states)

### Housekeeping Status Transitions

```
dirty ──→ pickup ──→ clean ──→ inspected
  ↑                    │           │
  └────────────────────┘           │
  ↑                                │
  └────────────────────────────────┘

Any status ──→ out_of_order ──→ dirty
Any status ──→ out_of_service ──→ dirty
```

### Night Audit Sequence

```
1. [Pre-check] Validate no blockers
2. [Idempotency] Reject if already ran for this business date
3. [No-shows] confirmed + checkInDate < businessDate → no_show
4. [Room charges] For each checked_in → post ROOM debit
5. [Tax charges] For each room charge → post ROOM_TAX debit (appliedTaxRate saved)
6. [HK update] Occupied rooms → housekeepingStatus = dirty
7. [Sync] Reconcile room occupancy with booking statuses
8. [Close date] Current business date → status = closed
9. [Open next] Create next business date → status = open

All steps in single DB transaction. Failure at any step → full rollback.
```

### Database Schema (Phase 3 additions)

```
rate_plans
├── id (uuid, PK)
├── propertyId (uuid, FK → properties)
├── code (varchar)
├── name (varchar)
├── baseRate (numeric)
├── isActive (boolean)
└── timestamps

bookings
├── id (uuid, PK)
├── propertyId (uuid, FK → properties)
├── guestId (uuid, FK → guests)
├── roomTypeId (uuid, FK → room_types)
├── roomId (uuid, FK → rooms, nullable)
├── ratePlanId (uuid, FK → rate_plans)
├── confirmationNumber (varchar, unique per property)
├── checkIn (date)
├── checkOut (date)
├── status (varchar: confirmed|checked_in|checked_out|cancelled|no_show)
├── adults (integer)
├── children (integer)
├── totalAmount (numeric, cached — source of truth is folio)
├── specialRequests (text)
└── timestamps
```

### Database Schema (Phase 5 — Financial Core)

```
business_dates
├── id (uuid, PK)
├── propertyId (uuid, FK → properties)
├── date (date, unique with propertyId)
├── status (varchar: open|closed)
├── closedAt (timestamp, nullable)
├── closedBy (uuid, nullable)
├── createdAt (timestamp)
└── UNIQUE INDEX (propertyId) WHERE status = 'open'  ← enforces 1 open date

transaction_codes
├── id (uuid, PK)
├── propertyId (uuid, FK → properties)
├── code (varchar, unique with propertyId)
├── description (varchar)
├── groupCode (varchar: ROOM|PAYMENT|TAX|FB|MISC|ADJUSTMENT)
├── transactionType (varchar: charge|payment)
├── isManualPostAllowed (boolean)
├── adjustmentCodeId (uuid, self-FK → transaction_codes, nullable)
├── isActive (boolean)
├── sortOrder (integer)
└── createdAt (timestamp)

folio_transactions
├── id (uuid, PK)
├── propertyId (uuid, FK → properties)
├── bookingId (uuid, FK → bookings)
├── businessDateId (uuid, FK → business_dates)
├── transactionCodeId (uuid, FK → transaction_codes)
├── folioWindow (integer, default 1, range 1-8)
├── debit (numeric, default 0)
├── credit (numeric, default 0)
├── quantity (integer, default 1)
├── description (varchar)
├── isSystemGenerated (boolean)
├── appliedTaxRate (numeric, nullable — for TAX entries only)
├── parentTransactionId (uuid, nullable — links tax→charge, adjustment→original)
├── postedBy (varchar: NIGHT_AUDIT|user:xxx|SYSTEM)
└── createdAt (timestamp)
```
