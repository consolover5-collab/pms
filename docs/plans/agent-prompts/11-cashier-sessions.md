# Задача 11: Кассирские смены (cashier_sessions)

## Контекст
Сейчас `postedBy` в folio_transactions = user_id или "system". Но нет понятия "смена кассира" —
кто когда открыл кассу, сколько наличных принято. Это нужно для сверки и аудита.

**Auth отключён** на время разработки. userId в cashier_sessions сделать **nullable**. Когда auth включат — сделают NOT NULL. Пока `(request as any).user?.id` возвращает undefined — кассир открывается без привязки к пользователю.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай перед началом)
- `packages/db/src/schema/financial.ts` — folioTransactions (добавить cashierSessionId)
- `packages/db/src/schema/users.ts` — users (для FK)
- `apps/api/src/routes/folio.ts` — posting endpoints
- `apps/api/src/app.ts` — регистрация routes

## Что сделать

### Шаг 1: Добавить таблицу в financial.ts

В `packages/db/src/schema/financial.ts`, ПЕРЕД `folioTransactions`:

```typescript
import { users } from "./users";

// Кассирские смены
export const cashierSessions = pgTable("cashier_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "restrict" }),  // nullable пока auth отключён
  cashierNumber: integer("cashier_number").notNull(),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  openingBalance: decimal("opening_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  closingBalance: decimal("closing_balance", { precision: 10, scale: 2 }),
  /** 'open' | 'closed' */
  status: varchar("status", { length: 10 }).notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("cashier_sessions_one_open_per_number")
    .on(table.propertyId, table.cashierNumber)
    .where(sql`status = 'open'`),
  index("cashier_sessions_user_id_idx").on(table.userId),
]);
```

### Шаг 2: Добавить cashierSessionId в folioTransactions

В определении `folioTransactions` добавь:
```typescript
cashierSessionId: uuid("cashier_session_id")
  .references(() => cashierSessions.id, { onDelete: "restrict" }),
```

Nullable — обратная совместимость.

### Шаг 3: Применить миграцию

```bash
cd /home/oci/pms && pnpm exec drizzle-kit push
```

### Шаг 4: Создать routes

Создай `apps/api/src/routes/cashier.ts`:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { cashierSessions, folioTransactions } from "@pms/db";
import { eq, and, sql, desc } from "drizzle-orm";

export const cashierRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/cashier/open — открыть смену
  app.post<{
    Body: { propertyId: string; cashierNumber: number; openingBalance?: string };
  }>("/api/cashier/open", async (request, reply) => {
    const userId = (request as any).user?.id || null;  // null когда auth отключён

    const { propertyId, cashierNumber, openingBalance } = request.body;
    if (!propertyId || !cashierNumber) {
      return reply.status(400).send({ error: "propertyId и cashierNumber обязательны" });
    }

    // Проверить нет ли уже открытой смены на этом кассире
    const [existing] = await app.db
      .select()
      .from(cashierSessions)
      .where(
        and(
          eq(cashierSessions.propertyId, propertyId),
          eq(cashierSessions.cashierNumber, cashierNumber),
          eq(cashierSessions.status, "open"),
        ),
      );

    if (existing) {
      return reply.status(400).send({
        error: `Касса #${cashierNumber} уже открыта. Сначала закройте её.`,
        code: "ALREADY_OPEN",
      });
    }

    try {
      const [session] = await app.db
        .insert(cashierSessions)
        .values({
          propertyId,
          userId,
          cashierNumber,
          openingBalance: openingBalance || "0",
        })
        .returning();
      return reply.status(201).send(session);
    } catch (err: any) {
      if (err.code === "23505") {
        return reply.status(400).send({
          error: `Касса #${cashierNumber} уже занята другим пользователем.`,
          code: "CASHIER_BUSY",
        });
      }
      throw err;
    }
  });

  // POST /api/cashier/close — закрыть смену
  app.post<{
    Body: { closingBalance?: string };
  }>("/api/cashier/close", async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ error: "Необходима авторизация" });
    }

    const [session] = await app.db
      .select()
      .from(cashierSessions)
      .where(
        and(
          eq(cashierSessions.userId, userId),
          eq(cashierSessions.status, "open"),
        ),
      );

    if (!session) {
      return reply.status(400).send({ error: "Нет открытой смены", code: "NO_OPEN_SESSION" });
    }

    const [closed] = await app.db
      .update(cashierSessions)
      .set({
        status: "closed",
        closedAt: new Date(),
        closingBalance: request.body.closingBalance || null,
      })
      .where(eq(cashierSessions.id, session.id))
      .returning();

    return closed;
  });

  // GET /api/cashier/current — текущая смена пользователя
  app.get("/api/cashier/current", async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ error: "Необходима авторизация" });
    }

    const [session] = await app.db
      .select()
      .from(cashierSessions)
      .where(
        and(
          eq(cashierSessions.userId, userId),
          eq(cashierSessions.status, "open"),
        ),
      );

    if (!session) {
      return { session: null };
    }

    // Посчитать итоги по транзакциям за эту смену
    const [summary] = await app.db
      .select({
        totalDebit: sql<string>`COALESCE(SUM(debit), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(credit), 0)`,
        transactionCount: sql<number>`count(*)`,
      })
      .from(folioTransactions)
      .where(eq(folioTransactions.cashierSessionId, session.id));

    return { session, summary };
  });

  // GET /api/cashier/sessions?propertyId=...
  app.get<{
    Querystring: { propertyId: string; limit?: string };
  }>("/api/cashier/sessions", async (request) => {
    const { propertyId } = request.query;
    const maxResults = Math.min(Number(request.query.limit) || 20, 100);

    const data = await app.db
      .select()
      .from(cashierSessions)
      .where(eq(cashierSessions.propertyId, propertyId))
      .orderBy(desc(cashierSessions.openedAt))
      .limit(maxResults);

    return { data };
  });
};
```

### Шаг 5: Зарегистрировать в app.ts

```typescript
import { cashierRoutes } from "./routes/cashier";
// ...
await app.register(cashierRoutes);
```

### Шаг 6: Интегрировать с folio posting

В `folio.ts`, в POST /post и POST /payment, перед insert:

```typescript
// Найти открытую cashier session текущего пользователя
const userId = (request as any).user?.id;
let cashierSessionId: string | null = null;
if (userId) {
  const [session] = await app.db
    .select({ id: cashierSessions.id })
    .from(cashierSessions)
    .where(and(eq(cashierSessions.userId, userId), eq(cashierSessions.status, "open")));
  cashierSessionId = session?.id || null;
}

// Добавить в values:
cashierSessionId,
```

## НЕ ДЕЛАЙ
- НЕ блокируй posting если нет cashier session — это optional
- НЕ меняй Night Audit posting — system charges не привязываются к кассиру
- НЕ добавляй обязательное требование cashier session

## Проверка
```bash
cd /home/oci/pms && pnpm exec tsc --noEmit && pnpm test
```

## Критерии приёмки
- [ ] Таблица cashier_sessions создана
- [ ] cashierSessionId добавлен в folio_transactions (nullable)
- [ ] API: open/close/current/list sessions
- [ ] Один кассир = один номер кассы (unique where open)
- [ ] Folio posting привязывает cashierSessionId если есть открытая смена
- [ ] Нет смены → posting работает без cashierSessionId (null)
- [ ] Все тесты проходят
