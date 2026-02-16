# Story 5.2: Tape Chart Page

Status: done

## Story

As a front desk agent,
I want a visual tape chart showing rooms x dates,
So that I can quickly see room availability and booking patterns.

## Acceptance Criteria

1. **Given** the /tape-chart page
   **When** it loads
   **Then** it displays a grid with rooms as rows and dates as columns (default: next 14 days from today)
   **And** date range can be adjusted with from/to date inputs

2. **Given** a booking occupying room 305 from March 1-3
   **When** the tape chart renders
   **Then** cells for room 305 on March 1 and March 2 are filled with a booking block
   **And** the block is color-coded by status: blue for confirmed, green for checked_in, gray for checked_out

3. **Given** a booking block on the tape chart
   **When** the agent clicks on it
   **Then** they are navigated to the booking detail page for that booking

4. **Given** an empty cell on the tape chart
   **When** it is displayed
   **Then** it shows as available (white/light background)

5. **Given** the navigation bar
   **When** any page loads
   **Then** "Tape Chart" link is visible in the nav

## Tasks / Subtasks

- [x] Task 1: Add Tape Chart to navigation (AC: #5)
  - [x] 1.1 Add { href: "/tape-chart", label: "Tape Chart", labelRu: "Шахматка" } to navItems in navbar.tsx

- [x] Task 2: Create tape-chart page (AC: #1, #2, #3, #4)
  - [x] 2.1 Create `apps/web/src/app/tape-chart/page.tsx` — Client Component with date range state
  - [x] 2.2 Fetch data from GET /api/tape-chart with propertyId, from, to
  - [x] 2.3 Render grid: rooms as rows (left column with roomNumber + typeCode), dates as column headers (day of week + date)
  - [x] 2.4 For each cell, check if a booking occupies that room+date — color-code by status (blue/green/gray)
  - [x] 2.5 Make booking blocks clickable (Link to /bookings/:id) with tooltip showing guest name + confirmation
  - [x] 2.6 Add from/to date inputs for range adjustment + legend

## Dev Notes

### Architecture Compliance

- **Page location**: `apps/web/src/app/tape-chart/page.tsx` — Next.js App Router
- **Component type**: Client Component ("use client") — heavy interactivity (date controls, grid rendering)
- **API calls**: Direct fetch() to /api/tape-chart (client component pattern)
- **Styling**: Tailwind CSS only — no external UI libraries

### Technical Requirements

- **Default date range**: from = today, to = today + 14 days
- **Grid rendering**: HTML table or CSS grid. Rooms as rows, dates as columns.
- **Booking cell mapping**: For each room row + date column, find booking where booking.roomId === room.id AND booking.checkInDate <= date AND booking.checkOutDate > date
- **Unassigned bookings**: Bookings with roomId=null can be shown in a separate section or ignored in the grid (they have no room assignment)
- **Color coding**: confirmed = blue (bg-blue-200), checked_in = green (bg-green-200), checked_out = gray (bg-gray-200)
- **Performance**: Keep rendering efficient — pre-compute a lookup map { roomId → { date → booking } } rather than O(rooms × dates × bookings)

### Navbar update

Add to navItems array in `apps/web/src/components/navbar.tsx`:
```typescript
{ href: "/tape-chart", label: "Tape Chart", labelRu: "Шахматка" },
```
Insert after "Rooms" entry.

### Existing Patterns (from bookings/page.tsx)

- Property discovery: fetch /api/properties, use properties[0].id
- apiFetch for server components, direct fetch() for client components
- Tailwind for all styling
- Link from next/link for navigation

### File Structure

| File | Action |
|------|--------|
| `apps/web/src/app/tape-chart/page.tsx` | **CREATE** — new page |
| `apps/web/src/components/navbar.tsx` | **MODIFY** — add nav item |

### References

- [Source: epics.md#Epic 5 — Story 5.2]
- [Source: prd.md#FR40, FR41, FR42]
- [Source: architecture.md#Frontend Architecture — tape-chart page]
- [Source: apps/web/src/app/bookings/page.tsx — frontend pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues.

### Completion Notes List

- Created /tape-chart page as Client Component with useState for date range
- Grid: rooms as rows (sticky left column with roomNumber + typeCode), dates as columns (day-of-week + short date)
- Pre-computed cellMap (roomId → date → booking) for O(1) cell lookup — no N+1
- Color coding: blue=confirmed, green=checked_in, gray=checked_out, white=available
- Booking cells are Links to /bookings/:id with title tooltip (guestName + confirmationNumber + status)
- First cell of each booking span shows guest last name
- Unassigned bookings shown in separate section below grid
- Legend shown above grid
- Date inputs for from/to range adjustment, default 14 days from today
- Added "Tape Chart" / "Шахматка" to navbar after "Rooms"

### File List

- `apps/web/src/app/tape-chart/page.tsx` — CREATED (new page)
- `apps/web/src/components/navbar.tsx` — MODIFIED (added nav item)
