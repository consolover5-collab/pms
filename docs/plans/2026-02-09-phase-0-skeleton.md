# Phase 0: Project Skeleton — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up a working monorepo with Fastify API, Next.js frontend, Drizzle ORM connected to PostgreSQL — all runnable with `pnpm dev`.

**Architecture:** pnpm workspace monorepo managed by Turborepo. Two apps (api, web) and three packages (db, domain, shared). PostgreSQL installed natively on Ubuntu 24.04.

**Tech Stack:** Node.js 22, pnpm 10, Turborepo, Fastify, Next.js 15, Drizzle ORM, PostgreSQL, TypeScript, Zod

**Environment:**
- OS: Ubuntu 24.04 (Oracle ARM)
- Node: v22.22.0
- pnpm: 10.9.4
- Docker: NOT available
- PostgreSQL: NOT installed yet

---

### Task 1: Install PostgreSQL

**Step 1: Install PostgreSQL 16**

Run:
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
```

**Step 2: Start PostgreSQL and enable on boot**

Run:
```bash
sudo systemctl start postgresql && sudo systemctl enable postgresql
```

**Step 3: Create database and user**

Run:
```bash
sudo -u postgres psql -c "CREATE USER pms WITH PASSWORD 'pms_dev_password' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE pms_dev OWNER pms;"
```

**Step 4: Verify connection**

Run:
```bash
psql -h localhost -U pms -d pms_dev -c "SELECT 1;"
```
Expected: returns `1`. If auth fails, ensure `pg_hba.conf` allows md5 for localhost.

**Step 5: Commit (nothing to commit yet — no project files)**

---

### Task 2: Initialize monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `tsconfig.base.json`

**Step 1: Init git repo**

Run:
```bash
cd /home/oci/pms
git init
```

**Step 2: Create root package.json**

Create `package.json`:
```json
{
  "name": "pms",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "db:generate": "turbo db:generate",
    "db:migrate": "turbo db:migrate",
    "db:seed": "turbo db:seed"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.7"
  },
  "packageManager": "pnpm@10.9.4"
}
```

**Step 3: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 4: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:seed": {
      "cache": false
    }
  }
}
```

**Step 5: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 6: Create .npmrc**

```
auto-install-peers=true
```

**Step 7: Create .gitignore**

```
node_modules/
dist/
.next/
.turbo/
*.tsbuildinfo
.env
.env.local
.env.*.local
```

**Step 8: Install root dependencies**

Run:
```bash
cd /home/oci/pms && pnpm install
```

**Step 9: Commit**

```bash
git add -A
git commit -m "chore: initialize pnpm monorepo with Turborepo"
```

---

### Task 3: Create shared package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/booking.ts`
- Create: `packages/shared/src/types/index.ts`

**Step 1: Create package.json**

Create `packages/shared/package.json`:
```json
{
  "name": "@pms/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7"
  }
}
```

**Step 2: Create tsconfig.json**

Create `packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

**Step 3: Create types**

Create `packages/shared/src/types/booking.ts`:
```typescript
export const BOOKING_STATUSES = [
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const ROOM_STATUSES = [
  "clean",
  "dirty",
  "inspected",
  "out_of_order",
  "occupied",
] as const;

export type RoomStatus = (typeof ROOM_STATUSES)[number];
```

Create `packages/shared/src/types/index.ts`:
```typescript
export * from "./booking.js";
```

Create `packages/shared/src/index.ts`:
```typescript
export * from "./types/index.js";
```

**Step 4: Commit**

```bash
git add packages/shared
git commit -m "feat: add shared package with core types"
```

---

### Task 4: Create db package (Drizzle schema)

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/connection.ts`
- Create: `packages/db/src/schema/properties.ts`
- Create: `packages/db/src/schema/rooms.ts`
- Create: `packages/db/src/schema/guests.ts`
- Create: `packages/db/src/schema/bookings.ts`
- Create: `packages/db/src/schema/index.ts`
- Create: `.env` (root)

**Step 1: Create package.json**

Create `packages/db/package.json`:
```json
{
  "name": "@pms/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/seed.ts",
    "db:studio": "drizzle-kit studio",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.38",
    "postgres": "^3.4"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30",
    "tsx": "^4",
    "typescript": "^5.7",
    "@pms/shared": "workspace:*"
  }
}
```

**Step 2: Create tsconfig.json**

Create `packages/db/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src", "drizzle.config.ts"]
}
```

**Step 3: Create .env in project root**

Create `/home/oci/pms/.env`:
```
DATABASE_URL=postgresql://pms:pms_dev_password@localhost:5432/pms_dev
```

**Step 4: Create drizzle.config.ts**

Create `packages/db/drizzle.config.ts`:
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 5: Create connection**

Create `packages/db/src/connection.ts`:
```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export function createDb(url: string) {
  const client = postgres(url);
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
```

**Step 6: Create schema — properties**

Create `packages/db/src/schema/properties.ts`:
```typescript
import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  timezone: varchar("timezone", { length: 50 }).notNull().default("UTC"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Step 7: Create schema — rooms**

Create `packages/db/src/schema/rooms.ts`:
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
import { properties } from "./properties.js";

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
  floor: integer("floor").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("clean"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Step 8: Create schema — guests**

Create `packages/db/src/schema/guests.ts`:
```typescript
import {
  pgTable,
  uuid,
  varchar,
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
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Step 9: Create schema — bookings**

Create `packages/db/src/schema/bookings.ts`:
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
import { properties } from "./properties.js";
import { rooms, roomTypes } from "./rooms.js";
import { guests } from "./guests.js";

export const ratePlans = pgTable("rate_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: varchar("is_active", { length: 1 }).notNull().default("Y"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id),
  roomId: uuid("room_id").references(() => rooms.id),
  roomTypeId: uuid("room_type_id")
    .notNull()
    .references(() => roomTypes.id),
  ratePlanId: uuid("rate_plan_id")
    .notNull()
    .references(() => ratePlans.id),
  confirmationNumber: varchar("confirmation_number", { length: 20 })
    .notNull()
    .unique(),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("confirmed"),
  adults: integer("adults").notNull().default(1),
  children: integer("children").notNull().default(0),
  specialRequests: text("special_requests"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Step 10: Create schema index**

Create `packages/db/src/schema/index.ts`:
```typescript
export * from "./properties.js";
export * from "./rooms.js";
export * from "./guests.js";
export * from "./bookings.js";
```

**Step 11: Create db package index**

Create `packages/db/src/index.ts`:
```typescript
export * from "./connection.js";
export * from "./schema/index.js";
```

**Step 12: Install deps and run migration**

Run:
```bash
cd /home/oci/pms && pnpm install
cd /home/oci/pms/packages/db && pnpm db:generate
cd /home/oci/pms/packages/db && pnpm db:migrate
```

**Step 13: Commit**

```bash
git add packages/db .env
git commit -m "feat: add db package with Drizzle schema and migrations"
```

---

### Task 5: Create domain package

**Files:**
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/src/index.ts`
- Create: `packages/domain/src/booking/state-machine.ts`

**Step 1: Create package.json**

Create `packages/domain/package.json`:
```json
{
  "name": "@pms/domain",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "@pms/shared": "workspace:*"
  }
}
```

**Step 2: Create tsconfig.json**

Create `packages/domain/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

**Step 3: Create booking state machine**

Create `packages/domain/src/booking/state-machine.ts`:
```typescript
import type { BookingStatus } from "@pms/shared";

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["checked_out"],
  checked_out: [],
  cancelled: [],
  no_show: [],
};

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: BookingStatus,
  to: BookingStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid booking status transition: ${from} -> ${to}`,
    );
  }
}
```

**Step 4: Create index**

Create `packages/domain/src/index.ts`:
```typescript
export * from "./booking/state-machine.js";
```

**Step 5: Install deps**

Run:
```bash
cd /home/oci/pms && pnpm install
```

**Step 6: Commit**

```bash
git add packages/domain
git commit -m "feat: add domain package with booking state machine"
```

---

### Task 6: Create Fastify API app

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/health.ts`

**Step 1: Create package.json**

Create `apps/api/package.json`:
```json
{
  "name": "@pms/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^5",
    "@fastify/cors": "^10",
    "dotenv": "^16",
    "@pms/db": "workspace:*",
    "@pms/domain": "workspace:*",
    "@pms/shared": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4",
    "typescript": "^5.7"
  }
}
```

**Step 2: Create tsconfig.json**

Create `apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 3: Create app.ts (Fastify instance)**

Create `apps/api/src/app.ts`:
```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(healthRoutes);

  return app;
}
```

**Step 4: Create server.ts (entry point)**

Create `apps/api/src/server.ts`:
```typescript
import "dotenv/config";
import { buildApp } from "./app.js";

const PORT = Number(process.env.API_PORT) || 3001;
const HOST = process.env.API_HOST || "0.0.0.0";

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`API server running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
```

**Step 5: Create health route**

Create `apps/api/src/routes/health.ts`:
```typescript
import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });
};
```

**Step 6: Install deps and test**

Run:
```bash
cd /home/oci/pms && pnpm install
cd /home/oci/pms/apps/api && pnpm dev
```
Expected: Server starts on port 3001. Test with `curl http://localhost:3001/health`.

**Step 7: Commit**

```bash
git add apps/api
git commit -m "feat: add Fastify API app with health endpoint"
```

---

### Task 7: Create Next.js web app

**Step 1: Create Next.js app via create-next-app**

Run:
```bash
cd /home/oci/pms/apps && pnpm create next-app@latest web --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-pnpm
```
Answer prompts: No turbopack for now.

**Step 2: Update package.json — add workspace deps**

Modify `apps/web/package.json` to add:
```json
{
  "dependencies": {
    "@pms/shared": "workspace:*"
  }
}
```

**Step 3: Update the main page**

Replace `apps/web/src/app/page.tsx`:
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
          href="/dashboard"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Dashboard
        </a>
      </div>
    </main>
  );
}
```

**Step 4: Set port to 3000 in dev script**

Verify `apps/web/package.json` dev script runs on port 3000 (default).

**Step 5: Test**

Run:
```bash
cd /home/oci/pms/apps/web && pnpm dev
```
Expected: Opens on http://localhost:3000 with PMS landing page.

**Step 6: Commit**

```bash
git add apps/web
git commit -m "feat: add Next.js web app with landing page"
```

---

### Task 8: Wire everything together — verify `pnpm dev`

**Step 1: Install all dependencies**

Run:
```bash
cd /home/oci/pms && pnpm install
```

**Step 2: Test turbo dev**

Run:
```bash
cd /home/oci/pms && pnpm dev
```
Expected: Both API (port 3001) and Web (port 3000) start simultaneously.

**Step 3: Verify endpoints**

Run in another terminal:
```bash
curl http://localhost:3001/health
curl -s http://localhost:3000 | head -20
```
Expected: API returns JSON, Next.js returns HTML.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: phase 0 complete — monorepo skeleton with API + Web + DB"
```

---

## Summary

After completing all 8 tasks:
- `pnpm dev` starts API on :3001 and Web on :3000
- PostgreSQL running with `pms_dev` database
- Drizzle schema defined for all MVP entities
- Domain package has booking state machine
- Shared package has TypeScript types
- Ready for Phase 1: Property + Rooms CRUD
