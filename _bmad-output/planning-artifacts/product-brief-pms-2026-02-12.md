---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - docs/opera-research-notes.md
  - docs/plans/2026-02-09-pms-mvp-design.md
  - docs/plans/2026-02-09-phase-0-skeleton.md
  - docs/plans/2026-02-11-opera-mcp-connector.md
  - docs/plans/2026-02-11-phase-1-rooms-refactor.md
  - docs/plans/2026-02-12-phase-2-guests.md
date: 2026-02-12
author: Oci
status: complete
---

# Product Brief: PMS

## Executive Summary

PMS is an open-source Property Management System designed to replace legacy Oracle Opera PMS V5 for independent hotels. The project focuses on delivering a modern, developer-friendly alternative that covers the two most critical operational modules: **Reservations** and **Front Desk** for a single hotel property.

The system is built on a modern TypeScript stack (Next.js 15, Fastify 5, Drizzle ORM, PostgreSQL) with clean-room architecture based on hospitality industry standards (HTNG, OTA) rather than copying any vendor's implementation. Real-world data patterns from a 167-room hotel with 135K historical bookings inform every design decision.

Phases 0-2 are complete: the monorepo skeleton, room management (2D status model), and guest profiles are operational. The project now enters its most critical phase: **Bookings** — the core entity that connects guests to rooms and drives all hotel operations.

---

## Core Vision

### Problem Statement

Independent hotels running Oracle Opera PMS V5 face a dead-end: the system is legacy, expensive to maintain, closed-source, and requires specialized Oracle DB expertise. There is no viable open-source alternative that covers the essential Reservations + Front Desk workflow with a modern tech stack. Hotel operators are locked into vendor contracts with no path to data ownership or customization.

### Problem Impact

- **Operational lock-in**: Hotels cannot customize workflows or integrate with modern tools without expensive vendor consulting
- **Cost burden**: Oracle licensing, specialized DBA support, and proprietary infrastructure drive ongoing costs
- **Data opacity**: Hotel data is trapped in a proprietary Oracle schema (1.6M financial transactions, 135K bookings, 61K guest profiles in one property alone), making analytics and migration difficult
- **Technical debt**: Opera V5 uses patterns from a different era — pseudo-rooms, complex multi-table address/phone structures, and initialization-dependent views that complicate every query

### Why Existing Solutions Fall Short

- **Opera PMS V5**: Legacy, expensive Oracle DB, closed-source, no modern API. Going end-of-life with forced migration to Opera Cloud
- **Opera Cloud**: SaaS-only, no self-hosting, ongoing subscription, limited customization for independents
- **Mews, Cloudbeds, Hotelogix**: Cloud PMS solutions that solve the UX problem but remain closed-source, SaaS-only, and offer no data portability or self-hosting option
- **Open-source alternatives**: Fragmented projects that cover either booking engines (for OTAs) or channel managers, but none provide a complete Front Desk + Reservations workflow suitable for daily hotel operations

### Proposed Solution

A complete open-source PMS covering the daily operational needs of a single hotel:

1. **Room Management** — 2D status model (housekeeping + occupancy), room types, floor mapping
2. **Guest Profiles** — Search, create, manage guest data with VIP levels and document tracking
3. **Reservations** — Create bookings, manage status lifecycle (confirmed → checked_in → checked_out), rate plans, availability checking
4. **Front Desk Operations** — Check-in/check-out flows, room assignment, arrivals/departures dashboard, housekeeping coordination
5. **Tape Chart** — Visual room grid showing availability across dates

Built with a clean separation: business logic in a pure domain package, database via Drizzle ORM, REST API via Fastify, and a Next.js frontend — all in a monorepo with full TypeScript safety.

### Key Differentiators

1. **Open-source and self-hosted**: Full data ownership, no vendor lock-in, deploy anywhere
2. **Clean-room design from real data**: Architecture informed by analysis of a real 167-room Opera installation (135K bookings, 61K guests) but implemented from industry standards, not vendor code
3. **Modern developer experience**: TypeScript end-to-end, monorepo, Drizzle ORM, hot reload — any web developer can contribute
4. **Migration-ready**: MCP server provides read-only bridge to Oracle Opera DB for data migration, proven on real hotel data
5. **Industry-standard 2D room status model**: Housekeeping status (clean/dirty/pickup/inspected/OOO/OOS) independent from occupancy status (vacant/occupied), matching how real hotels operate

---

## Target Users

### Primary Users

**Persona: Marina — Front Desk Manager**

Marina manages the front desk at a 150-room independent hotel. She works 8-hour shifts handling check-ins, check-outs, room assignments, and guest requests. Her current PMS (Opera V5) requires specialized training, runs slowly, and cannot be customized to her workflow. She spends extra time on workarounds: printing housekeeping reports manually, cross-referencing availability in separate spreadsheets, and calling IT for any configuration change.

- **Goals**: Fast check-in/check-out, instant room availability visibility, quick guest lookup, reliable booking creation
- **Pain points**: Slow legacy UI, inability to customize workflows, dependency on IT for changes, no modern search
- **Success moment**: Creating a booking, assigning a room, and checking in a guest — all within a single, fast workflow

**Persona: Dmitry — Hotel IT Administrator**

Dmitry maintains the hotel's Opera V5 installation. He manages the Oracle DB, applies patches, handles backup/restore, and troubleshoots issues that front desk staff escalate. He spends significant time on Oracle licensing compliance and infrastructure maintenance rather than improving hotel operations.

- **Goals**: Reduce Oracle dependency, modern stack he can maintain, easy deployment, data migration from Opera
- **Pain points**: Oracle expertise required, expensive licensing, no modern API for integrations, complex upgrade path
- **Success moment**: Self-hosting the new PMS on standard infrastructure, completing data migration from Opera, eliminating Oracle dependency

### Secondary Users

**Housekeeping Supervisor**: Needs to see room cleaning status, update housekeeping status (dirty → pickup → clean → inspected), coordinate with front desk on room readiness.

**Hotel General Manager**: Needs occupancy dashboards, booking statistics, revenue overview. Not a daily user of the PMS but depends on its data for decisions.

### User Journey

1. **Discovery**: Hotel IT finds the project through open-source PMS searches or Opera migration discussions
2. **Evaluation**: Deploy locally with Docker Compose, seed demo data, explore rooms/guests/bookings
3. **Migration**: Use MCP server to connect to existing Opera DB, migrate property/rooms/guests/bookings
4. **Daily use**: Front desk staff use the system for all reservation and check-in/check-out operations
5. **Value realization**: Reduced IT costs, faster operations, data ownership, ability to customize

---

## Success Metrics

### User Success Metrics

- **Booking creation speed**: Front desk can create a new booking (select guest, room type, dates, rate) in under 60 seconds
- **Check-in completion**: Full check-in flow (find booking → assign room → update status) completes in under 30 seconds
- **Guest lookup**: Search returns results within 1 second for any name/phone/email query across the guest database
- **Room status accuracy**: 2D status model correctly reflects real-time housekeeping and occupancy state with zero manual reconciliation

### Business Objectives

- **Operational replacement**: System handles 100% of daily front desk operations (reservations, check-in/out, housekeeping coordination) for a single property
- **Data migration**: Successfully migrate property, rooms, guests, and booking history from Oracle Opera V5 to PostgreSQL
- **Zero Oracle dependency**: Hotel operates entirely on open-source stack (PostgreSQL, Node.js) with no Oracle licensing costs
- **Developer adoption**: Project is documented and structured well enough that external contributors can add features

### Key Performance Indicators

| KPI | Target | Measurement |
|-----|--------|-------------|
| Core workflow coverage | 100% of check-in/check-out flow | Feature completion against Opera daily operations |
| API response time | < 200ms for all CRUD operations | Server-side latency monitoring |
| Data migration completeness | 100% of rooms, guests, active bookings | Record count validation post-migration |
| System uptime | 99.5% during hotel operating hours | Health check monitoring |
| Guest search performance | < 1s for 60K+ guest records | Query benchmark with production-scale data |

---

## MVP Scope

### Core Features

**Phase 3: Bookings (next)**
- DB schema: `rate_plans`, `bookings`, `booking_nights` tables
- Domain logic: booking status state machine (confirmed → checked_in → checked_out / cancelled / no_show)
- Domain logic: availability check (room type available for date range)
- API: create, list, get, update booking status
- API: availability query endpoint
- Confirmation number generation
- Seed: rate plans + sample bookings
- Frontend: booking creation form (guest + room type + dates + rate)
- Frontend: booking list with filters (status, date range)
- Frontend: booking detail page with status transitions

**Phase 4: Front Desk Operations**
- Room assignment flow (manual selection from available rooms)
- Check-in flow: find booking → assign room → transition to checked_in
- Check-out flow: transition to checked_out → room becomes dirty
- Housekeeping status updates
- Dashboard: today's arrivals, departures, in-house guests

**Phase 5: Tape Chart**
- Availability grid API (rooms x dates matrix)
- Visual room grid frontend
- Color-coded booking blocks on timeline

**Phase 6: Auth + Polish**
- Authentication (login/logout)
- Role-based access: admin, front-desk, housekeeping
- Error handling, loading states, edge cases

### Already Completed (Phases 0-2)

- Monorepo skeleton (pnpm + Turborepo)
- PostgreSQL with Drizzle ORM, migrations, seed
- Fastify API with CORS, health check, db decorator
- Properties, room types, rooms: schema + CRUD API + rooms list page
- 2D room status model (housekeeping + occupancy)
- Guests: schema with 12 fields + CRUD API with ILIKE search + search/detail/create pages
- MCP server for Oracle Opera read-only access
- 10 migrated guest profiles from real Opera data

### Out of Scope for MVP

- **Billing / Folios**: Financial transactions, invoicing, payment processing
- **Night Audit**: End-of-day reconciliation and reporting
- **Rate Management**: Seasonal pricing, restrictions, yield management, packages
- **Multi-property**: Single hotel only; multi-property adds significant complexity
- **Channel Manager**: OTA integrations (Booking.com, Expedia) — separate product concern
- **Group Bookings**: Block reservations, group management, allotments
- **CRM / Marketing**: Guest communication, loyalty programs, marketing campaigns
- **Housekeeping scheduling**: Task assignment, time tracking, performance metrics
- **Mobile app**: Web-only for MVP; responsive design covers tablet use at front desk
- **Reporting / Analytics**: Beyond basic dashboards; dedicated reporting is post-MVP

### MVP Success Criteria

- A front desk agent can perform the complete daily workflow: create booking → check-in guest → check-out guest
- Room availability is accurately tracked and prevents double-booking
- Guest search works fast across the full guest database
- Booking status transitions follow correct state machine rules
- Data can be migrated from a real Opera V5 installation using the MCP server bridge
- The system runs self-hosted on standard infrastructure (Docker Compose + PostgreSQL)

### Future Vision

**Post-MVP priorities (in order):**

1. **Billing / Folios** — Track charges, generate invoices, integrate with payment terminals
2. **Night Audit** — Automated end-of-day process: close day, reconcile, generate reports
3. **Rate Management** — Seasonal rates, length-of-stay pricing, restrictions, packages
4. **Reporting** — Occupancy reports, revenue analytics, forecast dashboards
5. **Multi-property** — Support hotel chains with centralized guest profiles and cross-property booking

**Long-term vision**: A complete, open-source hotel management platform that independent hotels and small chains can self-host, customize, and contribute to — providing a credible alternative to commercial PMS solutions while maintaining full data ownership and operational independence.
