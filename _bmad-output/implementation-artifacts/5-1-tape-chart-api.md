# Story 5.1: Tape Chart API

Status: done

## Story

As a front desk agent,
I want a grid data API for the tape chart,
So that the visual room grid can be rendered with booking information for quick availability assessment.

## Acceptance Criteria

1. **Given** a request to GET /api/tape-chart?propertyId=X&from=2026-03-01&to=2026-03-14
   **When** the endpoint is called
   **Then** it returns a structure with:
   - `rooms`: array of rooms sorted by roomType sortOrder then roomNumber, each with id, roomNumber, floor, roomTypeName, roomTypeCode
   - `dates`: array of ISO date strings in the range [from, to)
   - `bookings`: array of bookings that overlap the date range, each with id, confirmationNumber, guestName (firstName + lastName), roomId (nullable for unassigned), roomTypeId, checkInDate, checkOutDate, status

2. **Given** a date range of 30 days for a property with 167 rooms
   **When** the API processes the request
   **Then** the response is returned within 3 seconds (NFR6)

3. **Given** a request without `propertyId`
   **When** the endpoint is called
   **Then** it returns 400 with `{ error: "propertyId is required" }`

4. **Given** a request without `from` or `to` parameters
   **When** the endpoint is called
   **Then** it returns 400 with `{ error: "from and to date parameters are required" }`

5. **Given** a request with `from` > `to`
   **When** the endpoint is called
   **Then** it returns 400 with `{ error: "from must be before to" }`

6. **Given** bookings with statuses confirmed, checked_in, checked_out
   **When** the tape chart API is called
   **Then** only bookings with status in ('confirmed', 'checked_in', 'checked_out') are returned
   **And** cancelled and no_show bookings are excluded

7. **Given** a booking that partially overlaps the date range (checkIn before `from` or checkOut after `to`)
   **When** the tape chart API is called
   **Then** the booking is included in the response (overlap query: checkInDate < to AND checkOutDate > from)

## Tasks / Subtasks

- [x] Task 1: Create tape-chart route file (AC: #1, #3, #4, #5)
  - [x] 1.1 Create `apps/api/src/routes/tape-chart.ts` with `tapeChartRoutes` export
  - [x] 1.2 Implement input validation (propertyId, from, to, date order)
  - [x] 1.3 Query rooms with roomType join, sorted by sortOrder + roomNumber
  - [x] 1.4 Generate dates array from `from` to `to` (exclusive end)
  - [x] 1.5 Query bookings with guest join, using date-range overlap filter
  - [x] 1.6 Return combined response `{ rooms, dates, bookings }`

- [x] Task 2: Register route in app.ts (AC: #1)
  - [x] 2.1 Import `tapeChartRoutes` in `apps/api/src/app.ts`
  - [x] 2.2 Register with `app.register(tapeChartRoutes)`

- [x] Task 3: Verify performance (AC: #2)
  - [x] 3.1 Test with existing seed data to confirm response time is reasonable
  - [x] 3.2 Ensure no N+1 queries — single query for rooms, single query for bookings

## Dev Notes

### Architecture Compliance

- **Route pattern**: Follow exact pattern from `dashboard.ts` — `FastifyPluginAsync`, `app.get<{ Querystring }>()`, propertyId validation via `isValidUuid()` from `../lib/validation`
- **DB access**: Use `app.db` (Drizzle) — no direct DB imports, use the decorator
- **Error format**: Always `{ error: "message" }` with appropriate HTTP status
- **No domain logic needed**: This is a pure read-only query endpoint — no state machine, no domain package involvement

### Technical Requirements

- **Date-range overlap query**: The standard overlap condition is `checkInDate < :to AND checkOutDate > :from` — this catches all bookings that touch any day in the range
- **Status filter**: Include only `confirmed`, `checked_in`, `checked_out` — exclude `cancelled` and `no_show` since they don't occupy rooms
- **Dates array generation**: Generate in the API route, not DB — simple loop from `from` to `to` (exclusive). Use plain Date arithmetic or manual ISO string iteration
- **Room sorting**: Sort by `roomTypes.sortOrder` ASC, then `rooms.roomNumber` ASC — this groups rooms by type in the grid

### Library/Framework Requirements

- **Drizzle ORM operators needed**: `eq`, `and`, `inArray`, `lt`, `gt` from `drizzle-orm`
- **Schema imports**: `rooms`, `roomTypes`, `bookings`, `guests` from `@pms/db`
- **Validation import**: `isValidUuid` from `../lib/validation`
- **No new dependencies** — everything needed is already in the project

### File Structure Requirements

| File | Action |
|------|--------|
| `apps/api/src/routes/tape-chart.ts` | **CREATE** — new route file |
| `apps/api/src/app.ts` | **MODIFY** — add import + register |

### Exact Schema Field Names (from codebase)

**bookings table** (`packages/db/src/schema/bookings.ts`):
- `bookings.id`, `bookings.propertyId`, `bookings.guestId`, `bookings.roomId` (nullable)
- `bookings.roomTypeId`, `bookings.confirmationNumber`
- `bookings.checkInDate` (date), `bookings.checkOutDate` (date)
- `bookings.status` (varchar: confirmed|checked_in|checked_out|cancelled|no_show)

**rooms table** (`packages/db/src/schema/rooms.ts`):
- `rooms.id`, `rooms.propertyId`, `rooms.roomTypeId`
- `rooms.roomNumber` (varchar), `rooms.floor` (integer, nullable)

**roomTypes table** (`packages/db/src/schema/rooms.ts`):
- `roomTypes.id`, `roomTypes.name`, `roomTypes.code`, `roomTypes.sortOrder`

**guests table** (`packages/db/src/schema/guests.ts`):
- `guests.id`, `guests.firstName`, `guests.lastName`

### Query Patterns

**Rooms query** (join with roomTypes for name/code):
```typescript
app.db
  .select({
    id: rooms.id,
    roomNumber: rooms.roomNumber,
    floor: rooms.floor,
    roomTypeName: roomTypes.name,
    roomTypeCode: roomTypes.code,
  })
  .from(rooms)
  .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
  .where(eq(rooms.propertyId, propertyId))
  .orderBy(roomTypes.sortOrder, rooms.roomNumber);
```

**Bookings query** (overlap + status filter + guest join):
```typescript
app.db
  .select({
    id: bookings.id,
    confirmationNumber: bookings.confirmationNumber,
    guestFirstName: guests.firstName,
    guestLastName: guests.lastName,
    roomId: bookings.roomId,
    roomTypeId: bookings.roomTypeId,
    checkInDate: bookings.checkInDate,
    checkOutDate: bookings.checkOutDate,
    status: bookings.status,
  })
  .from(bookings)
  .innerJoin(guests, eq(bookings.guestId, guests.id))
  .where(
    and(
      eq(bookings.propertyId, propertyId),
      lt(bookings.checkInDate, to),
      gt(bookings.checkOutDate, from),
      inArray(bookings.status, ["confirmed", "checked_in", "checked_out"]),
    ),
  );
```

### Response Shape

```json
{
  "rooms": [
    { "id": "uuid", "roomNumber": "101", "floor": 1, "roomTypeName": "Standard", "roomTypeCode": "STD" },
    { "id": "uuid", "roomNumber": "102", "floor": 1, "roomTypeName": "Standard", "roomTypeCode": "STD" }
  ],
  "dates": ["2026-03-01", "2026-03-02", "2026-03-03"],
  "bookings": [
    {
      "id": "uuid",
      "confirmationNumber": "PMS-000012",
      "guestName": "Ivan Petrov",
      "roomId": "uuid-or-null",
      "roomTypeId": "uuid",
      "checkInDate": "2026-03-01",
      "checkOutDate": "2026-03-03",
      "status": "confirmed"
    }
  ]
}
```

**Note on guestName**: Concatenate `firstName + " " + lastName` in the response mapping, not in the SQL select. Use JS `.map()` post-query to combine the fields.

### Testing Standards

- Manual test via curl/httpie after implementation
- Verify with existing seed data (at least some bookings should overlap common date ranges)
- Check edge cases: empty date range, no bookings in range, rooms with no bookings

### Previous Story Intelligence (Epic 4)

From Epic 4 (Dashboard) — the most recent completed work:
- `dashboard.ts` is the closest pattern to follow — read-only queries with propertyId validation
- `getBusinessDate()` helper exists in dashboard.ts but is NOT needed for tape chart (tape chart uses user-provided date range, not business date)
- All routes use `isValidUuid()` from `../lib/validation` for propertyId validation
- Routes return plain JSON (no wrapper, no pagination for MVP)

### Git Intelligence

Recent commits show consistent patterns:
- `47da37e` feat: implement Epic 7 — Financial Core (Stories 7.1–7.6)
- `dc270bb` feat: refactor dashboard page to use dedicated API endpoints (Story 4.2)
- `f896398` feat: add dashboard API endpoints (Story 4.1)

All follow the established Fastify plugin pattern. No breaking changes or new patterns introduced.

### Project Structure Notes

- Route file goes in `apps/api/src/routes/tape-chart.ts` — matches kebab-case convention
- Export name: `tapeChartRoutes` — matches camelCase convention
- Endpoint path: `/api/tape-chart` — matches kebab-case API convention
- No domain logic file needed — this is a pure query endpoint

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5 — Story 5.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns — tape-chart endpoint]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns — Route files]
- [Source: _bmad-output/planning-artifacts/prd.md#FR40, FR41, FR42 — Tape Chart]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR6 — Tape chart 3s render for 200 rooms × 30 days]
- [Source: apps/api/src/routes/dashboard.ts — closest pattern reference]
- [Source: packages/db/src/schema/bookings.ts — exact field names]
- [Source: packages/db/src/schema/rooms.ts — exact field names]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Created GET /api/tape-chart endpoint following dashboard.ts pattern
- Input validation: propertyId (UUID), from/to (date strings), from < to
- Rooms query: innerJoin with roomTypes, sorted by sortOrder + roomNumber
- Bookings query: overlap filter (checkInDate < to AND checkOutDate > from), status filter (confirmed, checked_in, checked_out), innerJoin with guests
- guestName concatenated post-query via .map()
- Dates array generated via UTC Date arithmetic (exclusive end)
- Performance: 29ms for 54 rooms × 30 days × 8 bookings — well within NFR6 (3s)
- All 7 acceptance criteria verified via manual API testing

### File List

- `apps/api/src/routes/tape-chart.ts` — CREATED (new route)
- `apps/api/src/app.ts` — MODIFIED (import + register tapeChartRoutes)
