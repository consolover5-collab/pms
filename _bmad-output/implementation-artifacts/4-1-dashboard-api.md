# Story 4.1: Dashboard API

Status: done

## Story

As a front desk agent,
I want API endpoints for today's operational data,
so that the dashboard can display real-time shift information.

## Acceptance Criteria

1. **GET /api/dashboard/arrivals?propertyId=X** returns bookings with `checkInDate` = today (system date, fallback until business date from Epic 7) and `status = "confirmed"`. Each booking includes guest name (firstName + lastName), room type (name + code), confirmation number, adults, children, and assigned room (id + roomNumber, nullable — shows if room is pre-assigned).

2. **GET /api/dashboard/departures?propertyId=X** returns bookings with `checkOutDate` = today and `status = "checked_in"`. Each booking includes guest name, room number, room type (name + code), confirmation number.

3. **GET /api/dashboard/in-house?propertyId=X** returns all bookings with `status = "checked_in"`. Each booking includes guest name, room number, room type (name + code), check-out date. Sorted by check-out date ascending (soonest departures first).

4. **GET /api/dashboard/summary?propertyId=X** returns: `totalRooms`, `occupiedRooms`, `vacantRooms`, `outOfOrderRooms`, `outOfServiceRooms`, `dirtyRooms`, `cleanRooms`, `inspectedRooms`, `arrivalsCount`, `departuresCount`, `inHouseCount`, `currentBusinessDate` (system date as fallback).

5. All endpoints require `propertyId` query parameter and return 400 if missing.

6. All endpoints return data as JSON arrays (arrivals, departures, in-house) or JSON object (summary).

## Tasks / Subtasks

- [x] Task 1: Create `apps/api/src/routes/dashboard.ts` (AC: #1, #2, #3, #4, #5, #6)
  - [x] 1.1: Implement `GET /api/dashboard/arrivals` — query bookings with join to guests, roomTypes, and leftJoin rooms (pre-assigned room)
  - [x] 1.2: Implement `GET /api/dashboard/departures` — query bookings with join to guests, rooms, and roomTypes
  - [x] 1.3: Implement `GET /api/dashboard/in-house` — query bookings with join to guests, rooms, and roomTypes; sort by checkOutDate ASC
  - [x] 1.4: Implement `GET /api/dashboard/summary` — aggregate room counts by status + booking counts (arrivals/departures/in-house)
  - [x] 1.5: Add propertyId validation (return 400 if missing)
- [x] Task 2: Register route in `apps/api/src/app.ts` (AC: all)
  - [x] 2.1: Import `dashboardRoutes` and register with `app.register()`
- [x] Task 3: Verify endpoints work with existing seed data

## Dev Notes

### Architecture Compliance

- **Route pattern**: Single file `dashboard.ts` exporting `FastifyPluginAsync`, registered in `app.ts` — matches existing routes (`bookings.ts`, `rooms.ts`, etc.)
- **DB access**: Use `app.db` decorator (Drizzle), NOT direct connection import
- **Error format**: `{ error: "message" }` with appropriate HTTP status
- **No domain logic needed**: Dashboard is pure read-only aggregation, no state machine or business logic
- **PropertyId handling**: Via query parameter, same pattern as `GET /api/bookings?propertyId=X`

### Business Date Fallback

FR31 requires displaying current business date. Epic 7 (Financial Core) introduces the `business_dates` table. Until then:
- Use `new Date().toISOString().split("T")[0]` as fallback for `currentBusinessDate`
- Add `// TODO: Replace with business date from business_dates table (Epic 7)` comment
- The night-audit route already uses this pattern (`const today = new Date().toISOString().split("T")[0]`)

### Query Patterns

**Arrivals query** (AC #1):
```typescript
// Bookings where checkInDate = today AND status = 'confirmed'
// leftJoin rooms to show pre-assigned room (nullable)
app.db.select({
  id: bookings.id,
  confirmationNumber: bookings.confirmationNumber,
  checkInDate: bookings.checkInDate,
  checkOutDate: bookings.checkOutDate,
  status: bookings.status,
  adults: bookings.adults,
  children: bookings.children,
  guest: { id: guests.id, firstName: guests.firstName, lastName: guests.lastName },
  roomType: { id: roomTypes.id, name: roomTypes.name, code: roomTypes.code },
  room: { id: rooms.id, roomNumber: rooms.roomNumber },
})
.from(bookings)
.innerJoin(guests, eq(bookings.guestId, guests.id))
.innerJoin(roomTypes, eq(bookings.roomTypeId, roomTypes.id))
.leftJoin(rooms, eq(bookings.roomId, rooms.id))
.where(and(
  eq(bookings.propertyId, propertyId),
  eq(bookings.checkInDate, today),
  eq(bookings.status, "confirmed"),
))
```

**Departures query** (AC #2):
```typescript
// Bookings where checkOutDate = today AND status = 'checked_in'
// Join to rooms for room number + roomTypes for room type info
app.db.select({
  id: bookings.id,
  confirmationNumber: bookings.confirmationNumber,
  checkOutDate: bookings.checkOutDate,
  guest: { id: guests.id, firstName: guests.firstName, lastName: guests.lastName },
  room: { id: rooms.id, roomNumber: rooms.roomNumber },
  roomType: { id: roomTypes.id, name: roomTypes.name, code: roomTypes.code },
})
.from(bookings)
.innerJoin(guests, eq(bookings.guestId, guests.id))
.innerJoin(roomTypes, eq(bookings.roomTypeId, roomTypes.id))
.leftJoin(rooms, eq(bookings.roomId, rooms.id))
.where(and(
  eq(bookings.propertyId, propertyId),
  eq(bookings.checkOutDate, today),
  eq(bookings.status, "checked_in"),
))
```

**In-house query** (AC #3):
```typescript
// All bookings with status = 'checked_in', sorted by checkout date (soonest first)
app.db.select({
  id: bookings.id,
  confirmationNumber: bookings.confirmationNumber,
  checkOutDate: bookings.checkOutDate,
  guest: { id: guests.id, firstName: guests.firstName, lastName: guests.lastName },
  room: { id: rooms.id, roomNumber: rooms.roomNumber },
  roomType: { id: roomTypes.id, name: roomTypes.name, code: roomTypes.code },
})
.from(bookings)
.innerJoin(guests, eq(bookings.guestId, guests.id))
.innerJoin(roomTypes, eq(bookings.roomTypeId, roomTypes.id))
.leftJoin(rooms, eq(bookings.roomId, rooms.id))
.where(and(
  eq(bookings.propertyId, propertyId),
  eq(bookings.status, "checked_in"),
))
.orderBy(bookings.checkOutDate)
```

**Summary query** (AC #4):
```typescript
// Count rooms by status
const allRooms = await app.db
  .select({
    housekeepingStatus: rooms.housekeepingStatus,
    occupancyStatus: rooms.occupancyStatus,
  })
  .from(rooms)
  .where(eq(rooms.propertyId, propertyId));

// Aggregate in JS (simpler than SQL GROUP BY for this small dataset)
const totalRooms = allRooms.length;
const occupiedRooms = allRooms.filter(r => r.occupancyStatus === "occupied").length;
const vacantRooms = allRooms.filter(r => r.occupancyStatus === "vacant").length;
const outOfOrderRooms = allRooms.filter(r => r.housekeepingStatus === "out_of_order").length;
const outOfServiceRooms = allRooms.filter(r => r.housekeepingStatus === "out_of_service").length;
const dirtyRooms = allRooms.filter(r => r.housekeepingStatus === "dirty").length;
const cleanRooms = allRooms.filter(r => r.housekeepingStatus === "clean").length;
const inspectedRooms = allRooms.filter(r => r.housekeepingStatus === "inspected").length;

// Booking counts for summary (3 additional queries)
const arrivalsCount = await app.db.select({ id: bookings.id }).from(bookings)
  .where(and(eq(bookings.propertyId, propertyId), eq(bookings.checkInDate, today), eq(bookings.status, "confirmed")));
const departuresCount = await app.db.select({ id: bookings.id }).from(bookings)
  .where(and(eq(bookings.propertyId, propertyId), eq(bookings.checkOutDate, today), eq(bookings.status, "checked_in")));
const inHouseCount = await app.db.select({ id: bookings.id }).from(bookings)
  .where(and(eq(bookings.propertyId, propertyId), eq(bookings.status, "checked_in")));

return {
  totalRooms, occupiedRooms, vacantRooms,
  outOfOrderRooms, outOfServiceRooms, dirtyRooms, cleanRooms, inspectedRooms,
  arrivalsCount: arrivalsCount.length,
  departuresCount: departuresCount.length,
  inHouseCount: inHouseCount.length,
  currentBusinessDate: today,
};
```

### Existing Schema — Key Columns

**bookings table** (`packages/db/src/schema/bookings.ts`):
- `checkInDate` (date), `checkOutDate` (date), `status` (varchar)
- `guestId` (FK → guests), `roomId` (FK → rooms, nullable), `roomTypeId` (FK → roomTypes)
- `propertyId` (FK → properties), `confirmationNumber` (varchar, unique)

**rooms table** (`packages/db/src/schema/rooms.ts`):
- `housekeepingStatus` (varchar: clean/dirty/pickup/inspected/out_of_order/out_of_service)
- `occupancyStatus` (varchar: vacant/occupied)
- `roomNumber` (varchar), `floor` (integer)

**Imports needed** (from `@pms/db`):
```typescript
import { bookings, guests, rooms, roomTypes } from "@pms/db";
```
Drizzle operators from `drizzle-orm`:
```typescript
import { eq, and } from "drizzle-orm";
```

### Project Structure Notes

- New file: `apps/api/src/routes/dashboard.ts`
- Modified file: `apps/api/src/app.ts` (add import + register)
- No schema changes needed
- No domain logic needed
- No frontend changes (that's Story 4.2)

### Retro Learnings (Epics 1-2-3)

- **Atomic commits per story** — this story = separate commit
- **BMAD workflow followed** — story created via `/bmad-bmm-create-story`
- **No `...request.body` spread** — N/A for read-only endpoints but keep in mind
- **Error pattern**: Use early return `if (!x) return reply.status(400).send({ error: "..." })`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4, Story 4.1]
- [Source: _bmad-output/planning-artifacts/architecture.md — API & Communication Patterns, Dashboard row]
- [Source: _bmad-output/planning-artifacts/prd.md — FR27, FR28, FR29, FR30, FR31]
- [Source: apps/api/src/routes/bookings.ts — existing route pattern]
- [Source: apps/api/src/app.ts — route registration pattern]
- [Source: apps/api/src/routes/night-audit.ts — today date fallback pattern]
- [Source: packages/db/src/schema/bookings.ts — booking columns]
- [Source: packages/db/src/schema/rooms.ts — room status columns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeScript typecheck: passed (0 errors)
- API functional test: all 4 endpoints verified with seed data via curl
- Validation test: 400 returned when propertyId missing

### Completion Notes List

- Created `dashboard.ts` with 4 GET endpoints: arrivals, departures, in-house, summary
- All endpoints follow existing route pattern (FastifyPluginAsync, app.db, eq/and from drizzle-orm)
- Business date uses system date fallback with TODO comment for Epic 7
- Summary includes room counts (total/occupied/vacant/OOO/OOS/dirty/clean/inspected) + booking counts (arrivals/departures/in-house) + currentBusinessDate
- Departures and in-house include roomType join (added during focus group elicitation)
- Arrivals include leftJoin rooms for pre-assigned room visibility
- In-house sorted by checkOutDate ascending (soonest departures first)
- propertyId validation returns 400 `{ error: "propertyId is required" }` on all endpoints
- No domain logic, no schema changes, no new dependencies

### Change Log

- 2026-02-14: Initial implementation — all tasks complete, verified with seed data
- 2026-02-14: Code review fixes — H1 pickupRooms added, M1 SQL COUNT, L1 innerJoin for checked_in, L2 UUID validation, L3 single reduce

### File List

- `apps/api/src/routes/dashboard.ts` (NEW)
- `apps/api/src/app.ts` (MODIFIED — added import + register)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 | **Date:** 2026-02-14

### Findings (7 total: 1 HIGH, 3 MEDIUM, 3 LOW)

| # | Sev | Issue | Status |
|---|-----|-------|--------|
| H1 | HIGH | Missing `pickupRooms` in summary — rooms in `pickup` HK status invisible | FIXED |
| M1 | MEDIUM | Booking counts SELECT all IDs + `.length` instead of SQL COUNT | FIXED |
| M2 | MEDIUM | `getToday()` uses UTC — wrong at night for UTC+2 hotel | DEFERRED (Epic 7) |
| M3 | MEDIUM | No automated tests — only manual curl verification | NOTED |
| L1 | LOW | `leftJoin` rooms for checked_in bookings → changed to `innerJoin` | FIXED |
| L2 | LOW | No UUID format validation on `propertyId` | FIXED |
| L3 | LOW | Room status counts: 8 filter iterations → single `reduce` | FIXED |

**Verdict:** 5 of 7 issues fixed. M2 is a known Epic 7 dependency. M3 noted for future improvement.
**Status:** APPROVED → done
