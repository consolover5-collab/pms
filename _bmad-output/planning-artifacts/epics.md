---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - docs/plans/2026-02-13-phase-4-financial-core.md
workflowType: epics-and-stories
project_name: pms
user_name: Oci
date: 2026-02-12
lastEdited: '2026-02-13'
editHistory:
  - date: '2026-02-13'
    changes: 'Add Epic 7 (Financial Core) with 6 stories for FR43-FR60. Update FR numbering, coverage map, requirements inventory to match updated PRD.'
---

# PMS - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for PMS, decomposing the requirements from the PRD and Architecture into implementable stories. The project is brownfield — Phases 0-2 (monorepo, rooms, guests) are complete. This breakdown covers Phases 3-7 (Bookings, Front Desk, Financial Core, Tape Chart, Auth).

## Requirements Inventory

### Functional Requirements

- FR1: Front desk agent can create a booking by selecting a guest, room type, date range, rate plan, and number of adults/children
- FR2: System generates a unique confirmation number for each booking
- FR3: Front desk agent can view a list of bookings filtered by status, date range, or guest name
- FR4: Front desk agent can view booking details including guest info, room assignment, rate, and status history
- FR5: Front desk agent can update booking details (dates, room type, rate plan, guest, special requests) via explicit field whitelist while status is "confirmed"
- FR6: Front desk agent can cancel a booking, transitioning status from "confirmed" to "cancelled"
- FR7: Front desk agent can mark a booking as no-show, transitioning from "confirmed" to "no_show"
- FR8: System can determine available room count by room type for any date range
- FR9: System prevents creating a booking when no rooms of the requested type are available for the date range
- FR10: System calculates total booking cost based on rate plan and number of nights
- FR11: System stores per-night rate breakdown (booking_nights) to support rate changes mid-stay
- FR12: Admin can create and manage rate plans with code, name, base rate, and active status
- FR13: Front desk agent can check in a guest by finding their booking and assigning a room
- FR14: System shows only rooms that are clean/inspected and vacant for the booked room type during room assignment
- FR15: System transitions booking status from "confirmed" to "checked_in" upon check-in
- FR16: System transitions room occupancy from "vacant" to "occupied" upon check-in
- FR17: Front desk agent can search bookings by confirmation number for quick check-in lookup
- FR18: Front desk agent can check out a guest by finding their active booking
- FR19: System displays folio balance before check-out; check-out requires zero or negative balance
- FR20: System transitions booking status from "checked_in" to "checked_out" upon check-out
- FR21: System transitions room housekeeping status to "dirty" and occupancy to "vacant" upon check-out
- FR22: Front desk agent can search in-house bookings by room number
- FR23: Housekeeping staff can update room housekeeping status following valid transitions (dirty → pickup → clean → inspected)
- FR24: Housekeeping staff can view rooms filtered by housekeeping status
- FR25: Front desk agent can set a room to out_of_order or out_of_service status
- FR26: System prevents assigning out_of_order/out_of_service rooms to bookings
- FR27: Front desk agent can view today's expected arrivals (bookings with check-in date = business date, status = confirmed)
- FR28: Front desk agent can view today's expected departures (bookings with check-out date = business date, status = checked_in)
- FR29: Front desk agent can view current in-house guests (all bookings with status = checked_in)
- FR30: Dashboard shows room occupancy summary (total rooms, occupied, vacant, out of order)
- FR31: Dashboard displays current business date prominently
- FR32: Front desk agent can search guests by name, email, or phone with instant results (existing)
- FR33: Front desk agent can create a new guest profile during booking creation (existing)
- FR34: Front desk agent can view and edit guest profile details (existing)
- FR35: Users can log in with username and password
- FR36: System restricts access based on user role (admin, front-desk, housekeeping)
- FR37: Housekeeping role can only access room status updates
- FR38: Front desk role can access bookings, guests, room management, and folio operations
- FR39: Admin role can access all features including rate plan management, transaction code configuration, and user management
- FR40: Front desk agent can view a visual grid of rooms vs dates showing booking occupancy
- FR41: Tape chart color-codes cells by booking status (confirmed, checked-in, checked-out)
- FR42: Front desk agent can click a booking block on the tape chart to view booking details
- FR43: System maintains a single open business date per property, independent of system clock
- FR44: System provides API to retrieve current business date for any property
- FR45: Admin can initialize the first business date during system setup
- FR46: System provides configurable transaction codes with code, description, group (ROOM, PAYMENT, TAX, FB, MISC, ADJUSTMENT), and type (charge/payment)
- FR47: Each revenue transaction code links to its adjustment code for correction operations
- FR48: Transaction codes can be marked as manual-post-allowed or system-only (Night Audit)
- FR49: Front desk agent can view a booking's folio showing all transactions (debit/credit), grouped by date, with running balance
- FR50: Front desk agent can post a manual charge to a folio by selecting a transaction code (must be manual-post-allowed) and entering amount
- FR51: Front desk agent can post a payment to a folio by selecting a payment transaction code and entering amount
- FR52: Front desk agent can adjust (reverse) a posted transaction, creating a counter-entry linked to the original via the original code's adjustment code
- FR53: System calculates folio balance as SUM(debit) - SUM(credit) and displays it on the booking detail page
- FR54: System prevents check-out when folio balance is positive (guest still owes)
- FR55: Night auditor can preview Night Audit results before execution (no-show count, rooms to charge, estimated revenue, warnings)
- FR56: Night auditor can run Night Audit, which executes atomically: mark no-shows → post room charges → post tax charges → update HK statuses → close business date → open next business date
- FR57: Night Audit posts room charge (debit) and tax charge (debit, with appliedTaxRate preserved) for each checked-in booking
- FR58: Night Audit rejects duplicate execution for the same business date (idempotency guard)
- FR59: Night Audit marks all confirmed bookings with check-in date before current business date as no-show
- FR60: Night Audit updates all occupied rooms' housekeeping status to "dirty"

### NonFunctional Requirements

- NFR1: All API endpoints respond within 200ms (p95) under normal load
- NFR2: Guest search returns results within 1 second for databases up to 100K guest records
- NFR3: Availability check completes within 500ms for date ranges up to 90 days
- NFR4: Night Audit completes within 60 seconds for 200 rooms (all steps inclusive)
- NFR5: Frontend pages load within 2 seconds on standard broadband connection
- NFR6: Tape chart renders within 3 seconds for 200 rooms × 30 days
- NFR7: All passwords hashed with bcrypt (minimum 10 rounds)
- NFR8: Session-based authentication with secure, HTTP-only cookies
- NFR9: API endpoints require authentication except health check
- NFR10: Role-based access control enforced at API level
- NFR11: No sensitive data (passwords, tokens) in API responses or logs
- NFR12: CORS configured for known frontend origins only
- NFR13: Mutation endpoints use explicit field whitelists — no unfiltered request body spread
- NFR14: Database constraints prevent double-booking at the data level
- NFR15: Booking status transitions enforced by domain logic (state machine)
- NFR16: All database writes use transactions where multiple tables are affected
- NFR17: Night Audit executes as single DB transaction — all steps succeed or all roll back
- NFR18: Night Audit is idempotent — duplicate runs for same business date are rejected
- NFR19: Folio transactions are append-only — no UPDATE or DELETE after creation; corrections via counter-entries only
- NFR20: Tax rate at time of posting preserved per-transaction (appliedTaxRate)
- NFR21: Exactly one open business date per property enforced by partial unique database index
- NFR22: Graceful error handling — API returns structured error responses, frontend shows user-friendly messages

### Additional Requirements

- Brownfield project: existing properties, room_types, rooms, guests schema + API + frontend
- booking_nights table with composite unique constraint (bookingId, date)
- Availability algorithm: total rooms (excl OOO/OOS) minus count of overlapping bookings (confirmed/checked_in)
- Confirmation number format: PMS-NNNNNN via PostgreSQL sequence
- Check-in/check-out: db.transaction() for atomic multi-table updates
- Domain logic in packages/domain/ — pure functions, no framework dependencies
- RBAC via Fastify preHandler hook checking request.user.role
- Session-based auth with PostgreSQL session store
- Financial schema in dedicated packages/db/src/schema/financial.ts
- Business date seed: one open date = today
- Transaction codes seed: 12 codes (ADJ_* first, then revenue/payment codes with adjustmentCodeId references)
- Self-FK adjustmentCodeId via raw SQL migration
- taxRate field on properties table (numeric 5,2, default 0)
- Folio balance = SUM(debit) - SUM(credit); zero or negative required for check-out
- Night Audit: idempotency guard checks existing ROOM charges for current business date

### FR Coverage Map

- FR1: Epic 1 — Booking creation API + frontend form
- FR2: Epic 1 — Confirmation number generation via PostgreSQL sequence
- FR3: Epic 1 — Booking list API + frontend with filters
- FR4: Epic 1 — Booking detail API + frontend page
- FR5: Epic 1 — Booking update API + frontend actions (explicit field whitelist)
- FR6: Epic 1 — Cancel booking via status transition API
- FR7: Epic 1 — No-show via status transition API
- FR8: Epic 1 — Availability check domain logic + API
- FR9: Epic 1 — Availability validation before booking creation
- FR10: Epic 1 — Rate calculation from rate plan × nights
- FR11: Epic 1 — booking_nights table with per-night amounts
- FR12: Epic 1 — Rate plans CRUD API
- FR13: Epic 2 — Check-in flow with room assignment
- FR14: Epic 2 — Available room filtering (clean/inspected + vacant)
- FR15: Epic 2 — Booking status transition to checked_in
- FR16: Epic 2 — Room occupancy transition to occupied
- FR17: Epic 2 — Search by confirmation number (also Epic 1 list)
- FR18: Epic 2 — Check-out flow
- FR19: Epic 2 — Folio balance check before check-out (requires Epic 7)
- FR20: Epic 2 — Booking status transition to checked_out
- FR21: Epic 2 — Room housekeeping → dirty, occupancy → vacant
- FR22: Epic 2 — Search in-house bookings by room number
- FR23: Epic 3 — Housekeeping status transitions
- FR24: Epic 3 — Room filtering by housekeeping status
- FR25: Epic 3 — OOO/OOS room status management
- FR26: Epic 3 — Prevent assigning OOO/OOS rooms
- FR27: Epic 4 — Dashboard arrivals view (by business date)
- FR28: Epic 4 — Dashboard departures view (by business date)
- FR29: Epic 4 — Dashboard in-house view
- FR30: Epic 4 — Dashboard occupancy summary
- FR31: Epic 4 — Business date display (requires Epic 7)
- FR32: Existing (Phase 2) — Guest search
- FR33: Existing (Phase 2) — Guest creation
- FR34: Existing (Phase 2) — Guest detail/edit
- FR35: Epic 6 — User login
- FR36: Epic 6 — Role-based access
- FR37: Epic 6 — Housekeeping role restrictions
- FR38: Epic 6 — Front desk role access (including folio)
- FR39: Epic 6 — Admin role access (including transaction codes)
- FR40: Epic 5 — Tape chart grid view
- FR41: Epic 5 — Tape chart color coding
- FR42: Epic 5 — Tape chart booking navigation
- FR43: Epic 7 — Business date schema + partial unique index
- FR44: Epic 7 — Business date API (GET current)
- FR45: Epic 7 — Business date initialization API
- FR46: Epic 7 — Transaction codes schema + seed
- FR47: Epic 7 — adjustmentCodeId self-FK linking
- FR48: Epic 7 — isManualPostAllowed flag on transaction codes
- FR49: Epic 7 — Folio view API (transactions + balance)
- FR50: Epic 7 — Manual charge posting API
- FR51: Epic 7 — Payment posting API
- FR52: Epic 7 — Transaction adjustment API (counter-entry)
- FR53: Epic 7 — Folio balance calculation (domain)
- FR54: Epic 7 — Check-out folio balance guard
- FR55: Epic 7 — Night Audit preview API
- FR56: Epic 7 — Night Audit run API (atomic)
- FR57: Epic 7 — Room+tax charge posting
- FR58: Epic 7 — Night Audit idempotency guard
- FR59: Epic 7 — Night Audit no-show processing
- FR60: Epic 7 — Night Audit HK status update

## Epic List

### Epic 1: Booking Creation & Management
Front desk agent can create, view, search, update, and cancel bookings with automatic availability checking and rate calculation. This is the core data foundation that all subsequent epics build upon.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12

### Epic 2: Check-in & Check-out Operations
Front desk agent can check in guests by assigning rooms and check out guests with automatic room status updates. Check-out includes folio balance verification (after Epic 7).
**FRs covered:** FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22

### Epic 3: Housekeeping Management
Housekeeping staff can update room cleaning statuses and front desk can manage out-of-order/out-of-service rooms. Coordinates room readiness between housekeeping and front desk.
**FRs covered:** FR23, FR24, FR25, FR26

### Epic 4: Front Desk Dashboard
Front desk agent has a shift dashboard showing today's arrivals, departures, in-house guests, occupancy summary, and current business date for efficient daily operations.
**FRs covered:** FR27, FR28, FR29, FR30, FR31

### Epic 5: Tape Chart
Front desk agent can view a visual room-by-date grid showing booking occupancy, enabling quick availability assessment and booking navigation.
**FRs covered:** FR40, FR41, FR42

### Epic 6: Authentication & Authorization
System secured with user login and role-based access control — admin, front desk, and housekeeping roles with appropriate permissions including folio and transaction code access.
**FRs covered:** FR35, FR36, FR37, FR38, FR39

### Epic 7: Financial Core
Business date management, transaction codes, folio transactions (debit/credit model), and Night Audit v2. This epic enables the hotel to track financial transactions, post room charges automatically, and close the business day.
**FRs covered:** FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR51, FR52, FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60

---

## Epic 1: Booking Creation & Management

Front desk agent can create, view, search, update, and cancel bookings. After this epic, the system has rate plans, availability checking, booking CRUD with confirmation numbers, and frontend pages for the full booking lifecycle — everything needed before check-in/check-out operations.

### Story 1.1: Booking schema extension & seed data

As a developer,
I want the booking_nights table, confirmation number sequence, and seed data in place,
So that the booking system has its complete data foundation.

**Acceptance Criteria:**

**Given** the existing bookings and ratePlans tables in packages/db/src/schema/bookings.ts
**When** the schema is extended
**Then** a bookingNights table is created with columns: id (uuid PK), bookingId (FK → bookings), date (date), ratePlanId (FK → rate_plans), amount (numeric 10,2), createdAt, updatedAt
**And** a composite unique constraint exists on (bookingId, date)

**Given** the need for sequential confirmation numbers
**When** the migration runs
**Then** a PostgreSQL sequence `confirmation_number_seq` is created
**And** the sequence starts at 1

**Given** the seed script
**When** seed runs
**Then** at least 3 rate plans are created (e.g., Standard, Flexible, Non-Refundable) with realistic base rates
**And** at least 5 sample bookings are created with various statuses (confirmed, checked_in, checked_out)
**And** each booking has corresponding booking_nights records with correct per-night amounts

### Story 1.2: Rate plans API

As an admin,
I want to manage rate plans through the API,
So that the hotel can configure available rates for bookings.

**Acceptance Criteria:**

**Given** a request to GET /api/rate-plans
**When** the endpoint is called with propertyId query parameter
**Then** it returns an array of rate plans for that property
**And** each rate plan includes id, code, name, description, baseRate, isActive

**Given** a request to POST /api/rate-plans with valid body
**When** the endpoint is called with code, name, baseRate, propertyId
**Then** a new rate plan is created and returned with 201 status

**Given** a request to PUT /api/rate-plans/:id with updated fields
**When** the endpoint is called
**Then** the rate plan is updated and returned
**And** only name, description, baseRate, isActive can be updated

**Given** a request with missing required fields
**When** any rate plan endpoint is called
**Then** it returns 400 with `{ error: "..." }` message

### Story 1.3: Availability check logic & API

As a front desk agent,
I want to check room availability for a date range,
So that I can see how many rooms of each type are available before creating a booking.

**Acceptance Criteria:**

**Given** a room type with 10 total rooms and 3 overlapping bookings (status confirmed or checked_in)
**When** availability is checked for that room type and date range
**Then** the system returns 7 available rooms
**And** rooms with status out_of_order or out_of_service are excluded from total count

**Given** a request to GET /api/availability?propertyId=X&from=2026-03-01&to=2026-03-03
**When** the endpoint is called
**Then** it returns availability per room type: `[{ roomTypeId, roomTypeCode, roomTypeName, total, booked, available }]`

**Given** an optional roomTypeId parameter
**When** GET /api/availability?propertyId=X&roomTypeId=Y&from=...&to=...
**Then** it returns availability for only that room type

**Given** the domain package
**When** availability logic is implemented
**Then** a pure function `calculateAvailability(totalRooms, bookedCount)` exists in packages/domain/src/booking/availability.ts
**And** the function has no framework dependencies

### Story 1.4: Booking CRUD API

As a front desk agent,
I want to create, view, list, and update bookings through the API,
So that I can manage the hotel's reservation data.

**Acceptance Criteria:**

**Given** a valid booking creation request to POST /api/bookings
**When** the request includes guestId, roomTypeId, ratePlanId, propertyId, checkIn, checkOut, adults
**Then** a booking is created with status "confirmed"
**And** a unique confirmation number is generated in format PMS-NNNNNN (zero-padded from sequence)
**And** booking_nights records are created for each night (checkIn to checkOut-1) with the rate plan's base rate
**And** the response includes the full booking with confirmation number and total amount
**And** the response status is 201

**Given** a booking creation request for a date range with no available rooms
**When** availability check fails for the requested room type
**Then** the request is rejected with 409 status and `{ error: "No rooms available for the requested dates" }`

**Given** a request to GET /api/bookings with optional filters
**When** the endpoint is called with status, dateFrom, dateTo, guestId query parameters
**Then** it returns an array of bookings matching the filters
**And** each booking includes guest name and room type name (joined)

**Given** a request to GET /api/bookings/:id
**When** the endpoint is called with a valid booking ID
**Then** it returns the full booking detail including guest info, room info, rate plan, and booking_nights
**And** a non-existent ID returns 404

**Given** a request to PUT /api/bookings/:id with updated fields
**When** the booking status is "confirmed"
**Then** the booking is updated using explicit field whitelist (checkIn, checkOut, roomTypeId, ratePlanId, guestId, adults, children, specialRequests)
**And** booking_nights are recalculated if dates or rate plan changed

**Given** a request to PUT /api/bookings/:id
**When** the booking status is NOT "confirmed"
**Then** the request is rejected with 400 and `{ error: "Can only update confirmed bookings" }`

**Given** a request to PATCH /api/bookings/:id/status with `{ status: "cancelled" }`
**When** the current status is "confirmed"
**Then** the booking status transitions to "cancelled"

**Given** a request to PATCH /api/bookings/:id/status with `{ status: "no_show" }`
**When** the current status is "confirmed"
**Then** the booking status transitions to "no_show"

**Given** an invalid status transition
**When** PATCH /api/bookings/:id/status is called
**Then** the domain state machine rejects the transition
**And** the API returns 400 with the state machine error message

### Story 1.5: Booking list page

As a front desk agent,
I want to see a list of bookings with filters,
So that I can quickly find and manage reservations.

**Acceptance Criteria:**

**Given** the /bookings page
**When** it loads
**Then** it displays a list of bookings with columns: confirmation number, guest name, room type, check-in, check-out, status
**And** bookings are sorted by check-in date descending by default

**Given** the booking list page
**When** the agent filters by status (confirmed, checked_in, checked_out, cancelled, no_show)
**Then** the list updates to show only bookings with that status

**Given** the booking list page
**When** the agent enters a search term
**Then** the list filters by guest name or confirmation number

**Given** a booking in the list
**When** the agent clicks on it
**Then** they are navigated to the booking detail page

**Given** the booking list page
**When** the agent clicks "New Booking"
**Then** they are navigated to the booking creation page

### Story 1.6: Booking creation page

As a front desk agent,
I want a form to create new bookings,
So that I can register guest reservations with the correct room type, dates, and rate.

**Acceptance Criteria:**

**Given** the /bookings/new page
**When** it loads
**Then** it displays a form with fields: guest (search), room type (select), check-in date, check-out date, rate plan (select), adults, children, special requests

**Given** the booking form
**When** the agent types a guest name
**Then** guest search results appear for selection (uses existing guest search API)

**Given** the booking form with room type and dates filled
**When** the values change
**Then** availability is checked and displayed (e.g., "8 rooms available")
**And** if no rooms available, the form shows a warning and disables submit

**Given** the booking form with all required fields filled
**When** the agent selects a rate plan
**Then** the total cost is calculated and displayed (base rate × number of nights)

**Given** a valid, complete booking form
**When** the agent clicks "Create Booking"
**Then** the booking is created via API
**And** the agent is redirected to the booking detail page
**And** the confirmation number is prominently displayed

### Story 1.7: Booking detail page

As a front desk agent,
I want to view booking details and perform status actions,
So that I can manage individual reservations and their lifecycle.

**Acceptance Criteria:**

**Given** the /bookings/:id page
**When** it loads with a valid booking ID
**Then** it displays: confirmation number, guest name (linked to guest detail), room type, check-in/check-out dates, status, adults/children, special requests, rate plan, per-night breakdown, total amount

**Given** a booking with status "confirmed"
**When** the detail page loads
**Then** "Cancel" and "No-Show" action buttons are visible
**And** clicking "Cancel" transitions to cancelled after confirmation dialog
**And** clicking "No-Show" transitions to no_show after confirmation dialog

**Given** a booking with terminal status (checked_out, cancelled, no_show)
**When** the detail page loads
**Then** no action buttons are shown

**Given** a booking with status "confirmed"
**When** the agent clicks "Edit"
**Then** the booking fields become editable (dates, room type, rate plan, adults, children, special requests)
**And** saving calls PUT /api/bookings/:id

---

## Epic 2: Check-in & Check-out Operations

Front desk agent can check in guests by assigning rooms from available clean/inspected rooms, and check out guests with automatic room status updates. After this epic, the complete booking lifecycle (create → check-in → check-out) is operational. Check-out verifies folio balance when Financial Core (Epic 7) is active.

### Story 2.1: Check-in API with room assignment

As a front desk agent,
I want to check in a guest by assigning a specific room,
So that the booking is activated and the room is marked as occupied.

**Acceptance Criteria:**

**Given** a booking with status "confirmed" and a roomId in the PATCH body
**When** PATCH /api/bookings/:id/status is called with `{ status: "checked_in", roomId: "..." }`
**Then** within a database transaction:
**And** the booking status is set to "checked_in"
**And** the booking's roomId is set to the assigned room
**And** the room's occupancyStatus is set to "occupied"
**And** all changes are committed atomically

**Given** a check-in request with a room that is NOT clean or inspected
**When** the API processes the request
**Then** it returns 400 with `{ error: "Room is not ready (must be clean or inspected)" }`

**Given** a check-in request with a room that is NOT vacant
**When** the API processes the request
**Then** it returns 400 with `{ error: "Room is already occupied" }`

**Given** a check-in request with a room of a different room type than booked
**When** the API processes the request
**Then** it returns 400 with `{ error: "Room type does not match booking" }`

**Given** a request to GET /api/rooms?roomTypeId=X&housekeepingStatus=clean,inspected&occupancyStatus=vacant
**When** the front desk queries available rooms for check-in
**Then** only rooms matching all criteria are returned

### Story 2.2: Check-out API with room status update

As a front desk agent,
I want to check out a guest,
So that the booking is completed and the room is released for housekeeping.

**Acceptance Criteria:**

**Given** a booking with status "checked_in"
**When** PATCH /api/bookings/:id/status is called with `{ status: "checked_out" }`
**Then** within a database transaction:
**And** the booking status is set to "checked_out"
**And** the assigned room's housekeepingStatus is set to "dirty"
**And** the assigned room's occupancyStatus is set to "vacant"
**And** all changes are committed atomically

**Given** a booking with folio balance > 0 (after Epic 7 is active)
**When** check-out is attempted
**Then** the request is rejected with 400 `{ error: "Folio balance must be zero or credit before check-out" }`

**Given** a booking with status other than "checked_in"
**When** check-out is attempted
**Then** the domain state machine rejects the transition with 400

**Given** a checked-in booking
**When** the agent searches by room number via GET /api/bookings?roomNumber=305&status=checked_in
**Then** the API returns the active booking for that room

### Story 2.3: Check-in UI flow

As a front desk agent,
I want a check-in interface on the booking detail page,
So that I can assign a room and complete check-in in a few clicks.

**Acceptance Criteria:**

**Given** a booking detail page with status "confirmed"
**When** the agent clicks "Check In"
**Then** a room selection panel appears showing available rooms (clean/inspected + vacant) of the booked room type
**And** each room shows room number and floor

**Given** the room selection panel
**When** the agent selects a room and confirms
**Then** the check-in API is called with the selected roomId
**And** on success, the page refreshes showing status "checked_in" with assigned room number
**And** on error, an error message is displayed

### Story 2.4: Check-out UI flow

As a front desk agent,
I want a check-out interface on the booking detail page,
So that I can complete checkout and release the room.

**Acceptance Criteria:**

**Given** a booking detail page with status "checked_in"
**When** the page loads
**Then** a "Check Out" button is visible with the assigned room number displayed
**And** folio balance is shown (when Epic 7 is active)

**Given** the "Check Out" button
**When** the agent clicks it and confirms
**Then** the check-out API is called
**And** on success, the page refreshes showing status "checked_out"
**And** a message confirms the room has been set to dirty

**Given** the booking search functionality
**When** the agent searches by room number (e.g., "305")
**Then** the active checked-in booking for that room is found and displayed

---

## Epic 3: Housekeeping Management

Housekeeping staff can update room cleaning statuses following valid transitions, and front desk can manage out-of-order/out-of-service rooms. After this epic, room readiness coordination between housekeeping and front desk is fully operational.

### Story 3.1: Housekeeping status management API & UI

As a housekeeping supervisor,
I want to update room cleaning statuses and filter rooms by housekeeping status,
So that I can coordinate room readiness with the front desk team.

**Acceptance Criteria:**

**Given** the existing rooms API (PATCH /api/rooms/:id)
**When** a housekeeping status update is sent
**Then** the domain state machine validates the transition (dirty → pickup → clean → inspected)
**And** invalid transitions are rejected with 400

**Given** the rooms list page
**When** the housekeeping supervisor selects a housekeeping status filter (dirty, pickup, clean, inspected, out_of_order, out_of_service)
**Then** only rooms with that status are displayed

**Given** a room on the rooms list page
**When** the supervisor clicks a status transition button
**Then** the room status is updated via API
**And** the room card reflects the new status immediately

**Given** a front desk agent managing a room
**When** they set a room to out_of_order or out_of_service
**Then** the room status is updated
**And** the room is excluded from availability calculations (FR26)
**And** the room cannot be assigned during check-in

**Given** a room with out_of_order or out_of_service status
**When** the status is changed back to dirty
**Then** the room re-enters the normal housekeeping flow

---

## Epic 4: Front Desk Dashboard

Front desk agent has a shift dashboard showing today's operational data — arrivals, departures, in-house guests, room occupancy summary, and current business date. After this epic, the front desk has a single page for daily operations overview.

### Story 4.1: Dashboard API

As a front desk agent,
I want API endpoints for today's operational data,
So that the dashboard can display real-time shift information.

**Acceptance Criteria:**

**Given** a request to GET /api/dashboard/arrivals?propertyId=X
**When** the endpoint is called
**Then** it returns bookings with checkIn = current business date and status = "confirmed"
**And** each booking includes guest name, room type, confirmation number

**Given** a request to GET /api/dashboard/departures?propertyId=X
**When** the endpoint is called
**Then** it returns bookings with checkOut = current business date and status = "checked_in"
**And** each booking includes guest name, room number, confirmation number

**Given** a request to GET /api/dashboard/in-house?propertyId=X
**When** the endpoint is called
**Then** it returns all bookings with status = "checked_in"
**And** each booking includes guest name, room number, check-out date

**Given** a request to GET /api/dashboard/summary?propertyId=X
**When** the endpoint is called
**Then** it returns: totalRooms, occupiedRooms, vacantRooms, outOfOrderRooms, outOfServiceRooms, dirtyRooms, cleanRooms, currentBusinessDate

### Story 4.2: Dashboard page

As a front desk agent,
I want a dashboard page showing today's operations,
So that I can see arrivals, departures, and room status at a glance during my shift.

**Acceptance Criteria:**

**Given** the /dashboard page
**When** it loads
**Then** it displays current business date prominently at the top
**And** it displays four sections: Arrivals, Departures, In-House, Room Summary

**Given** the Arrivals section
**When** today has 5 expected arrivals
**Then** it shows a list of 5 bookings with guest name, room type, confirmation number
**And** clicking a booking navigates to booking detail page

**Given** the Departures section
**When** today has 3 expected departures
**Then** it shows a list of 3 bookings with guest name, room number, confirmation number
**And** clicking a booking navigates to booking detail page

**Given** the In-House section
**When** there are 45 checked-in bookings
**Then** it shows total count and a scrollable list of in-house guests

**Given** the Room Summary section
**When** it loads
**Then** it shows occupancy stats as cards: "120/167 Occupied", "47 Vacant", "3 OOO", "15 Dirty"

---

## Epic 5: Tape Chart

Front desk agent can view a visual room-by-date grid showing booking occupancy across a date range, enabling quick visual availability assessment. After this epic, the front desk has the industry-standard "tape chart" view.

### Story 5.1: Tape chart API

As a front desk agent,
I want a grid data API for the tape chart,
So that the visual room grid can be rendered with booking information.

**Acceptance Criteria:**

**Given** a request to GET /api/tape-chart?propertyId=X&from=2026-03-01&to=2026-03-14
**When** the endpoint is called
**Then** it returns a structure with:
**And** `rooms`: array of rooms (id, number, floor, roomTypeName)
**And** `dates`: array of dates in the range
**And** `bookings`: array of bookings that overlap the date range, each with id, confirmationNumber, guestName, roomId, checkIn, checkOut, status

**Given** a date range of 30 days for a property with 167 rooms
**When** the API processes the request
**Then** the response is returned within 3 seconds (NFR6)

### Story 5.2: Tape chart page

As a front desk agent,
I want a visual tape chart showing rooms × dates,
So that I can quickly see room availability and booking patterns.

**Acceptance Criteria:**

**Given** the /tape-chart page
**When** it loads
**Then** it displays a grid with rooms as rows and dates as columns (default: next 14 days)
**And** date range can be adjusted with from/to controls

**Given** a booking occupying room 305 from March 1-3
**When** the tape chart renders
**Then** cells for room 305 on March 1 and March 2 are filled with a booking block
**And** the block is color-coded by status: blue for confirmed, green for checked_in, gray for checked_out

**Given** a booking block on the tape chart
**When** the agent clicks on it
**Then** they are navigated to the booking detail page for that booking

**Given** an empty cell on the tape chart
**When** it is displayed
**Then** it shows as available (white/light background)

---

## Epic 6: Authentication & Authorization

System is secured with user login, session management, and role-based access control. After this epic, the PMS requires authentication and enforces role-based permissions.

### Story 6.1: Auth backend — users, login, sessions

As a system administrator,
I want user authentication with session management,
So that the PMS is secured and only authorized users can access it.

**Acceptance Criteria:**

**Given** the database schema
**When** the users table is created
**Then** it has columns: id (uuid PK), username (varchar, unique), passwordHash (varchar), role (varchar: admin/front_desk/housekeeping), propertyId (FK → properties), isActive (boolean), createdAt, updatedAt

**Given** a request to POST /api/auth/login with `{ username, password }`
**When** credentials are valid
**Then** a session is created in PostgreSQL
**And** a secure HTTP-only cookie is set
**And** the response returns `{ id, username, role }`

**Given** invalid credentials
**When** POST /api/auth/login is called
**Then** it returns 401 with `{ error: "Invalid username or password" }`

**Given** a request to POST /api/auth/logout
**When** the user is logged in
**Then** the session is destroyed and the cookie is cleared

**Given** a request to GET /api/auth/me
**When** the user has a valid session
**Then** it returns `{ id, username, role }`
**And** when no valid session exists, it returns 401

**Given** the seed script
**When** seed runs
**Then** a default admin user is created (username: admin, password: admin123)
**And** the password is hashed with bcrypt (10+ rounds)

### Story 6.2: RBAC middleware & route protection

As a system administrator,
I want role-based access control on all API endpoints,
So that users can only access features appropriate to their role.

**Acceptance Criteria:**

**Given** any API endpoint except GET /health and POST /api/auth/login
**When** called without a valid session
**Then** it returns 401 with `{ error: "Authentication required" }`

**Given** a Fastify preHandler hook for auth
**When** registered globally
**Then** it validates session cookie on every request
**And** sets request.user with { id, username, role }
**And** skips validation for whitelisted routes (health, login)

**Given** a user with role "housekeeping"
**When** they attempt to access /api/bookings or /api/guests
**Then** the request is rejected with 403 `{ error: "Insufficient permissions" }`

**Given** a user with role "front_desk"
**When** they attempt to POST /api/rate-plans (admin-only)
**Then** the request is rejected with 403

**Given** a user with role "admin"
**When** they access any endpoint
**Then** the request is allowed

### Story 6.3: Login page & frontend session handling

As a front desk agent,
I want a login page and session-aware navigation,
So that I can securely access the PMS.

**Acceptance Criteria:**

**Given** the /login page
**When** it loads
**Then** it displays a login form with username and password fields

**Given** valid credentials entered in the login form
**When** the agent clicks "Login"
**Then** POST /api/auth/login is called
**And** on success, the agent is redirected to /dashboard
**And** the navigation shows the logged-in username and role

**Given** invalid credentials
**When** login is attempted
**Then** an error message "Invalid username or password" is displayed

**Given** any page in the application
**When** the user is not authenticated (no valid session)
**Then** they are redirected to /login

**Given** a logged-in user
**When** they click "Logout" in the navigation
**Then** POST /api/auth/logout is called
**And** they are redirected to /login

---

## Epic 7: Financial Core

Business date management, configurable transaction codes, folio transactions with debit/credit model, and Night Audit v2 with atomic execution. After this epic, the hotel can track financial transactions per guest, automatically post room and tax charges overnight, accept payments, and close the business day. This is the cashiering backbone of the PMS.

**FRs covered:** FR43-FR60
**Dependencies:** Epic 1 (bookings exist), Epic 2 (check-in/check-out exists)
**Design document:** `docs/plans/2026-02-13-phase-4-financial-core.md`

### Story 7.1: Business date schema, seed & API

As a system administrator,
I want a business date system independent of the system clock,
So that all hotel operations reference the correct operational date.

**Acceptance Criteria:**

**Given** the database schema
**When** the business_dates table is created in packages/db/src/schema/financial.ts
**Then** it has columns: id (uuid PK), propertyId (FK → properties), date (date), status (varchar: open|closed), closedAt (timestamp, nullable), closedBy (uuid, nullable), createdAt (timestamp)
**And** a unique constraint on (propertyId, date)
**And** a partial unique index on (propertyId) WHERE status = 'open' — guaranteeing exactly 1 open date per property

**Given** the seed script
**When** seed runs
**Then** one business_dates record is created for the property with date = today and status = 'open'

**Given** a request to GET /api/business-date?propertyId=X
**When** the endpoint is called
**Then** it returns the single open business date: `{ id, propertyId, date, status }`
**And** if no open date exists, it returns 404

**Given** a request to POST /api/business-date/initialize with `{ propertyId, date }`
**When** no business date exists for this property
**Then** a new open business date is created and returned with 201
**And** if an open business date already exists, it returns 409 `{ error: "Business date already initialized" }`

### Story 7.2: Transaction codes schema & seed

As a system administrator,
I want configurable transaction codes for all financial operations,
So that charges and payments are categorized and traceable.

**Acceptance Criteria:**

**Given** the database schema
**When** the transaction_codes table is created in packages/db/src/schema/financial.ts
**Then** it has columns: id (uuid PK), propertyId (FK → properties), code (varchar), description (varchar), groupCode (varchar: ROOM|PAYMENT|TAX|FB|MISC|ADJUSTMENT), transactionType (varchar: charge|payment), isManualPostAllowed (boolean), isActive (boolean), adjustmentCodeId (uuid, nullable), sortOrder (integer), createdAt (timestamp)
**And** a unique constraint on (propertyId, code)

**Given** the adjustmentCodeId column
**When** the migration runs
**Then** a self-FK constraint is added via raw SQL: `ALTER TABLE transaction_codes ADD CONSTRAINT fk_adjustment_code FOREIGN KEY (adjustment_code_id) REFERENCES transaction_codes(id)`

**Given** the seed script
**When** seed runs
**Then** 12 transaction codes are created in order:
**And** First: ADJ_ROOM, ADJ_FB (adjustmentCodeId = null)
**And** Then: ROOM (adjustmentCodeId → ADJ_ROOM), ROOM_TAX, EXTRA_BED (→ ADJ_ROOM), NO_SHOW (→ ADJ_ROOM), PAY_CASH, PAY_CARD, PAY_TRANSFER, FB_REST (→ ADJ_FB), FB_BAR (→ ADJ_FB), MINIBAR (→ ADJ_FB)
**And** ROOM and ROOM_TAX have isManualPostAllowed = false (system-only)
**And** Payment codes have transactionType = 'payment', all others = 'charge'

**Given** a request to GET /api/transaction-codes?propertyId=X
**When** the endpoint is called
**Then** it returns all active transaction codes sorted by sortOrder

### Story 7.3: Folio transactions schema & domain logic

As a developer,
I want the folio_transactions table and domain functions for balance calculation,
So that the system has a complete financial ledger for guest accounts.

**Acceptance Criteria:**

**Given** the database schema
**When** the folio_transactions table is created in packages/db/src/schema/financial.ts
**Then** it has columns: id (uuid PK), propertyId (FK), bookingId (FK → bookings), businessDateId (FK → business_dates), transactionCodeId (FK → transaction_codes), folioWindow (integer, default 1), debit (numeric 10,2, default 0), credit (numeric 10,2, default 0), quantity (integer, default 1), description (varchar), isSystemGenerated (boolean, default false), appliedTaxRate (numeric 5,2, nullable), parentTransactionId (uuid, nullable), postedBy (varchar), createdAt (timestamp)

**Given** the properties table
**When** the schema is extended
**Then** a taxRate column is added (numeric 5,2, default 0) — representing VAT percentage (e.g., 20.00 = 20%)

**Given** packages/domain/src/folio.ts
**When** the domain functions are implemented
**Then** `calculateFolioBalance(transactions)` returns SUM(debit) - SUM(credit)
**And** `canCheckOut(balance)` returns true when balance <= 0
**And** `calculateTax(amount, taxRatePercent)` returns Math.round(amount * taxRatePercent) / 100
**And** all functions are pure (no framework dependencies)

### Story 7.4: Folio CRUD API

As a front desk agent,
I want to view folios and post charges/payments/adjustments,
So that I can manage guest financial accounts.

**Acceptance Criteria:**

**Given** a request to GET /api/bookings/:bookingId/folio
**When** the endpoint is called for a valid booking
**Then** it returns `{ balance, transactions: [...], summary: { totalCharges, totalPayments } }`
**And** transactions are sorted by createdAt descending
**And** each transaction includes: id, date (from business date), transactionCode (code + description), debit, credit, description, isSystemGenerated, appliedTaxRate, postedBy

**Given** a request to POST /api/bookings/:bookingId/folio/post with `{ transactionCodeId, amount, description? }`
**When** the transaction code has isManualPostAllowed = true and the business date is open
**Then** a folio_transaction is created with debit = amount (for charge) or credit = amount (for payment), based on transactionType
**And** postedBy = "user:current" and isSystemGenerated = false

**Given** a request to POST /api/bookings/:bookingId/folio/post
**When** the transaction code has isManualPostAllowed = false
**Then** it returns 400 `{ error: "This transaction code is system-only" }`

**Given** a request to POST /api/bookings/:bookingId/folio/payment with `{ transactionCodeId, amount }`
**When** the transaction code has transactionType = 'payment'
**Then** a folio_transaction is created with debit = 0, credit = amount

**Given** a request to POST /api/bookings/:bookingId/folio/adjust with `{ transactionId, reason }`
**When** the original transaction's code has an adjustmentCodeId
**Then** a new folio_transaction is created with: transactionCodeId = adjustmentCodeId, debit = original.credit, credit = original.debit (mirror), parentTransactionId = original.id, description = reason

**Given** a request to POST /api/bookings/:bookingId/folio/adjust
**When** the original transaction's code has no adjustmentCodeId
**Then** it returns 400 `{ error: "This transaction type cannot be adjusted" }`

### Story 7.5: Night Audit v2

As a night auditor,
I want to run Night Audit to close the business day,
So that room charges are posted, no-shows are marked, and the hotel advances to the next business date.

**Acceptance Criteria:**

**Given** a request to POST /api/night-audit/preview?propertyId=X
**When** the endpoint is called
**Then** it returns: `{ businessDate, dueOuts, pendingNoShows, roomsToCharge, estimatedRevenue, warnings }`
**And** dueOuts = checked_in bookings with checkOut <= businessDate
**And** pendingNoShows = confirmed bookings with checkIn < businessDate
**And** roomsToCharge = all checked_in bookings
**And** warnings include due-out notices

**Given** a request to POST /api/night-audit/run with `{ propertyId }`
**When** the Night Audit has not yet run for the current business date
**Then** all steps execute in a single DB transaction:
**And** Step 1: Idempotency guard — check for existing ROOM charges with isSystemGenerated=true for current businessDateId. If found → reject with 409
**And** Step 2: Mark no-shows — confirmed bookings with checkIn < businessDate → status = no_show
**And** Step 3: Post room charges — for each checked_in booking, insert folio_transaction with transactionCode=ROOM, debit=rateAmount, isSystemGenerated=true, postedBy=NIGHT_AUDIT
**And** Step 4: Post tax charges — for each room charge (if property.taxRate > 0), insert folio_transaction with transactionCode=ROOM_TAX, debit=taxAmount, appliedTaxRate=property.taxRate, parentTransactionId=roomChargeId, isSystemGenerated=true
**And** Step 5: Update HK — all occupied rooms → housekeepingStatus = dirty
**And** Step 6: Sync room statuses (existing logic)
**And** Step 7: Close business date — status = closed, closedAt = now()
**And** Step 8: Open next — insert new business_date (date + 1, status = open)

**Given** any step fails during Night Audit
**When** the error occurs
**Then** the entire transaction rolls back — no partial state
**And** the business date remains open

**Given** the response on success
**When** Night Audit completes
**Then** it returns: `{ businessDate, nextBusinessDate, noShows, roomChargesPosted, taxChargesPosted, roomsUpdated, totalRevenue }`

**Given** a request to POST /api/night-audit/run
**When** Night Audit already ran for this business date (idempotency guard)
**Then** it returns 409 `{ error: "Night Audit already completed for this business date" }`

### Story 7.6: Financial Core UI

As a front desk agent,
I want to see business date, folio details, and Night Audit controls in the UI,
So that I can work with financial data without using raw API calls.

**Acceptance Criteria:**

**Given** the application layout
**When** any page loads
**Then** the current business date is displayed in the header/nav area (e.g., "Business Date: 2026-02-13")

**Given** the booking detail page (/bookings/:id) for a checked_in booking
**When** the page loads
**Then** a "Folio" tab/section is visible
**And** it shows all folio transactions in a table with columns: Date, Code, Description, Debit, Credit
**And** the folio balance is displayed prominently (positive = guest owes, zero = settled)

**Given** the folio section
**When** the agent clicks "Post Charge"
**Then** a form appears with: transaction code dropdown (filtered to manual-post-allowed charges), amount, description
**And** submitting posts the charge and refreshes the folio

**Given** the folio section
**When** the agent clicks "Post Payment"
**Then** a form appears with: payment code dropdown (PAY_CASH, PAY_CARD, etc.), amount
**And** submitting posts the payment and refreshes the folio

**Given** a transaction row in the folio
**When** the agent clicks "Adjust"
**Then** a confirmation dialog appears with a reason field
**And** confirming creates the counter-entry and refreshes the folio

**Given** the /night-audit page
**When** it loads
**Then** it shows the current business date and a "Preview" button
**And** clicking "Preview" shows the preview data (no-shows, charges count, estimated revenue, warnings)
**And** a "Run Night Audit" button is available after preview
**And** clicking "Run" executes Night Audit and shows the result summary
**And** on error (e.g., already ran), the error message is displayed
