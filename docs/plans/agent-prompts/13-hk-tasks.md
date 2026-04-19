# Задача 13: HK задания (housekeeping tasks)

## Контекст
Сейчас комнаты имеют housekeepingStatus (clean/dirty/etc), но нет системы заданий.
Горничная должна видеть список задач на сегодня: какие номера убирать, тип уборки.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай ВЕСЬ файл перед изменением)
- `packages/db/src/schema/rooms.ts` — rooms (для FK и поле housekeepingStatus)
- `packages/db/src/schema/financial.ts` — businessDates (для FK)
- `packages/db/src/schema/index.ts` — куда добавить export
- `apps/api/src/routes/rooms.ts` — существующий CRUD (образец стиля)
- `apps/api/src/app.ts` — регистрация routes

## ПРАВИЛА
- Auth отключён — НЕ добавляй auth/middleware
- НЕ добавляй rate-limit
- НЕ используй `...spread` — только явные поля
- `pnpm -r run typecheck && pnpm -r run test` после каждого изменения

## Что сделать

### Шаг 1: Schema — создай файл packages/db/src/schema/housekeeping.ts

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { rooms } from "./rooms";
import { businessDates } from "./financial";

export const hkTasks = pgTable("hk_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "restrict" }),
  businessDateId: uuid("business_date_id")
    .notNull()
    .references(() => businessDates.id, { onDelete: "restrict" }),
  /** 'checkout_clean' | 'stayover_clean' | 'deep_clean' | 'inspection' | 'turndown' */
  taskType: varchar("task_type", { length: 20 }).notNull(),
  assignedTo: varchar("assigned_to", { length: 100 }),
  /** 0=normal, 1=rush (VIP, early arrival) */
  priority: integer("priority").notNull().default(0),
  /** 'pending' | 'in_progress' | 'completed' | 'skipped' */
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("hk_tasks_room_date_type").on(table.roomId, table.businessDateId, table.taskType),
  index("hk_tasks_property_id_idx").on(table.propertyId),
  index("hk_tasks_business_date_id_idx").on(table.businessDateId),
  index("hk_tasks_assigned_to_idx").on(table.assignedTo),
]);
```

### Шаг 2: Добавить export в index.ts

В `packages/db/src/schema/index.ts` добавь ОДНУ строку:
```typescript
export * from "./housekeeping";
```

### Шаг 3: Typecheck + миграция

```bash
cd /home/oci/pms && pnpm -r run typecheck && pnpm exec drizzle-kit push
```

### Шаг 4: API — создай apps/api/src/routes/housekeeping.ts

```typescript
import type { FastifyPluginAsync } from "fastify";
import { hkTasks, rooms, bookings, businessDates, guests } from "@pms/db";
import { eq, and, sql, desc } from "drizzle-orm";

export const housekeepingRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/housekeeping/tasks?propertyId=...&assignedTo=...&status=...
  app.get<{
    Querystring: { propertyId: string; assignedTo?: string; status?: string };
  }>("/api/housekeeping/tasks", async (request) => {
    const { propertyId, assignedTo, status } = request.query;

    // Найти текущую бизнес-дату
    const [bizDate] = await app.db
      .select()
      .from(businessDates)
      .where(and(eq(businessDates.propertyId, propertyId), eq(businessDates.status, "open")));

    if (!bizDate) {
      return { data: [], businessDate: null };
    }

    const conditions = [
      eq(hkTasks.propertyId, propertyId),
      eq(hkTasks.businessDateId, bizDate.id),
    ];
    if (assignedTo) conditions.push(eq(hkTasks.assignedTo, assignedTo));
    if (status) conditions.push(eq(hkTasks.status, status));

    const data = await app.db
      .select({
        id: hkTasks.id,
        taskType: hkTasks.taskType,
        assignedTo: hkTasks.assignedTo,
        priority: hkTasks.priority,
        status: hkTasks.status,
        startedAt: hkTasks.startedAt,
        completedAt: hkTasks.completedAt,
        notes: hkTasks.notes,
        room: {
          id: rooms.id,
          roomNumber: rooms.roomNumber,
          floor: rooms.floor,
          housekeepingStatus: rooms.housekeepingStatus,
          occupancyStatus: rooms.occupancyStatus,
        },
      })
      .from(hkTasks)
      .innerJoin(rooms, eq(hkTasks.roomId, rooms.id))
      .where(and(...conditions))
      .orderBy(desc(hkTasks.priority), rooms.roomNumber);

    return { data, businessDate: bizDate.date };
  });

  // POST /api/housekeeping/generate — генерировать задачи на текущий день
  app.post<{
    Body: { propertyId: string };
  }>("/api/housekeeping/generate", async (request, reply) => {
    const { propertyId } = request.body;

    const [bizDate] = await app.db
      .select()
      .from(businessDates)
      .where(and(eq(businessDates.propertyId, propertyId), eq(businessDates.status, "open")));

    if (!bizDate) {
      return reply.status(400).send({ error: "Нет открытой бизнес-даты" });
    }

    // Occupied rooms → stayover_clean
    const occupiedRooms = await app.db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(eq(rooms.propertyId, propertyId), eq(rooms.occupancyStatus, "occupied")));

    // Rooms from today's departures → checkout_clean
    const departureRooms = await app.db
      .select({ roomId: bookings.roomId })
      .from(bookings)
      .where(and(
        eq(bookings.propertyId, propertyId),
        eq(bookings.checkOutDate, bizDate.date),
        eq(bookings.status, "checked_out"),
      ));

    // VIP arrivals → inspection
    const vipArrivals = await app.db
      .select({ roomId: bookings.roomId })
      .from(bookings)
      .innerJoin(guests, eq(bookings.guestId, guests.id))
      .where(and(
        eq(bookings.propertyId, propertyId),
        eq(bookings.checkInDate, bizDate.date),
        sql`${guests.vipStatus} IS NOT NULL AND ${guests.vipStatus} != ''`,
      ));

    let created = 0;

    // Stayover clean
    for (const room of occupiedRooms) {
      try {
        await app.db.insert(hkTasks).values({
          propertyId,
          roomId: room.id,
          businessDateId: bizDate.id,
          taskType: "stayover_clean",
        });
        created++;
      } catch (err: any) {
        if (err.code !== "23505") throw err; // ignore duplicates
      }
    }

    // Checkout clean
    for (const b of departureRooms) {
      if (!b.roomId) continue;
      try {
        await app.db.insert(hkTasks).values({
          propertyId,
          roomId: b.roomId,
          businessDateId: bizDate.id,
          taskType: "checkout_clean",
        });
        created++;
      } catch (err: any) {
        if (err.code !== "23505") throw err;
      }
    }

    // VIP inspection
    for (const b of vipArrivals) {
      if (!b.roomId) continue;
      try {
        await app.db.insert(hkTasks).values({
          propertyId,
          roomId: b.roomId,
          businessDateId: bizDate.id,
          taskType: "inspection",
          priority: 1,
        });
        created++;
      } catch (err: any) {
        if (err.code !== "23505") throw err;
      }
    }

    return { created, businessDate: bizDate.date };
  });

  // PATCH /api/housekeeping/tasks/:id — обновить статус задачи
  app.patch<{
    Params: { id: string };
    Body: { status?: string; assignedTo?: string; notes?: string };
  }>("/api/housekeeping/tasks/:id", async (request, reply) => {
    const { status, assignedTo, notes } = request.body;
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (status) {
      updates.status = status;
      if (status === "in_progress") updates.startedAt = new Date();
      if (status === "completed") updates.completedAt = new Date();
    }
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (notes !== undefined) updates.notes = notes;

    const [updated] = await app.db
      .update(hkTasks)
      .set(updates)
      .where(eq(hkTasks.id, request.params.id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Задача не найдена" });

    // При завершении — обновить HK статус комнаты
    if (status === "completed") {
      const newHkStatus = updated.taskType === "inspection" ? "inspected" : "clean";
      await app.db
        .update(rooms)
        .set({ housekeepingStatus: newHkStatus, updatedAt: new Date() })
        .where(eq(rooms.id, updated.roomId));
    }

    return updated;
  });
};
```

### Шаг 5: Зарегистрировать в app.ts

В `apps/api/src/app.ts`:
1. Добавь import: `import { housekeepingRoutes } from "./routes/housekeeping";`
2. Добавь register: `await app.register(housekeepingRoutes);`

### Шаг 6: Typecheck + тесты

```bash
cd /home/oci/pms && pnpm -r run typecheck && pnpm -r run test
```

## НЕ ДЕЛАЙ
- НЕ добавляй FK на users для assignedTo — HK staff не обязаны иметь аккаунт
- НЕ интегрируй с Night Audit (генерация задач — ручная через /generate)
- НЕ создавай web page
- НЕ добавляй auth/middleware
- НЕ добавляй rate-limit
- НЕ добавляй seed data (это задача 15)

## Критерии приёмки
- [ ] Таблица hk_tasks создана в schema и БД
- [ ] GET /api/housekeeping/tasks — фильтр по propertyId, assignedTo, status
- [ ] POST /api/housekeeping/generate — создаёт stayover_clean, checkout_clean, inspection
- [ ] PATCH /api/housekeeping/tasks/:id — при completed обновляет HK статус комнаты
- [ ] Idempotency — повторный generate не дублирует задачи (UNIQUE constraint)
- [ ] Зарегистрирован в app.ts
- [ ] Все тесты проходят
- [ ] TypeScript typecheck чистый
