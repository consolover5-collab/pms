# Story 6.2: RBAC Middleware & Route Protection

Status: done

## Story

As a system administrator,
I want role-based access control on all API endpoints,
So that users can only access features appropriate to their role.

## Acceptance Criteria

1. Any API endpoint except GET /health and POST /api/auth/login — without valid session → 401 { error: "Authentication required" }
2. Fastify preHandler hook registered globally: validates session cookie, sets request.user = { id, username, role }, skips whitelisted routes
3. User with role "housekeeping" → 403 on /api/bookings or /api/guests { error: "Insufficient permissions" }
4. User with role "front_desk" → 403 on POST /api/rate-plans (admin-only)
5. User with role "admin" → all endpoints allowed

## Tasks / Subtasks

- [x] Task 1: Create auth plugin with preHandler hook
  - [x] 1.1 Create apps/api/src/plugins/auth.ts — global preHandler
  - [x] 1.2 Extend FastifyRequest type with `user` property
  - [x] 1.3 Use fastify-plugin (fp) for global scope

- [x] Task 2: Implement role-based access
  - [x] 2.1 Public routes whitelist (GET /health, POST /api/auth/login)
  - [x] 2.2 Role access rules: admin=all, front_desk=deny admin mutations, housekeeping=rooms+auth only
  - [x] 2.3 Register plugin in app.ts AFTER cookie+db, BEFORE routes

- [x] Task 3: Verify all ACs via curl
  - [x] 3.1 Unauthenticated request → 401
  - [x] 3.2 Housekeeping → 403 on /api/bookings, /api/guests
  - [x] 3.3 Front desk → 403 on POST /api/rate-plans
  - [x] 3.4 Admin → all endpoints allowed
  - [x] 3.5 Public routes work without auth

## Dev Notes

- Pattern: Fastify global preHandler via fastify-plugin (same as dbPlugin)
- Session lookup: reuse same session table + cookie from Story 6.1
- Role rules defined as pure functions, not config objects — simpler for MVP
- hasAccess(): admin=all, front_desk denies rate-plan/room-type/property mutations + business-date/initialize, housekeeping allows only rooms+auth+health

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### File List
- apps/api/src/plugins/auth.ts (NEW)
- apps/api/src/app.ts (MODIFIED — import + register authPlugin)
