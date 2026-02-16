# PMS Defect Remediation Plan

**Date:** 2026-02-16
**Source:** Full code audit (DB + API + Frontend)
**Total findings:** ~152 (13 critical, 20 high, 32 medium, 84+ low)

---

## Phase A: Data Integrity & Security

> Without these fixes, the system cannot be used in production.

### A1. Race condition on check-in (CRITICAL)
- **Problem:** Two concurrent check-ins can assign same room to two guests
- **File:** `apps/api/src/routes/bookings.ts:350-368`
- **Fix:** Use `SELECT ... FOR UPDATE` on room row before check-in. Wrap check-in in DB transaction with row-level lock.

### A2. Night Audit idempotency (CRITICAL)
- **Problem:** Re-running night audit duplicates folio charges
- **File:** `apps/api/src/routes/night-audit.ts:171-182`
- **Fix:** Add idempotency check — verify no charges exist for this business date + booking before posting. Wrap entire audit in single DB transaction.

### A3. Night Audit room sync broken (CRITICAL)
- **Problem:** Occupied rooms without active booking never get released
- **File:** `apps/api/src/routes/night-audit.ts:264-298`
- **Fix:** After marking all occupied rooms dirty, compare room.occupancyStatus=occupied against bookings with status=checked_in. Rooms with no checked_in booking → set to vacant.

### A4. PATCH /rooms bypasses status validation (CRITICAL)
- **Problem:** POST validates housekeeping transitions, PATCH does not
- **Files:** `apps/api/src/routes/rooms.ts:150-171` vs `:90-148`
- **Fix:** Extract transition validation to `packages/domain/src/room-transitions.ts`. Use from both POST and PATCH.

### A5. guests.propertyId nullable (CRITICAL)
- **Problem:** All 10 seeded guests have propertyId = NULL
- **Files:** `packages/db/src/schema/guests.ts:14`, `packages/db/src/seed.ts:193`
- **Fix:** Add `.notNull()` to schema. Fix seed to pass `propertyId: property.id`. Migration for existing data.

### A6. Missing CHECK constraints (CRITICAL)
- **Problem:** No DB-level validation for dates, statuses, amounts
- **Files:** `packages/db/src/schema/bookings.ts`, `rooms.ts`, `financial.ts`
- **Fix:** Add constraints:
  - `checkInDate < checkOutDate`
  - `adults > 0`
  - Enum checks for housekeepingStatus, occupancyStatus, booking status, transactionType, businessDate status
  - `(debit = 0) OR (credit = 0)` on folio transactions (XOR)

### A7. Auth re-enable + user attribution (CRITICAL)
- **Problem:** Auth plugin commented out. All folio transactions posted by hardcoded "user:front_desk"
- **Files:** `apps/api/src/app.ts:27`, `apps/api/src/routes/folio.ts:158,230`
- **Fix:** Re-enable auth plugin. Replace hardcoded postedBy with `request.user.id`. Add auth bypass for development mode only.

### A8. Confirmation number generation (CRITICAL)
- **Problem:** NaN fallback uses Date.now() — duplicates on concurrent requests
- **File:** `apps/api/src/routes/bookings.ts:181-182`
- **Fix:** Use sequential counter or UUID-based confirmation number. Store last number in DB per property.

### A9. Missing FK constraints (HIGH)
- **Problem:** adjustmentCodeId, parentTransactionId — no FK constraints
- **File:** `packages/db/src/schema/financial.ts:58,91`
- **Fix:** Add `.references(() => ...)` for both columns.

### A10. Cascade policies on all FKs (HIGH)
- **Problem:** Default RESTRICT on all FKs — deleting property leaves orphans
- **Files:** All schema files
- **Fix:** Define explicit cascade: property deletion → cascade rooms, roomTypes, bookings. Booking deletion → cascade folioTransactions.

### A11. Add indexes on FK columns (HIGH)
- **Problem:** No indexes on foreign keys — full table scans
- **Files:** All schema files
- **Fix:** Add indexes on: bookings.guestId, bookings.propertyId, bookings.roomId, folioTransactions.bookingId, folioTransactions.businessDateId, rooms.propertyId, rooms.roomTypeId. Add composite indexes for common queries.

### A12. Business date format validation (HIGH)
- **Problem:** Initialize endpoint accepts any string as date
- **File:** `apps/api/src/routes/business-date.ts:46-80`
- **Fix:** Validate YYYY-MM-DD format with regex. Validate date is logical (not year 3000).

### A13. Fix seed data (HIGH)
- **Problem:** guests without propertyId, invalid booking dates, string amounts
- **File:** `packages/db/src/seed.ts`
- **Fix:** Add propertyId to all guests. Fix no_show booking dates. Use proper numeric values for amounts.

---

## Phase B: UX & Navigation Fixes

> Critical for usability. Users will hit these immediately.

### B1. router.push() → router.replace() in edit forms (HIGH)
- **Problem:** After save, edit page stays in browser history — back button loops
- **Files:** `guest-edit-form.tsx:88`, `booking-edit-form.tsx:252`, `room-type-form.tsx:63`, `rate-plan-form.tsx:62`
- **Fix:** Change all `router.push()` to `router.replace()` after successful save.

### B2. Separate Post Charge / Accept Payment buttons (HIGH)
- **Problem:** One button "Post Charge" handles both charges and payments — confusing
- **File:** `apps/web/src/app/bookings/[id]/folio-section.tsx`
- **Fix:** Two buttons with filtered transaction code dropdowns. "Post Charge" shows only charge codes. "Accept Payment" shows only payment codes.

### B3. Error boundaries on SSR pages (HIGH)
- **Problem:** API failure → blank page, no error message
- **Files:** `rooms/page.tsx`, `guests/page.tsx`, `bookings/page.tsx`, dashboard
- **Fix:** Add try-catch in server components with user-friendly error display. Use Next.js `error.tsx` boundaries.

### B4. Complete Help system (MEDIUM)
- **Problem:** 5 of 7 topics show "under development". Missing: payments, financial, night audit, tape chart
- **Files:** `docs/help/`, `apps/web/src/app/help/[topic]/page.tsx`
- **Fix:** Write help content for all topics. Add missing topics (payments, financial). Add context-sensitive "?" links on pages.

### B5. Transaction Codes configuration UI (MEDIUM)
- **Problem:** No UI to view/manage transaction codes used in folio
- **Files:** New pages in `apps/web/src/app/configuration/transaction-codes/`
- **Fix:** Add list + create + edit pages. Add link from Configuration hub. At minimum: read-only list with descriptions.

### B6. Room detail shows current guest (MEDIUM)
- **Problem:** Occupied room doesn't show who's in it
- **File:** `apps/web/src/app/rooms/[id]/page.tsx`
- **Fix:** Query active booking for this room. Show guest name + confirmation number + checkout date.

### B7. Booking search by name/confirmation (MEDIUM)
- **Problem:** Can't search bookings, only filter by status/date
- **File:** `apps/web/src/app/bookings/page.tsx`
- **Fix:** Add search input. API already supports filtering — add query param for guest name / confirmation number search.

### B8. PUT booking validation gaps (HIGH)
- **Problem:** Doesn't validate room type match when changing room, reinstate doesn't re-validate
- **Files:** `apps/api/src/routes/bookings.ts:234-259`, `:523-630`
- **Fix:** Validate room.roomTypeId matches booking.roomTypeId on assignment. Re-validate room state on reinstate.

### B9. Missing guest/booking existence validation in API (MEDIUM)
- **Problem:** POST booking with invalid guestId → 500 instead of 400
- **File:** `apps/api/src/routes/bookings.ts:198`
- **Fix:** Verify guest exists before insert. Return 404 with clear message.

### B10. BackButton component fix (MEDIUM)
- **Problem:** fallbackHref ignored, no real fallback
- **File:** `apps/web/src/components/back-button.tsx`
- **Fix:** With B1 (router.replace), back button loops are resolved. Keep fallbackHref for direct-link scenarios.

---

## Phase C: Polish & Performance

> Nice-to-have for launch. Can be deferred.

### C1. Add pagination to lists
- **Files:** guests/page.tsx, bookings/page.tsx
- **Fix:** API: add `?limit=50&offset=0`. Frontend: add page controls.

### C2. Optimistic folio updates
- **File:** folio-section.tsx
- **Fix:** Add transaction to local state immediately. Roll back on error.

### C3. Dashboard/folio performance
- **Files:** dashboard.ts:186, folio.ts:60
- **Fix:** Use SQL COUNT/SUM instead of loading all records. Cache folio balance.

### C4. Role-based UI visibility
- **Files:** navbar.tsx, configuration pages
- **Fix:** Check user.role. Hide config for non-admins. Hide night audit for housekeeping.

### C5. Consistent currency formatting
- **Files:** Multiple
- **Fix:** Create shared `formatCurrency()` utility. Use everywhere.

### C6. Missing DELETE endpoints
- **Files:** rooms.ts, guests.ts, properties.ts
- **Fix:** Add DELETE with dependency checks (can't delete room with active booking).

### C7. Accessibility improvements
- **Files:** rooms/page.tsx, booking-actions.tsx
- **Fix:** Add aria-labels to color indicators. Replace `confirm()`/`alert()` with proper modals.

### C8. Night Audit preview detail
- **File:** night-audit/page.tsx
- **Fix:** Show per-room breakdown before committing. Add export/print.

### C9. Guest search debounce
- **File:** guests/search-form.tsx
- **Fix:** Add 300ms debounce on search input.

### C10. Date handling consistency
- **Files:** Multiple API routes
- **Fix:** Centralize date comparison utilities. Avoid string comparison for dates.

---

## Execution Order

```
Phase A (Data Integrity)  →  Phase B (UX)  →  Phase C (Polish)
   ~13 fixes                   ~10 fixes        ~10 fixes
   Schema + API                Frontend + API   Performance + UX
```

Each fix includes:
1. Failing test first (build test suite from scratch)
2. Implementation
3. Verify lint + build + tests pass

---

## Test Infrastructure (prerequisite)

Before Phase A, set up:
- `vitest` in API package
- Test helpers: DB setup/teardown, API client
- First test: health endpoint
