# Story 6.1: Auth Backend — Users, Login, Sessions

Status: done

## Story

As a system administrator,
I want user authentication with session management,
So that the PMS is secured and only authorized users can access it.

## Acceptance Criteria

1. Users table: id (uuid PK), username (unique), passwordHash, role (admin/front_desk/housekeeping), propertyId (FK), isActive, timestamps
2. POST /api/auth/login — valid creds → session in DB + HTTP-only cookie + return { id, username, role }
3. POST /api/auth/login — invalid creds → 401 { error: "Invalid username or password" }
4. POST /api/auth/logout — destroy session + clear cookie
5. GET /api/auth/me — valid session → { id, username, role }; no session → 401
6. Seed: admin user (username: admin, password: admin123, bcrypt 10 rounds)

## Tasks / Subtasks

- [x] Task 1: Create users schema + sessions table
  - [x] 1.1 Create packages/db/src/schema/users.ts with users + sessions tables
  - [x] 1.2 Export from schema/index.ts
  - [x] 1.3 Run drizzle push --force

- [x] Task 2: Install dependencies
  - [x] 2.1 Add bcrypt + @types/bcrypt to packages/db and apps/api
  - [x] 2.2 Add @fastify/cookie to apps/api, approve bcrypt build

- [x] Task 3: Seed admin user
  - [x] 3.1 3 users seeded: admin, front (front_desk), hk (housekeeping)

- [x] Task 4: Create auth routes
  - [x] 4.1 Create apps/api/src/routes/auth.ts (login, logout, me)
  - [x] 4.2 Register in app.ts + @fastify/cookie + CORS credentials

- [x] Task 5: Verify
  - [x] 5.1 All 6 AC verified via curl

## Dev Notes

- Session approach: sessions table in PostgreSQL (id, userId, token uuid, expiresAt). Cookie = session token.
- @fastify/cookie for cookie management, bcrypt for password hashing.
- No external session middleware — manual lookup.

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Completion Notes List

### File List
