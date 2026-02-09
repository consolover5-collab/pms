# PMS MVP Design — Reservations + Front Desk

**Date:** 2026-02-09
**Status:** Approved

## Goal

Open source Property Management System replacing legacy Opera PMS V5.
MVP scope: Reservations + Front Desk module for a single hotel.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), shadcn/ui, Tailwind CSS |
| Backend | Fastify + TypeScript |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Monorepo | pnpm + Turborepo |
| Validation | Zod |
| Auth | Better Auth or Lucia |
| Dev env | Docker Compose |

## Architecture

Monorepo with two apps and shared packages:

```
pms/
├── apps/
│   ├── web/          — Next.js frontend
│   └── api/          — Fastify backend
├── packages/
│   ├── db/           — Drizzle schema, migrations, seed
│   ├── domain/       — Pure business logic (no framework deps)
│   └── shared/       — Shared types, Zod validators
├── tools/
│   └── mcp-server/   — Python MCP server (later, for Opera migration)
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

Key principle: business logic lives in `packages/domain/` — pure functions, no Fastify or Drizzle dependency. Testable in isolation.

## Domain Model

### Property (hotel)
- id, name, code, address, timezone, currency

### RoomType (room category)
- id, propertyId, name, code, maxOccupancy, baseRate, description

### Room (physical room)
- id, propertyId, roomTypeId, roomNumber, floor
- status: `clean` | `dirty` | `inspected` | `out_of_order` | `occupied`

### Guest
- id, firstName, lastName, email, phone
- documentType, documentNumber, nationality
- notes, preferences

### RatePlan
- id, propertyId, code, name, description
- isActive, dateRange (validFrom/validTo)

### Booking (central entity)
- id, propertyId, guestId, roomId (nullable), roomTypeId, ratePlanId
- confirmationNumber
- checkIn, checkOut (dates)
- status: `confirmed` | `checked_in` | `checked_out` | `cancelled` | `no_show`
- adults, children
- specialRequests

## Key Flows

### Create Booking
1. Validate guest exists (or create new)
2. Check room type availability for dates
3. Calculate price via rate plan
4. Create Booking with status `confirmed`
5. Return confirmation number

### Check-in
1. Find booking, verify status = `confirmed`
2. Assign Room (auto or manual) if not assigned
3. Verify Room.status = `inspected` or `clean`
4. Booking.status -> `checked_in`, Room.status -> `occupied`

### Check-out
1. Booking.status -> `checked_out`
2. Room.status -> `dirty`

### Housekeeping
- `dirty` -> `clean` -> `inspected` (ready for check-in)
- Any -> `out_of_order` (and back)

### Availability Grid (Tape Chart)
- GET /api/availability?from=...&to=...
- Returns matrix: rooms x dates
- Each cell: free | occupied | reserved | out_of_order

## Implementation Phases

### Phase 0: Project skeleton
- Monorepo init (pnpm + Turborepo)
- Docker Compose with PostgreSQL
- Empty Fastify API with health check
- Empty Next.js with landing page
- Drizzle connected to PostgreSQL
- CI: lint + typecheck

### Phase 1: Property + Rooms
- DB schema: properties, room_types, rooms
- CRUD API for rooms
- Seed: 1 property, 5 room types, 50 rooms
- Frontend: room list with filters

### Phase 2: Guests
- DB schema: guests
- CRUD API + search by name/phone/email
- Frontend: guest search, guest card, create new

### Phase 3: Bookings (core)
- DB schema: bookings, rate_plans
- Domain: booking status state machine
- Domain: availability check
- API: create/list/get bookings
- Frontend: booking form, booking list

### Phase 4: Front Desk operations
- Room assignment
- Check-in / Check-out flows
- Housekeeping statuses
- Frontend: arrivals / departures / in-house dashboard

### Phase 5: Tape Chart (Room Grid)
- API: availability grid
- Frontend: visual room grid
- Drag-and-drop room moves

### Phase 6: Auth + Polish
- Authentication (login/logout)
- Roles: admin, front-desk, housekeeping
- Error handling, loading states

## Post-MVP priorities
1. Billing / Folios
2. Night Audit
3. Rate Management (seasons, restrictions)
4. MCP server for Opera migration

## Legacy Reference
Opera PMS V5.6 Data Dictionary available at `~/OPERA_Data_Dictionary_v5.614.0 (2).pdf`.
Key mapping: NAME -> Guest, RESERVATION_NAME -> Booking, ROOM -> Room, RESORT -> Property.
Clean-room implementation — we do NOT copy table structures.
