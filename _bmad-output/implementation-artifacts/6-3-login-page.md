# Story 6.3: Login Page & Frontend Session Handling

Status: done

## Story

As a front desk agent,
I want a login page and session-aware navigation,
So that I can securely access the PMS.

## Acceptance Criteria

1. /login page with username + password form
2. Valid creds → POST /api/auth/login → redirect to /, nav shows username + role
3. Invalid creds → error message "Invalid username or password"
4. Any page without auth → redirect to /login
5. Logout button → POST /api/auth/logout → redirect to /login

## Tasks / Subtasks

- [x] Task 1: Create AuthProvider context
  - [x] 1.1 Create apps/web/src/components/auth-provider.tsx
  - [x] 1.2 On mount: check /api/auth/me, set user state
  - [x] 1.3 Redirect: no auth + not /login → redirect to /login; auth + /login → redirect to /

- [x] Task 2: Create login page
  - [x] 2.1 Create apps/web/src/app/login/page.tsx — form with username/password
  - [x] 2.2 Submit: POST /api/auth/login, handle success/error

- [x] Task 3: Update layout + navbar
  - [x] 3.1 Wrap layout children in AuthProvider + AppShell
  - [x] 3.2 Navbar: show username, role (translated), logout button
  - [x] 3.3 AppShell: hide Navbar on /login page

- [x] Task 4: Verify
  - [x] 4.1 TypeScript passes (both api and web)
  - [x] 4.2 Next.js build succeeds, /login page included

## Dev Notes

- AuthProvider: React context, checks /api/auth/me on mount, provides login/logout/user
- AppShell: shows Navbar only when not on /login page
- Role labels translated: admin=Админ, front_desk=Ресепшен, housekeeping=Горничная
- Cookie-based sessions — httpOnly cookie set by API, proxied via Next.js rewrite

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### File List
- apps/web/src/components/auth-provider.tsx (NEW)
- apps/web/src/components/app-shell.tsx (NEW)
- apps/web/src/app/login/page.tsx (NEW)
- apps/web/src/app/layout.tsx (MODIFIED — wrapped in AuthProvider + AppShell)
- apps/web/src/components/navbar.tsx (MODIFIED — user info + logout button)
