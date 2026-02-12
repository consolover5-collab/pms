# Phase 1: Schema Refactor + Properties & Rooms CRUD

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the room status model (1D → 2D, industry standard), add missing property fields, build CRUD API for properties/room types/rooms, seed realistic data, and create a basic rooms list page.

**Architecture:** Drizzle schema migration to fix the status model. Fastify REST endpoints with Zod validation. Database instance injected via Fastify decorator. Next.js frontend fetches from API.

**Tech Stack:** Drizzle ORM, Fastify 5, Zod, Next.js 15, TypeScript

**Design rationale — 2D room status (industry standard):**
Every modern PMS (Mews, Cloudbeds, Hotelogix, HTNG spec) separates room state into two independent dimensions:
- **Housekeeping condition:** clean, dirty, pickup (being cleaned), inspected, out_of_order, out_of_service
- **Occupancy:** vacant, occupied

A room can be `dirty + occupied` (guest still in room) or `clean + vacant` (ready for check-in). Our Phase 0 mixed these into a single field — this needs fixing before we build any front desk logic.

**Clean-room notice:** Our schema is designed from hospitality industry standards (HTNG, OTA), not copied from any specific vendor. All type codes, naming, and structure are our own.

---

### Task 1: Fix shared types — 2D room status model

**Files:**
- Modify: `packages/shared/src/types/booking.ts`

**Step 1: Update the room status types**

Replace the single `ROOM_STATUSES` with two separate enums in `packages/shared/src/types/booking.ts`:

```typescript
export const BOOKING_STATUSES = [
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const HOUSEKEEPING_STATUSES = [
  "clean",
  "dirty",
  "pickup",
  "inspected",
  "out_of_order",
  "out_of_service",
] as const;

export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number];

export const OCCUPANCY_STATUSES = [
  "vacant",
  "occupied",
] as const;

export type OccupancyStatus = (typeof OCCUPANCY_STATUSES)[number];
```

**Step 2: Commit**

```bash
git add packages/shared/src/types/booking.ts
git commit -m "refactor: split room status into housekeeping + occupancy (industry-standard 2D model)"
```

---

### Task 2: Fix DB schema — rooms table + add property fields

**Files:**
- Modify: `packages/db/src/schema/rooms.ts`
- Modify: `packages/db/src/schema/properties.ts`

**Step 1: Update rooms schema — replace single status with 2D model**

Replace `packages/db/src/schema/rooms.ts`:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const roomTypes = pgTable("room_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 10 }).notNull(),
  maxOccupancy: integer("max_occupancy").notNull().default(2),
  baseRate: numeric("base_rate", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  roomTypeId: uuid("room_type_id")
    .notNull()
    .references(() => roomTypes.id),
  roomNumber: varchar("room_number", { length: 10 }).notNull(),
  floor: integer("floor"),
  housekeepingStatus: varchar("housekeeping_status", { length: 20 })
    .notNull()
    .default("clean"),
  occupancyStatus: varchar("occupancy_status", { length: 20 })
    .notNull()
    .default("vacant"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

Changes from Phase 0:
- `rooms.status` → split into `housekeepingStatus` + `occupancyStatus`
- `rooms.floor` → nullable (some properties don't track floor)
- `roomTypes.sortOrder` added (for display ordering)

**Step 2: Update properties schema — add check-in/check-out times**

Replace `packages/db/src/schema/properties.ts`:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  time,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  timezone: varchar("timezone", { length: 50 }).notNull().default("UTC"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  checkInTime: time("check_in_time").notNull().default("14:00"),
  checkOutTime: time("check_out_time").notNull().default("12:00"),
  numberOfRooms: integer("number_of_rooms"),
  numberOfFloors: integer("number_of_floors"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

Changes from Phase 0:
- Added `checkInTime` / `checkOutTime` — standard property configuration in any PMS
- Added `numberOfRooms` / `numberOfFloors` — useful for dashboard stats

**Step 3: Generate migration and apply**

Run:
```bash
cd /home/oci/pms/packages/db && pnpm db:generate
```
Expected: New migration file in `drizzle/` folder.

Run:
```bash
cd /home/oci/pms/packages/db && pnpm db:migrate
```
Expected: Migration applied successfully.

**Step 4: Commit**

```bash
git add packages/db/src/schema packages/db/drizzle
git commit -m "refactor: 2D room status model, add property check-in/out times"
```

---

### Task 3: Update domain — room status state machine

**Files:**
- Modify: `packages/domain/src/booking/state-machine.ts`

**Step 1: Add housekeeping status transitions**

Replace `packages/domain/src/booking/state-machine.ts` entirely:

```typescript
import type { BookingStatus, HousekeepingStatus } from "@pms/shared";

// --- Booking status transitions ---

const VALID_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["checked_out"],
  checked_out: [],
  cancelled: [],
  no_show: [],
};

export function canTransitionBooking(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return VALID_BOOKING_TRANSITIONS[from].includes(to);
}

export function assertBookingTransition(
  from: BookingStatus,
  to: BookingStatus,
): void {
  if (!canTransitionBooking(from, to)) {
    throw new Error(
      `Invalid booking status transition: ${from} -> ${to}`,
    );
  }
}

// --- Housekeeping status transitions ---

const VALID_HK_TRANSITIONS: Record<HousekeepingStatus, HousekeepingStatus[]> = {
  dirty: ["pickup", "clean", "out_of_order", "out_of_service"],
  pickup: ["clean", "dirty"],
  clean: ["inspected", "dirty", "out_of_order", "out_of_service"],
  inspected: ["dirty", "out_of_order", "out_of_service"],
  out_of_order: ["dirty"],
  out_of_service: ["dirty"],
};

export function canTransitionHousekeeping(
  from: HousekeepingStatus,
  to: HousekeepingStatus,
): boolean {
  return VALID_HK_TRANSITIONS[from].includes(to);
}

export function assertHousekeepingTransition(
  from: HousekeepingStatus,
  to: HousekeepingStatus,
): void {
  if (!canTransitionHousekeeping(from, to)) {
    throw new Error(
      `Invalid housekeeping status transition: ${from} -> ${to}`,
    );
  }
}
```

**Step 2: Commit**

```bash
git add packages/domain
git commit -m "refactor: rename state machine exports, add housekeeping transitions"
```

---

### Task 4: Wire database into Fastify

**Files:**
- Create: `apps/api/src/db.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Create db plugin**

Create `apps/api/src/db.ts`:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { createDb, type Database } from "@pms/db";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

export const dbPlugin: FastifyPluginAsync = async (app) => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const db = createDb(url);
  app.decorate("db", db);
};
```

**Step 2: Register db plugin in app.ts**

Update `apps/api/src/app.ts`:

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { dbPlugin } from "./db";
import { healthRoutes } from "./routes/health";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(dbPlugin);
  await app.register(healthRoutes);

  return app;
}
```

**Step 3: Verify — start API and check health endpoint**

Run:
```bash
cd /home/oci/pms/apps/api && pnpm dev
```
In another terminal:
```bash
curl http://localhost:3001/health
```
Expected: `{"status":"ok","timestamp":"..."}` — still works with DB connected.

**Step 4: Commit**

```bash
git add apps/api/src/db.ts apps/api/src/app.ts
git commit -m "feat: wire database into Fastify via decorator plugin"
```

---

### Task 5: Seed script — property, room types, rooms

**Files:**
- Create: `packages/db/src/seed.ts`

**Step 1: Create seed script**

Create `packages/db/src/seed.ts`:

```typescript
import "dotenv/config";
import { createDb } from "./connection";
import { properties, roomTypes, rooms } from "./schema/index";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL required");

const db = createDb(DATABASE_URL);

async function seed() {
  console.log("Seeding database...");

  // Clear existing data (reverse FK order)
  await db.delete(rooms);
  await db.delete(roomTypes);
  await db.delete(properties);

  // Fictional demo property
  const [property] = await db
    .insert(properties)
    .values({
      name: "Grand Baltic Hotel",
      code: "GBH",
      address: "Озёрный проезд, 2",
      city: "Калининград",
      country: "RU",
      timezone: "Europe/Kaliningrad",
      currency: "RUB",
      checkInTime: "14:00",
      checkOutTime: "12:00",
      numberOfRooms: 50,
      numberOfFloors: 7,
    })
    .returning();

  // Room types — our own codes, standard hotel categories
  const types = await db
    .insert(roomTypes)
    .values([
      {
        propertyId: property.id,
        name: "Standard Double",
        code: "STD",
        maxOccupancy: 2,
        baseRate: "4500.00",
        description: "Standard room with double bed",
        sortOrder: 1,
      },
      {
        propertyId: property.id,
        name: "Standard Twin",
        code: "STD_TWN",
        maxOccupancy: 2,
        baseRate: "4500.00",
        description: "Standard room with two single beds",
        sortOrder: 2,
      },
      {
        propertyId: property.id,
        name: "Superior",
        code: "SUP",
        maxOccupancy: 2,
        baseRate: "5500.00",
        description: "Superior room with city view",
        sortOrder: 3,
      },
      {
        propertyId: property.id,
        name: "Premium",
        code: "PRM",
        maxOccupancy: 2,
        baseRate: "6500.00",
        description: "Premium room with upgraded amenities",
        sortOrder: 4,
      },
      {
        propertyId: property.id,
        name: "Junior Suite",
        code: "JRS",
        maxOccupancy: 3,
        baseRate: "8500.00",
        description: "Junior suite with separate living area",
        sortOrder: 5,
      },
      {
        propertyId: property.id,
        name: "Suite",
        code: "STE",
        maxOccupancy: 4,
        baseRate: "12000.00",
        description: "Full suite with living room and bedroom",
        sortOrder: 6,
      },
    ])
    .returning();

  // Create a map for easy lookup
  const typeMap = Object.fromEntries(types.map((t) => [t.code, t.id]));

  // 50 rooms across floors 2-7
  const roomData: { roomNumber: string; floor: number; typeCode: string }[] = [];

  // Floor 2: rooms 201-214 (mix of STD and STD_TWN)
  for (let i = 201; i <= 214; i++) {
    roomData.push({
      roomNumber: String(i),
      floor: 2,
      typeCode: i % 3 === 0 ? "STD_TWN" : "STD",
    });
  }
  // Floors 3-5: rooms 301-510 (SUP and STD)
  for (let floor = 3; floor <= 5; floor++) {
    for (let i = 1; i <= 10; i++) {
      const num = floor * 100 + i;
      roomData.push({
        roomNumber: String(num),
        floor,
        typeCode: i % 2 === 0 ? "SUP" : "STD",
      });
    }
  }
  // Floor 6: Premium rooms
  for (let i = 601; i <= 606; i++) {
    roomData.push({ roomNumber: String(i), floor: 6, typeCode: "PRM" });
  }
  // Floor 7: Suites
  roomData.push({ roomNumber: "701", floor: 7, typeCode: "JRS" });
  roomData.push({ roomNumber: "702", floor: 7, typeCode: "JRS" });
  roomData.push({ roomNumber: "703", floor: 7, typeCode: "STE" });
  roomData.push({ roomNumber: "704", floor: 7, typeCode: "STE" });

  await db.insert(rooms).values(
    roomData.map((r) => ({
      propertyId: property.id,
      roomTypeId: typeMap[r.typeCode],
      roomNumber: r.roomNumber,
      floor: r.floor,
      housekeepingStatus: "clean",
      occupancyStatus: "vacant",
    })),
  );

  console.log(
    `Seeded: 1 property, ${types.length} room types, ${roomData.length} rooms`,
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
```

**Step 2: Verify seed works**

Run:
```bash
cd /home/oci/pms/packages/db && pnpm db:seed
```
Expected: `Seeded: 1 property, 6 room types, 50 rooms`

**Step 3: Commit**

```bash
git add packages/db/src/seed.ts
git commit -m "feat: add seed script with demo hotel data"
```

---

### Task 6: CRUD API — properties

**Files:**
- Create: `apps/api/src/routes/properties.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Create properties routes**

Create `apps/api/src/routes/properties.ts`:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { properties } from "@pms/db";
import { eq } from "drizzle-orm";

export const propertiesRoutes: FastifyPluginAsync = async (app) => {
  // List all properties
  app.get("/api/properties", async () => {
    return app.db.select().from(properties);
  });

  // Get single property
  app.get<{ Params: { id: string } }>(
    "/api/properties/:id",
    async (request, reply) => {
      const [property] = await app.db
        .select()
        .from(properties)
        .where(eq(properties.id, request.params.id));
      if (!property) return reply.status(404).send({ error: "Not found" });
      return property;
    },
  );
};
```

**Step 2: Register in app.ts**

Add to `apps/api/src/app.ts`:

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { dbPlugin } from "./db";
import { healthRoutes } from "./routes/health";
import { propertiesRoutes } from "./routes/properties";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(dbPlugin);
  await app.register(healthRoutes);
  await app.register(propertiesRoutes);

  return app;
}
```

**Step 3: Verify**

Run API and test:
```bash
curl http://localhost:3001/api/properties | jq
```
Expected: Array with 1 property (from seed).

**Step 4: Commit**

```bash
git add apps/api/src/routes/properties.ts apps/api/src/app.ts
git commit -m "feat: add properties list/get API endpoints"
```

---

### Task 7: CRUD API — room types

**Files:**
- Create: `apps/api/src/routes/room-types.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Create room types routes**

Create `apps/api/src/routes/room-types.ts`:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { roomTypes } from "@pms/db";
import { eq } from "drizzle-orm";

export const roomTypesRoutes: FastifyPluginAsync = async (app) => {
  // List room types for a property
  app.get<{ Querystring: { propertyId: string } }>(
    "/api/room-types",
    async (request) => {
      const { propertyId } = request.query;
      return app.db
        .select()
        .from(roomTypes)
        .where(eq(roomTypes.propertyId, propertyId))
        .orderBy(roomTypes.sortOrder);
    },
  );
};
```

**Step 2: Register in app.ts**

Add import and registration:

```typescript
import { roomTypesRoutes } from "./routes/room-types";
// ... in buildApp:
await app.register(roomTypesRoutes);
```

**Step 3: Verify**

```bash
curl "http://localhost:3001/api/room-types?propertyId=<PROPERTY_UUID>" | jq
```
Expected: Array of 6 room types sorted by sortOrder.

**Step 4: Commit**

```bash
git add apps/api/src/routes/room-types.ts apps/api/src/app.ts
git commit -m "feat: add room types list API endpoint"
```

---

### Task 8: CRUD API — rooms

**Files:**
- Create: `apps/api/src/routes/rooms.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Create rooms routes**

Create `apps/api/src/routes/rooms.ts`:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { rooms, roomTypes } from "@pms/db";
import { eq } from "drizzle-orm";

export const roomsRoutes: FastifyPluginAsync = async (app) => {
  // List rooms for a property (with room type info)
  app.get<{
    Querystring: { propertyId: string };
  }>("/api/rooms", async (request) => {
    const { propertyId } = request.query;

    const result = await app.db
      .select({
        id: rooms.id,
        roomNumber: rooms.roomNumber,
        floor: rooms.floor,
        housekeepingStatus: rooms.housekeepingStatus,
        occupancyStatus: rooms.occupancyStatus,
        roomType: {
          id: roomTypes.id,
          name: roomTypes.name,
          code: roomTypes.code,
        },
      })
      .from(rooms)
      .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(rooms.propertyId, propertyId))
      .orderBy(rooms.roomNumber);

    return result;
  });

  // Get single room
  app.get<{ Params: { id: string } }>(
    "/api/rooms/:id",
    async (request, reply) => {
      const [room] = await app.db
        .select()
        .from(rooms)
        .where(eq(rooms.id, request.params.id));
      if (!room) return reply.status(404).send({ error: "Not found" });
      return room;
    },
  );

  // Update room status (housekeeping / occupancy)
  app.patch<{
    Params: { id: string };
    Body: { housekeepingStatus?: string; occupancyStatus?: string };
  }>("/api/rooms/:id/status", async (request, reply) => {
    const { housekeepingStatus, occupancyStatus } = request.body;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (housekeepingStatus) updates.housekeepingStatus = housekeepingStatus;
    if (occupancyStatus) updates.occupancyStatus = occupancyStatus;

    const [updated] = await app.db
      .update(rooms)
      .set(updates)
      .where(eq(rooms.id, request.params.id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });
};
```

**Step 2: Register in app.ts**

Add import and registration:

```typescript
import { roomsRoutes } from "./routes/rooms";
// ... in buildApp:
await app.register(roomsRoutes);
```

**Step 3: Verify**

```bash
curl "http://localhost:3001/api/rooms?propertyId=<PROPERTY_UUID>" | jq
```
Expected: Array of 50 rooms with roomType info.

**Step 4: Commit**

```bash
git add apps/api/src/routes/rooms.ts apps/api/src/app.ts
git commit -m "feat: add rooms list/get/update-status API endpoints"
```

---

### Task 9: Frontend — rooms list page

**Files:**
- Create: `apps/web/src/app/rooms/page.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/lib/api.ts`

**Step 1: Create API client helper**

Create `apps/web/src/lib/api.ts`:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

**Step 2: Create rooms page**

Create `apps/web/src/app/rooms/page.tsx`:

```tsx
import { apiFetch } from "@/lib/api";

type Room = {
  id: string;
  roomNumber: string;
  floor: number | null;
  housekeepingStatus: string;
  occupancyStatus: string;
  roomType: { id: string; name: string; code: string };
};

export default async function RoomsPage() {
  // For MVP, we fetch the first property and its rooms
  const properties = await apiFetch<{ id: string; name: string }[]>(
    "/api/properties",
  );

  if (properties.length === 0) {
    return <div className="p-8">No properties found. Run the seed script.</div>;
  }

  const property = properties[0];
  const rooms = await apiFetch<Room[]>(
    `/api/rooms?propertyId=${property.id}`,
  );

  const hkColors: Record<string, string> = {
    clean: "bg-green-100 text-green-800",
    dirty: "bg-red-100 text-red-800",
    pickup: "bg-yellow-100 text-yellow-800",
    inspected: "bg-blue-100 text-blue-800",
    out_of_order: "bg-gray-300 text-gray-700",
    out_of_service: "bg-gray-200 text-gray-600",
  };

  const occColors: Record<string, string> = {
    vacant: "bg-green-50 text-green-700",
    occupied: "bg-orange-100 text-orange-800",
  };

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-2">{property.name}</h1>
      <p className="text-gray-500 mb-6">{rooms.length} rooms</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Room</th>
              <th className="p-2">Floor</th>
              <th className="p-2">Type</th>
              <th className="p-2">HK Status</th>
              <th className="p-2">Occupancy</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-b hover:bg-gray-50">
                <td className="p-2 font-mono font-bold">{room.roomNumber}</td>
                <td className="p-2">{room.floor ?? "\u2014"}</td>
                <td className="p-2">
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {room.roomType.code}
                  </span>{" "}
                  {room.roomType.name}
                </td>
                <td className="p-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${hkColors[room.housekeepingStatus] || ""}`}
                  >
                    {room.housekeepingStatus}
                  </span>
                </td>
                <td className="p-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${occColors[room.occupancyStatus] || ""}`}
                  >
                    {room.occupancyStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

**Step 3: Update landing page — add link to rooms**

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
      </div>
    </main>
  );
}
```

**Step 4: Verify**

Run both API and Web:
```bash
cd /home/oci/pms && pnpm dev
```
Open http://localhost:3000/rooms
Expected: Table of 50 rooms with HK/occupancy statuses.

**Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat: add rooms list page with status badges"
```

---

## Summary

After completing all 9 tasks:
- DB schema correctly models 2D room status (housekeeping + occupancy) per industry standards
- Properties have check-in/out times
- Seed data: fictional demo hotel, 6 room types with our own codes, 50 rooms
- API endpoints: properties, room types, rooms (list/get/update-status)
- Frontend: rooms list with color-coded status badges
- Ready for Phase 2: Guests
