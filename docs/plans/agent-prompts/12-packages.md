# Задача 12: Пакеты (packages) — schema + API + Night Audit integration

## Контекст
Пакет = услуга привязанная к тарифу: завтрак, парковка, трансфер.
Пакет может быть включён в тариф (стоимость 0) или за доп. плату.
Night Audit постит пакеты вместе с Room & Tax.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай ВЕСЬ файл перед изменением)
- `packages/db/src/schema/bookings.ts` — ratePlans (для FK)
- `packages/db/src/schema/financial.ts` — transactionCodes, folioTransactions, folioWindows (для FK и posting)
- `apps/api/src/routes/night-audit.ts` — куда добавить posting пакетов
- `apps/api/src/routes/rate-plans.ts` — существующий CRUD (образец стиля)
- `apps/api/src/app.ts` — регистрация routes

## ПРАВИЛА
- Auth отключён — НЕ добавляй auth/middleware
- НЕ добавляй rate-limit
- НЕ используй `...spread` — только явные поля
- `pnpm -r run typecheck && pnpm -r run test` после каждого изменения

## Что сделать

### Шаг 1: Schema — создай файл packages/db/src/schema/packages.ts

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  boolean,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { transactionCodes } from "./financial";
import { ratePlans } from "./bookings";

// Пакеты услуг (завтрак, парковка, трансфер)
export const packages = pgTable("packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  transactionCodeId: uuid("transaction_code_id")
    .notNull()
    .references(() => transactionCodes.id, { onDelete: "restrict" }),
  /** 'per_night' | 'per_stay' | 'per_person_per_night' */
  calculationRule: varchar("calculation_rule", { length: 30 }).notNull().default("per_night"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  /** 'every_night' | 'arrival_only' | 'departure_only' */
  postingRhythm: varchar("posting_rhythm", { length: 20 }).notNull().default("every_night"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("packages_property_code").on(table.propertyId, table.code),
  index("packages_property_id_idx").on(table.propertyId),
]);

// M:M связь rate_plans ↔ packages
export const ratePlanPackages = pgTable("rate_plan_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ratePlanId: uuid("rate_plan_id")
    .notNull()
    .references(() => ratePlans.id, { onDelete: "restrict" }),
  packageId: uuid("package_id")
    .notNull()
    .references(() => packages.id, { onDelete: "restrict" }),
  /** true = включён в тариф (0 доп. стоимость), false = отдельное начисление */
  includedInRate: boolean("included_in_rate").notNull().default(true),
}, (table) => [
  unique("rate_plan_packages_unique").on(table.ratePlanId, table.packageId),
]);
```

### Шаг 2: Добавить export в index.ts

В `packages/db/src/schema/index.ts` добавь ОДНУ строку:
```typescript
export * from "./packages";
```

### Шаг 3: Применить миграцию

```bash
cd /home/oci/pms && pnpm -r run typecheck && pnpm exec drizzle-kit push
```

### Шаг 4: CRUD API — создай apps/api/src/routes/packages.ts

Скопируй паттерн из `rate-plans.ts`. Endpoints:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { packages as packagesTable, ratePlanPackages } from "@pms/db";
import { eq, and, ilike, sql, count } from "drizzle-orm";

export const packagesRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/packages?propertyId=...&q=...
  app.get<{
    Querystring: { propertyId: string; q?: string };
  }>("/api/packages", async (request) => {
    const { propertyId, q } = request.query;
    const conditions = [eq(packagesTable.propertyId, propertyId)];
    if (q && q.trim()) {
      conditions.push(ilike(packagesTable.name, `%${q.trim()}%`));
    }
    const data = await app.db
      .select()
      .from(packagesTable)
      .where(and(...conditions))
      .orderBy(packagesTable.name);
    return { data };
  });

  // GET /api/packages/:id
  app.get<{ Params: { id: string } }>(
    "/api/packages/:id",
    async (request, reply) => {
      const [pkg] = await app.db
        .select()
        .from(packagesTable)
        .where(eq(packagesTable.id, request.params.id));
      if (!pkg) return reply.status(404).send({ error: "Пакет не найден" });
      return pkg;
    },
  );

  // POST /api/packages
  app.post<{
    Body: {
      propertyId: string;
      code: string;
      name: string;
      description?: string;
      transactionCodeId: string;
      calculationRule?: string;
      amount?: string;
      postingRhythm?: string;
    };
  }>("/api/packages", async (request, reply) => {
    const { propertyId, code, name, description, transactionCodeId, calculationRule, amount, postingRhythm } = request.body;
    const [pkg] = await app.db
      .insert(packagesTable)
      .values({ propertyId, code, name, description, transactionCodeId, calculationRule, amount, postingRhythm })
      .returning();
    return reply.status(201).send(pkg);
  });

  // PUT /api/packages/:id
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      transactionCodeId?: string;
      calculationRule?: string;
      amount?: string;
      postingRhythm?: string;
      isActive?: boolean;
    };
  }>("/api/packages/:id", async (request, reply) => {
    const { name, description, transactionCodeId, calculationRule, amount, postingRhythm, isActive } = request.body;
    const [updated] = await app.db
      .update(packagesTable)
      .set({ name, description, transactionCodeId, calculationRule, amount, postingRhythm, isActive, updatedAt: new Date() })
      .where(eq(packagesTable.id, request.params.id))
      .returning();
    if (!updated) return reply.status(404).send({ error: "Пакет не найден" });
    return updated;
  });

  // DELETE /api/packages/:id
  app.delete<{ Params: { id: string } }>(
    "/api/packages/:id",
    async (request, reply) => {
      // Проверить зависимости
      const [linked] = await app.db
        .select({ count: count() })
        .from(ratePlanPackages)
        .where(eq(ratePlanPackages.packageId, request.params.id));
      if (linked.count > 0) {
        return reply.status(400).send({
          error: `Невозможно удалить: пакет привязан к ${linked.count} тарифам`,
          code: "HAS_RATE_PLANS",
        });
      }
      const [deleted] = await app.db
        .delete(packagesTable)
        .where(eq(packagesTable.id, request.params.id))
        .returning();
      if (!deleted) return reply.status(404).send({ error: "Пакет не найден" });
      return { success: true };
    },
  );

  // === Rate Plan ↔ Package связи ===

  // GET /api/rate-plans/:id/packages
  app.get<{ Params: { id: string } }>(
    "/api/rate-plans/:id/packages",
    async (request) => {
      const data = await app.db
        .select({
          id: ratePlanPackages.id,
          packageId: ratePlanPackages.packageId,
          includedInRate: ratePlanPackages.includedInRate,
          code: packagesTable.code,
          name: packagesTable.name,
          amount: packagesTable.amount,
          calculationRule: packagesTable.calculationRule,
        })
        .from(ratePlanPackages)
        .innerJoin(packagesTable, eq(ratePlanPackages.packageId, packagesTable.id))
        .where(eq(ratePlanPackages.ratePlanId, request.params.id));
      return { data };
    },
  );

  // POST /api/rate-plans/:id/packages
  app.post<{
    Params: { id: string };
    Body: { packageId: string; includedInRate?: boolean };
  }>("/api/rate-plans/:id/packages", async (request, reply) => {
    const { packageId, includedInRate } = request.body;
    const [link] = await app.db
      .insert(ratePlanPackages)
      .values({
        ratePlanId: request.params.id,
        packageId,
        includedInRate: includedInRate ?? true,
      })
      .returning();
    return reply.status(201).send(link);
  });

  // DELETE /api/rate-plans/:ratePlanId/packages/:packageId
  app.delete<{ Params: { ratePlanId: string; packageId: string } }>(
    "/api/rate-plans/:ratePlanId/packages/:packageId",
    async (request, reply) => {
      const [deleted] = await app.db
        .delete(ratePlanPackages)
        .where(
          and(
            eq(ratePlanPackages.ratePlanId, request.params.ratePlanId),
            eq(ratePlanPackages.packageId, request.params.packageId),
          ),
        )
        .returning();
      if (!deleted) return reply.status(404).send({ error: "Связь не найдена" });
      return { success: true };
    },
  );
};
```

### Шаг 5: Зарегистрировать в app.ts

В `apps/api/src/app.ts`:
1. Добавь import: `import { packagesRoutes } from "./routes/packages";`
2. Добавь register: `await app.register(packagesRoutes);`

### Шаг 6: Night Audit — Package posting

В `apps/api/src/routes/night-audit.ts`:

1. Добавь в import из `@pms/db`:
```typescript
import { ..., packages as packagesTable, ratePlanPackages } from "@pms/db";
```

2. В POST /api/night-audit/run, ПОСЛЕ цикла Room & Tax posting (после `for (const booking of checkedIn) { ... }`), добавь:

```typescript
// Step: Post packages
let packageChargesPosted = 0;

// Получить все checked_in бронирования с rate plans
const bookingsWithRates = await tx
  .select({
    bookingId: bookings.id,
    ratePlanId: bookings.ratePlanId,
    adults: bookings.adults,
    children: bookings.children,
  })
  .from(bookings)
  .where(
    and(
      eq(bookings.propertyId, propertyId),
      eq(bookings.status, "checked_in"),
      sql`${bookings.checkOutDate} > ${bizDate.date}`,
    ),
  );

for (const bk of bookingsWithRates) {
  if (!bk.ratePlanId) continue;

  // Получить пакеты этого тарифа (только НЕ включённые в тариф = доп. плата)
  const pkgs = await tx
    .select({
      packageId: packagesTable.id,
      amount: packagesTable.amount,
      calculationRule: packagesTable.calculationRule,
      postingRhythm: packagesTable.postingRhythm,
      transactionCodeId: packagesTable.transactionCodeId,
      name: packagesTable.name,
    })
    .from(ratePlanPackages)
    .innerJoin(packagesTable, eq(ratePlanPackages.packageId, packagesTable.id))
    .where(
      and(
        eq(ratePlanPackages.ratePlanId, bk.ratePlanId),
        eq(ratePlanPackages.includedInRate, false),
        eq(packagesTable.isActive, true),
        eq(packagesTable.postingRhythm, "every_night"),
      ),
    );

  for (const pkg of pkgs) {
    let amount = parseFloat(pkg.amount);
    if (amount <= 0) continue;

    // per_person_per_night: умножить на количество гостей
    if (pkg.calculationRule === "per_person_per_night") {
      amount = amount * ((bk.adults || 1) + (bk.children || 0));
    }

    await tx.insert(folioTransactions).values({
      propertyId,
      bookingId: bk.bookingId,
      folioWindowId: windowMap.get(bk.bookingId) || null,
      businessDateId: bizDate.id,
      transactionCodeId: pkg.transactionCodeId,
      debit: String(Math.round(amount * 100) / 100),
      credit: "0",
      description: pkg.name,
      isSystemGenerated: true,
      postedBy: postedBy,
    }).onConflictDoNothing();

    packageChargesPosted++;
  }
}
```

ВАЖНО: `windowMap` и `postedBy` уже определены выше в коде (задача 10). Если по какой-то причине `windowMap` не существует — используй `null` вместо `windowMap.get(...)`.

3. Добавь `packageChargesPosted` в return result:
```typescript
return { ..., packageChargesPosted };
```

### Шаг 7: Typecheck + тесты

```bash
cd /home/oci/pms && pnpm -r run typecheck && pnpm -r run test
```

### Шаг 8: Миграция

```bash
cd /home/oci/pms && pnpm exec drizzle-kit push
```

## НЕ ДЕЛАЙ
- НЕ постить пакеты с `includedInRate = true` (они уже в тарифе)
- НЕ постить `arrival_only` и `departure_only` — только `every_night` (для MVP)
- НЕ создавай web pages
- НЕ добавляй seed data (это задача 15)
- НЕ добавляй auth/middleware
- НЕ добавляй rate-limit
- НЕ используй `...spread`

## Критерии приёмки
- [ ] Таблицы packages и rate_plan_packages созданы
- [ ] CRUD API для packages работает (GET list/one, POST, PUT, DELETE)
- [ ] GET/POST/DELETE для привязки пакетов к тарифам
- [ ] Night Audit постит пакеты с every_night rhythm
- [ ] Пакеты с includedInRate=true НЕ постятся отдельно
- [ ] per_person_per_night умножается на guests
- [ ] Зарегистрирован в app.ts
- [ ] Все тесты проходят
- [ ] TypeScript typecheck чистый
