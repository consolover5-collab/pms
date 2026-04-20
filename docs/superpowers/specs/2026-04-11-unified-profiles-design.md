# Unified Profiles — Design Spec

**Date:** 2026-04-11  
**Status:** Approved  
**Scope:** MVP

---

## Context

Currently the system has three separate tables: `guests`, `companies`, `travel_agents`. There is no shared search, no links between profiles, and no source tracking. Opera PMS treats all of these as profile "types" within a single unified concept.

This spec defines the migration to a unified `profiles` table that covers all profile types used in the system.

---

## Profile Types

| Type | Description | Replaces |
|---|---|---|
| `individual` | Guest staying at the property | `guests` table |
| `company` | Corporate account sponsoring reservations | `companies` table |
| `travel_agent` | Agency booking on behalf of guests | `travel_agents` table |
| `source` | Booking channel (OTA, direct, GDS, walk-in) | no table today |
| `contact` | Person linked to a company/agent | deferred post-MVP |

---

## Database Schema

### `profiles` table

One table with nullable columns for type-specific fields (Single Table Inheritance). Chosen over extension tables because each type has ≤5 unique fields — the JOIN overhead of extension tables is not justified at this scale.

```sql
profiles:
  id                  uuid PK
  property_id         uuid FK → properties
  type                enum('individual','company','travel_agent','source','contact') NOT NULL

  -- common fields (all types)
  name                text NOT NULL        -- full name / company name / agency name
  email               text
  phone               text
  notes               text
  is_active           boolean DEFAULT true
  created_at          timestamptz
  updated_at          timestamptz

  -- individual only
  first_name          text
  last_name           text
  date_of_birth       date
  nationality         varchar(2)           -- ISO 3166-1 alpha-2
  passport_number     text

  -- company only
  tax_id              text
  credit_limit        numeric(12,2)
  payment_term_days   integer

  -- travel_agent only
  iata_code           varchar(8)
  commission_percent  numeric(5,2)         -- UI hidden on MVP (separate module)

  -- source only
  source_code         varchar(20)          -- e.g. BOOKING, EXPEDIA, DIRECT, WALKIN
  channel_type        enum('direct','ota','gds','corporate','walkin','other')

  -- contact fields (used when type = contact, or as text on other types for MVP)
  contact_person      text                 -- MVP: free text inside company/agent profile
  contact_title       text
```

### `profile_relationships` table

Schema is created now; UI is deferred post-MVP. Enables future: guest ↔ company employer link, contact ↔ company link.

```sql
profile_relationships:
  id                  uuid PK
  from_profile_id     uuid FK → profiles
  to_profile_id       uuid FK → profiles
  relationship_type   varchar(50)          -- e.g. 'contact_of', 'employed_by'
  created_at          timestamptz
```

### `bookings` table changes

Four profile FK columns replace the current single `guest_id`:

```sql
-- add
guest_profile_id    uuid FK → profiles (type=individual)  NOT NULL
company_profile_id  uuid FK → profiles (type=company)     nullable
agent_profile_id    uuid FK → profiles (type=travel_agent) nullable
source_profile_id   uuid FK → profiles (type=source)      nullable

-- remove after migration
guest_id            uuid FK → guests  (dropped)
company_id          uuid FK → companies (dropped)
travel_agent_id     uuid FK → travel_agents (dropped)
```

---

## Booking Form

The booking create/edit form gains four profile selector fields. All use autocomplete search against `profiles`. Company, Agent, Source are optional.

```
┌─────────────────────────────────────────────────────────┐
│ Guest *          [Search or create individual...      ▾] │
│ Company          [Search company...                   ▾] │
│ Travel Agent     [Search travel agent...              ▾] │
│ Source           [Search source...                    ▾] │
├─────────────────────────────────────────────────────────┤
│ Check-in   Check-out   Room   Rate Plan   Adults   ...   │
└─────────────────────────────────────────────────────────┘
```

The four fields are independent — no conflict. They represent different dimensions:
- **Guest** — who is staying
- **Company** — whose corporate account applies (billing/rate)
- **Travel Agent** — who booked (commission tracking)
- **Source** — which channel (analytics)

---

## Profile Search API

Single endpoint covering all types:

```
GET /api/profiles?propertyId=&type=individual&q=john&limit=10
GET /api/profiles?propertyId=&type=company&q=ibm
GET /api/profiles?propertyId=&type=travel_agent&q=amex
GET /api/profiles?propertyId=&type=source&q=booking
```

Response: `{ data: Profile[], total: number }`

---

## Migration Strategy

One SQL migration file. No parallel existence — clean cut.

### Steps (in a single transaction where possible):

1. Create `profiles` table
2. Create `profile_relationships` table
3. `INSERT INTO profiles SELECT ... FROM guests` (type = 'individual')
4. `INSERT INTO profiles SELECT ... FROM companies` (type = 'company')
5. `INSERT INTO profiles SELECT ... FROM travel_agents` (type = 'travel_agent')
6. Add `guest_profile_id`, `company_profile_id`, `agent_profile_id`, `source_profile_id` to `bookings`
7. `UPDATE bookings SET guest_profile_id = (SELECT id FROM profiles WHERE ...)` — map old guest_id
8. `UPDATE bookings SET company_profile_id = ...` — map old company_id
9. `UPDATE bookings SET agent_profile_id = ...` — map old travel_agent_id
10. Drop old FK columns from `bookings`
11. Drop `guests`, `companies`, `travel_agents` tables

### Seed update

`packages/db/src/seed.ts` is updated to create profiles directly (no old tables).

---

## Pages & UI Components

### New / updated pages

| Path | Description |
|---|---|
| `/configuration/profiles` | List all profiles with type filter tab |
| `/configuration/profiles/new?type=individual` | Create profile by type |
| `/configuration/profiles/[id]` | View / edit profile |

### Replaced pages (deleted)

- `/configuration/guests` → merged into `/configuration/profiles`
- `/configuration/companies` → merged
- `/configuration/travel-agents` → merged

### Profile form

Single form component `ProfileForm` with conditional field sections based on `type`. Common fields always shown; type-specific sections conditionally rendered.

---

## API Endpoints

### Replace existing (old routes deleted):

| Old route (deleted) | New route |
|---|---|
| `GET /api/guests` | `GET /api/profiles?type=individual` |
| `POST /api/guests` | `POST /api/profiles` (body includes `type`) |
| `PUT /api/guests/:id` | `PUT /api/profiles/:id` |
| `GET /api/companies` | `GET /api/profiles?type=company` |
| `POST /api/companies` | `POST /api/profiles` |
| `PUT /api/companies/:id` | `PUT /api/profiles/:id` |
| `GET /api/travel-agents` | `GET /api/profiles?type=travel_agent` |
| `POST /api/travel-agents` | `POST /api/profiles` |
| `PUT /api/travel-agents/:id` | `PUT /api/profiles/:id` |

### New:

- `GET /api/profiles?type=source` — list sources
- `POST /api/profiles` with `type=source` — create source

---

## Out of Scope (MVP)

- Contacts as a profile type with UI (schema column reserved, no UI)
- `profile_relationships` UI (table created, no endpoints)
- Commission % calculation (field exists, UI hidden)
- Profile merge / deduplication
- Multi-property shared profiles
- Loyalty program membership fields
