# Story 4.2: Dashboard Page

Status: done

## Story

As a front desk agent,
I want a dashboard page showing today's operations,
So that I can see arrivals, departures, and room status at a glance during my shift.

## Acceptance Criteria

1. **Given** the dashboard page **When** it loads **Then** it displays current business date prominently at the top **And** it displays four sections: Arrivals, Departures, In-House, Room Summary

2. **Given** the Arrivals section **When** today has expected arrivals **Then** it shows a list of bookings with guest name, room type, confirmation number **And** clicking a booking navigates to booking detail page

3. **Given** the Departures section **When** today has expected departures **Then** it shows a list of bookings with guest name, room number, confirmation number **And** clicking a booking navigates to booking detail page

4. **Given** the In-House section **When** there are checked-in bookings **Then** it shows total count and a scrollable list of in-house guests

5. **Given** the Room Summary section **When** it loads **Then** it shows occupancy stats as cards: Occupied, Vacant, OOO, Dirty

## Tasks / Subtasks

- [x] Task 1: Refactor `apps/web/src/app/page.tsx` to use dashboard API endpoints (AC: #1-#5)
  - [x] 1.1: Replace generic bookings/rooms fetch with `/api/dashboard/arrivals`, `/departures`, `/in-house`, `/summary`
  - [x] 1.2: Display business date prominently at the top
  - [x] 1.3: Arrivals section with guest name, room type, confirmation number, links to detail
  - [x] 1.4: Departures section with guest name, room number, confirmation number, links to detail
  - [x] 1.5: In-House section with total count and scrollable list
  - [x] 1.6: Room Summary as stat cards (Occupied, Vacant, OOO/OOS, Dirty, Clean, Inspected)

## Dev Notes

### Architecture Compliance

- **Existing page**: `apps/web/src/app/page.tsx` is already the dashboard (navbar: "/" = "Dashboard")
- **Refactor, not new file**: Replace generic API calls with dedicated dashboard endpoints from Story 4.1
- **Server Component**: Keep as Server Component with `apiFetch()` — no client interactivity needed
- **Pattern**: Same as existing — `Promise.all` for parallel fetches, cards/grids layout

### API Endpoints (from Story 4.1)

- `GET /api/dashboard/arrivals?propertyId=X` — confirmed bookings with checkInDate = today
- `GET /api/dashboard/departures?propertyId=X` — checked_in bookings with checkOutDate = today
- `GET /api/dashboard/in-house?propertyId=X` — all checked_in bookings, sorted by checkOutDate
- `GET /api/dashboard/summary?propertyId=X` — room counts + booking counts + currentBusinessDate

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4, Story 4.2]
- [Source: _bmad-output/implementation-artifacts/4-1-dashboard-api.md — API endpoints]
- [Source: apps/web/src/app/page.tsx — current dashboard to refactor]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- Refactored `page.tsx` from generic bookings/rooms API to dedicated dashboard endpoints
- 4 parallel `apiFetch` calls via `Promise.all` (arrivals, departures, in-house, summary)
- Business date displayed prominently from `summary.currentBusinessDate` with Russian locale formatting
- Room Summary: 6 stat cards (Occupied w/ percentage, Vacant, OOO/OOS conditional, Dirty, Clean, Inspected) — clickable HK cards link to filtered rooms view
- Arrivals: guest name + confirmation + room type code + pre-assigned room arrow; max 8 shown, "View all" link
- Departures: guest name + confirmation + room number; max 8 shown
- In-House: scrollable list (max-h-64) with guest name, room, checkout date in Russian locale
- All booking rows link to `/bookings/:id` detail page
- Removed redundant Quick Actions section (duplicated navbar)
- TypeScript passes, no new dependencies

### Change Log

- 2026-02-15: Refactored dashboard to use dedicated API endpoints (Story 4.1)
- 2026-02-15: Code review passed — 0 HIGH, 0 MEDIUM, 1 LOW (pickupRooms not in cards, AC doesn't require)

### File List

- `apps/web/src/app/page.tsx` (MODIFIED — refactored to use dashboard API)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 | **Date:** 2026-02-15

### Findings (1 total: 0 HIGH, 0 MEDIUM, 1 LOW)

| # | Sev | Issue | Status |
|---|-----|-------|--------|
| L1 | LOW | `pickupRooms` from summary API not displayed in cards (AC doesn't list it) | ACCEPTED |

**Verdict:** All ACs implemented. Clean refactor, proper use of new dashboard API.
**Status:** APPROVED → done
