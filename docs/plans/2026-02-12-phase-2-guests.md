# Phase 2: Guests — Schema, CRUD API, Search, Frontend

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add missing guest fields (gender, language, dateOfBirth, vipStatus), build CRUD API with search by name/phone/email, and create guest search + guest card pages.

**Architecture:** Drizzle migration to extend guests table. Fastify REST endpoints with ILIKE search. Next.js server components for guest list and detail pages.

**Tech Stack:** Drizzle ORM, Fastify 5, Next.js 15, TypeScript

**Design rationale:** Every PMS needs guest profiles with: personal data (name, gender, DOB), contact info (phone, email), document info (passport/ID), language preference, and VIP level. Our flat `guests` table covers MVP needs — separate address/phone tables are unnecessary until multi-property or CRM features.

---

### Task 1: Extend guests schema — add missing fields

**Files:**
- Modify: `packages/db/src/schema/guests.ts`

**Step 1: Update guests schema**

Replace `packages/db/src/schema/guests.ts`:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  date,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const guests = pgTable("guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  documentType: varchar("document_type", { length: 50 }),
  documentNumber: varchar("document_number", { length: 100 }),
  nationality: varchar("nationality", { length: 100 }),
  gender: varchar("gender", { length: 1 }),
  language: varchar("language", { length: 10 }),
  dateOfBirth: date("date_of_birth"),
  vipStatus: integer("vip_status"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

New fields:
- `gender` — varchar(1): M, F, or null
- `language` — varchar(10): ru, en, de, etc.
- `dateOfBirth` — date, nullable
- `vipStatus` — integer 1-5, nullable (null = not VIP)

**Step 2: Generate and apply migration**

Run:
```bash
cd /home/oci/pms/packages/db && pnpm db:generate
cd /home/oci/pms/packages/db && pnpm db:migrate
```

**Step 3: Commit**

```bash
git add packages/db/src/schema/guests.ts packages/db/drizzle
git commit -m "feat: add gender, language, dateOfBirth, vipStatus to guests schema

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add guests to seed script

**Files:**
- Modify: `packages/db/src/seed.ts`

**Step 1: Add guest seed data after room inserts**

Add to `packages/db/src/seed.ts`, after the rooms insert and before `console.log("Seeded:...")`:

```typescript
  // Guests — fictional demo data
  const guestData = [
    { firstName: "Анна", lastName: "Петрова", email: "anna.p@example.com", phone: "+79211234567", nationality: "RU", gender: "F", language: "ru", dateOfBirth: "1985-03-15", vipStatus: null },
    { firstName: "Иван", lastName: "Сидоров", email: "ivan.s@example.com", phone: "+79219876543", nationality: "RU", gender: "M", language: "ru", dateOfBirth: "1978-07-22", vipStatus: 3 },
    { firstName: "John", lastName: "Smith", email: "j.smith@example.com", phone: "+441234567890", nationality: "GB", gender: "M", language: "en", dateOfBirth: "1990-11-30", vipStatus: null },
    { firstName: "Maria", lastName: "Garcia", email: "maria.g@example.com", phone: "+34612345678", nationality: "ES", gender: "F", language: "es", dateOfBirth: "1992-01-08", vipStatus: 2 },
    { firstName: "Дмитрий", lastName: "Козлов", email: null, phone: "+79031112233", nationality: "RU", gender: "M", language: "ru", dateOfBirth: null, vipStatus: null },
    { firstName: "Elena", lastName: "Mueller", email: "e.mueller@example.com", phone: "+4917612345678", nationality: "DE", gender: "F", language: "de", dateOfBirth: "1988-06-20", vipStatus: 1 },
    { firstName: "Олег", lastName: "Новиков", email: "oleg.n@example.com", phone: "+79165554433", nationality: "RU", gender: "M", language: "ru", dateOfBirth: "1975-12-01", vipStatus: 5 },
    { firstName: "Sophie", lastName: "Dubois", email: "sophie.d@example.com", phone: null, nationality: "FR", gender: "F", language: "fr", dateOfBirth: "1995-09-14", vipStatus: null },
    { firstName: "Алексей", lastName: "Волков", email: "a.volkov@example.com", phone: "+79261234567", nationality: "RU", gender: "M", language: "ru", dateOfBirth: "1982-04-25", vipStatus: null },
    { firstName: "Yuki", lastName: "Tanaka", email: "yuki.t@example.com", phone: "+81901234567", nationality: "JP", gender: "F", language: "en", dateOfBirth: "1993-08-11", vipStatus: null },
  ];

  await db.insert(guests).values(guestData);
```

Also update the imports at the top of seed.ts to include `guests`:

```typescript
import { properties, roomTypes, rooms, guests } from "./schema/index";
```

And update the clear section to also delete guests (add before deleting rooms):

```typescript
  await db.delete(guests);
```

Update the final console.log:

```typescript
  console.log(
    `Seeded: 1 property, ${types.length} room types, ${roomData.length} rooms, ${guestData.length} guests`,
  );
```

**Step 2: Run seed and verify**

```bash
cd /home/oci/pms/packages/db && pnpm db:seed
```
Expected: `Seeded: 1 property, 6 room types, 54 rooms, 10 guests`

**Step 3: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "feat: add guest seed data (10 fictional guests)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Guests CRUD API

**Files:**
- Create: `apps/api/src/routes/guests.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Create guests routes**

Create `apps/api/src/routes/guests.ts`:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { guests } from "@pms/db";
import { eq, or, ilike, sql } from "drizzle-orm";

export const guestsRoutes: FastifyPluginAsync = async (app) => {
  // Search guests by name, email, or phone
  app.get<{
    Querystring: { q?: string; limit?: string };
  }>("/api/guests", async (request) => {
    const { q, limit } = request.query;
    const maxResults = Math.min(Number(limit) || 50, 100);

    let query = app.db
      .select()
      .from(guests)
      .limit(maxResults)
      .orderBy(guests.lastName, guests.firstName);

    if (q && q.trim().length > 0) {
      const pattern = `%${q.trim()}%`;
      query = query.where(
        or(
          ilike(guests.firstName, pattern),
          ilike(guests.lastName, pattern),
          ilike(guests.email, pattern),
          ilike(guests.phone, pattern),
        ),
      ) as typeof query;
    }

    return query;
  });

  // Get single guest
  app.get<{ Params: { id: string } }>(
    "/api/guests/:id",
    async (request, reply) => {
      const [guest] = await app.db
        .select()
        .from(guests)
        .where(eq(guests.id, request.params.id));
      if (!guest) return reply.status(404).send({ error: "Not found" });
      return guest;
    },
  );

  // Create guest
  app.post<{
    Body: {
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      documentType?: string;
      documentNumber?: string;
      nationality?: string;
      gender?: string;
      language?: string;
      dateOfBirth?: string;
      vipStatus?: number;
      notes?: string;
    };
  }>("/api/guests", async (request, reply) => {
    const [guest] = await app.db
      .insert(guests)
      .values(request.body)
      .returning();
    return reply.status(201).send(guest);
  });

  // Update guest
  app.put<{
    Params: { id: string };
    Body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      documentType?: string;
      documentNumber?: string;
      nationality?: string;
      gender?: string;
      language?: string;
      dateOfBirth?: string;
      vipStatus?: number;
      notes?: string;
    };
  }>("/api/guests/:id", async (request, reply) => {
    const [updated] = await app.db
      .update(guests)
      .set({ ...request.body, updatedAt: new Date() })
      .where(eq(guests.id, request.params.id))
      .returning();
    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });
};
```

**Step 2: Register in app.ts**

Add import and registration to `apps/api/src/app.ts`:

```typescript
import { guestsRoutes } from "./routes/guests";
// ... in buildApp(), after roomsRoutes:
await app.register(guestsRoutes);
```

**Step 3: Verify typecheck**

```bash
cd /home/oci/pms/apps/api && pnpm typecheck
```

**Step 4: Commit**

```bash
git add apps/api/src/routes/guests.ts apps/api/src/app.ts
git commit -m "feat: add guests CRUD API with search

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — guest search page

**Files:**
- Create: `apps/web/src/app/guests/page.tsx`
- Create: `apps/web/src/app/guests/search-form.tsx`
- Modify: `apps/web/src/app/page.tsx`

**Step 1: Create search form (client component)**

Create `apps/web/src/app/guests/search-form.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/guests?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, email, or phone..."
        className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Search
      </button>
    </form>
  );
}
```

**Step 2: Create guests page (server component)**

Create `apps/web/src/app/guests/page.tsx`:

```tsx
import { apiFetch } from "@/lib/api";
import { SearchForm } from "./search-form";

type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  gender: string | null;
  vipStatus: number | null;
};

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const queryStr = q ? `?q=${encodeURIComponent(q)}` : "";
  const guests = await apiFetch<Guest[]>(`/api/guests${queryStr}`);

  const vipBadge = (level: number) => {
    const colors = [
      "",
      "bg-yellow-100 text-yellow-800",
      "bg-yellow-200 text-yellow-900",
      "bg-orange-100 text-orange-800",
      "bg-orange-200 text-orange-900",
      "bg-red-100 text-red-800",
    ];
    return colors[level] || "";
  };

  return (
    <main className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Guests</h1>
        <a
          href="/guests/new"
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          + New Guest
        </a>
      </div>

      <SearchForm />

      {q && (
        <p className="text-sm text-gray-500 mb-4">
          Results for &quot;{q}&quot;: {guests.length} found
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Nationality</th>
              <th className="p-2">VIP</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((guest) => (
              <tr key={guest.id} className="border-b hover:bg-gray-50">
                <td className="p-2">
                  <a
                    href={`/guests/${guest.id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {guest.lastName}, {guest.firstName}
                  </a>
                </td>
                <td className="p-2 text-gray-600">{guest.email || "\u2014"}</td>
                <td className="p-2 text-gray-600">{guest.phone || "\u2014"}</td>
                <td className="p-2">{guest.nationality || "\u2014"}</td>
                <td className="p-2">
                  {guest.vipStatus ? (
                    <span
                      className={`text-xs px-2 py-1 rounded ${vipBadge(guest.vipStatus)}`}
                    >
                      VIP {guest.vipStatus}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
            {guests.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  {q ? "No guests found" : "No guests yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

**Step 3: Update landing page — add guests link**

Update `apps/web/src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">PMS</h1>
      <p className="text-lg text-gray-600">
        Open Source Property Management System
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/rooms"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Rooms
        </a>
        <a
          href="/guests"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Guests
        </a>
      </div>
    </main>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat: add guest search page with results table

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — guest detail page

**Files:**
- Create: `apps/web/src/app/guests/[id]/page.tsx`

**Step 1: Create guest detail page**

Create `apps/web/src/app/guests/[id]/page.tsx`:

```tsx
import { apiFetch } from "@/lib/api";

type Guest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  nationality: string | null;
  gender: string | null;
  language: string | null;
  dateOfBirth: string | null;
  vipStatus: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 uppercase">{label}</dt>
      <dd className="text-sm">{value || "\u2014"}</dd>
    </div>
  );
}

export default async function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guest = await apiFetch<Guest>(`/api/guests/${id}`);

  const genderLabel: Record<string, string> = { M: "Male", F: "Female" };

  return (
    <main className="p-8 max-w-2xl">
      <a href="/guests" className="text-blue-600 hover:underline text-sm">
        &larr; Back to guests
      </a>

      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">
          {guest.firstName} {guest.lastName}
        </h1>
        {guest.vipStatus && (
          <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
            VIP {guest.vipStatus}
          </span>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <Field label="Email" value={guest.email} />
        <Field label="Phone" value={guest.phone} />
        <Field label="Nationality" value={guest.nationality} />
        <Field label="Gender" value={guest.gender ? (genderLabel[guest.gender] || guest.gender) : null} />
        <Field label="Language" value={guest.language} />
        <Field label="Date of Birth" value={guest.dateOfBirth} />
        <Field label="Document Type" value={guest.documentType} />
        <Field label="Document Number" value={guest.documentNumber} />
      </div>

      {guest.notes && (
        <div className="mt-6">
          <h2 className="text-xs text-gray-500 uppercase mb-1">Notes</h2>
          <p className="text-sm bg-gray-50 p-3 rounded">{guest.notes}</p>
        </div>
      )}

      <div className="mt-6 text-xs text-gray-400">
        Created: {new Date(guest.createdAt).toLocaleDateString()} | Updated: {new Date(guest.updatedAt).toLocaleDateString()}
      </div>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/guests
git commit -m "feat: add guest detail page

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — create guest page

**Files:**
- Create: `apps/web/src/app/guests/new/page.tsx`
- Create: `apps/web/src/app/guests/new/guest-form.tsx`

**Step 1: Create guest form (client component)**

Create `apps/web/src/app/guests/new/guest-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function GuestForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
    };

    // Optional fields — only include if non-empty
    for (const key of ["email", "phone", "nationality", "gender", "language", "dateOfBirth", "documentType", "documentNumber", "notes"]) {
      const val = form.get(key);
      if (val && String(val).trim()) body[key] = String(val).trim();
    }
    const vip = form.get("vipStatus");
    if (vip && String(vip).trim()) body.vipStatus = Number(vip);

    try {
      const res = await fetch(`${API_URL}/api/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const guest = await res.json();
      router.push(`/guests/${guest.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">First Name *</label>
          <input name="firstName" required className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Last Name *</label>
          <input name="lastName" required className="w-full px-3 py-2 border rounded" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email</label>
          <input name="email" type="email" className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Phone</label>
          <input name="phone" type="tel" className="w-full px-3 py-2 border rounded" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Gender</label>
          <select name="gender" className="w-full px-3 py-2 border rounded">
            <option value="">—</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nationality</label>
          <input name="nationality" maxLength={3} placeholder="RU" className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Language</label>
          <input name="language" maxLength={10} placeholder="ru" className="w-full px-3 py-2 border rounded" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date of Birth</label>
          <input name="dateOfBirth" type="date" className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">VIP Status</label>
          <select name="vipStatus" className="w-full px-3 py-2 border rounded">
            <option value="">None</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Document Type</label>
          <input name="documentType" placeholder="Passport" className="w-full px-3 py-2 border rounded" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Document Number</label>
          <input name="documentNumber" className="w-full px-3 py-2 border rounded" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea name="notes" rows={3} className="w-full px-3 py-2 border rounded" />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Create Guest"}
      </button>
    </form>
  );
}
```

**Step 2: Create page wrapper**

Create `apps/web/src/app/guests/new/page.tsx`:

```tsx
import { GuestForm } from "./guest-form";

export default function NewGuestPage() {
  return (
    <main className="p-8">
      <a href="/guests" className="text-blue-600 hover:underline text-sm">
        &larr; Back to guests
      </a>
      <h1 className="text-2xl font-bold mt-4 mb-6">New Guest</h1>
      <GuestForm />
    </main>
  );
}
```

**Step 3: Verify build**

```bash
cd /home/oci/pms/apps/web && pnpm build
```

**Step 4: Commit**

```bash
git add apps/web/src/app/guests
git commit -m "feat: add create guest form page

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

After completing all 6 tasks:
- Guests schema extended with gender, language, dateOfBirth, vipStatus
- Seed: 10 fictional guests with diverse nationalities
- API: search (ILIKE), get, create, update guests
- Frontend: guest search with results table, guest detail card, create guest form
- Landing page links to both Rooms and Guests
- Ready for Phase 3: Bookings
