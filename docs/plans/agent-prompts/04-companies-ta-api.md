# Задача 04: CRUD API — companies + travel_agents

## Контекст
Таблицы companies и travel_agents уже созданы (задача 03). Нужны API endpoints.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай перед началом)
- `apps/api/src/routes/guests.ts` — ОБРАЗЕЦ: скопируй структуру для companies
- `apps/api/src/app.ts` — здесь регистрировать новые routes
- `packages/db/src/schema/companies.ts` — schema для import

## Что сделать

### Шаг 1: Создать routes для companies

Создай файл `apps/api/src/routes/companies.ts`.
Скопируй структуру из `guests.ts` и адаптируй:

```typescript
import type { FastifyPluginAsync } from "fastify";
import { companies, bookings } from "@pms/db";
import { eq, ilike, and, count, sql } from "drizzle-orm";

export const companiesRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/companies?propertyId=...&q=...&limit=50&offset=0
  app.get<{
    Querystring: { propertyId: string; q?: string; limit?: string; offset?: string };
  }>("/api/companies", async (request) => {
    const { propertyId, q, limit, offset } = request.query;
    const maxResults = Math.min(Number(limit) || 50, 100);
    const skip = Math.max(Number(offset) || 0, 0);

    const conditions = [eq(companies.propertyId, propertyId)];
    if (q && q.trim().length > 0) {
      conditions.push(ilike(companies.name, `%${q.trim()}%`));
    }

    const whereCondition = and(...conditions);
    const [totalResult] = await app.db
      .select({ count: count() })
      .from(companies)
      .where(whereCondition);

    const data = await app.db
      .select()
      .from(companies)
      .where(whereCondition)
      .orderBy(companies.name)
      .limit(maxResults)
      .offset(skip);

    return { data, total: totalResult.count };
  });

  // GET /api/companies/:id
  app.get<{ Params: { id: string } }>(
    "/api/companies/:id",
    async (request, reply) => {
      const [company] = await app.db
        .select()
        .from(companies)
        .where(eq(companies.id, request.params.id));
      if (!company) return reply.status(404).send({ error: "Компания не найдена" });
      return company;
    },
  );

  // POST /api/companies
  app.post<{
    Body: {
      propertyId: string;
      name: string;
      shortName?: string;
      taxId?: string;
      registrationNumber?: string;
      email?: string;
      phone?: string;
      address?: string;
      contactPerson?: string;
      creditLimit?: string;
      paymentTermDays?: number;
      arAccountNumber?: string;
      notes?: string;
    };
  }>("/api/companies", async (request, reply) => {
    const { propertyId, name, shortName, taxId, registrationNumber, email, phone, address, contactPerson, creditLimit, paymentTermDays, arAccountNumber, notes } = request.body;

    if (!propertyId || !name) {
      return reply.status(400).send({ error: "propertyId и name обязательны" });
    }

    const [company] = await app.db
      .insert(companies)
      .values({ propertyId, name, shortName, taxId, registrationNumber, email, phone, address, contactPerson, creditLimit, paymentTermDays, arAccountNumber, notes })
      .returning();
    return reply.status(201).send(company);
  });

  // PUT /api/companies/:id
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      shortName?: string;
      taxId?: string;
      registrationNumber?: string;
      email?: string;
      phone?: string;
      address?: string;
      contactPerson?: string;
      creditLimit?: string;
      paymentTermDays?: number;
      arAccountNumber?: string;
      isActive?: boolean;
      notes?: string;
    };
  }>("/api/companies/:id", async (request, reply) => {
    const { name, shortName, taxId, registrationNumber, email, phone, address, contactPerson, creditLimit, paymentTermDays, arAccountNumber, isActive, notes } = request.body;
    const [updated] = await app.db
      .update(companies)
      .set({ name, shortName, taxId, registrationNumber, email, phone, address, contactPerson, creditLimit, paymentTermDays, arAccountNumber, isActive, notes, updatedAt: new Date() })
      .where(eq(companies.id, request.params.id))
      .returning();
    if (!updated) return reply.status(404).send({ error: "Компания не найдена" });
    return updated;
  });

  // DELETE /api/companies/:id
  app.delete<{ Params: { id: string }; Querystring: { propertyId: string } }>(
    "/api/companies/:id",
    async (request, reply) => {
      // ВАЖНО: когда в bookings появится companyId (задача 14),
      // добавить проверку зависимостей тут:
      // const bookingCount = await app.db.select({count: sql<number>`count(*)`}).from(bookings).where(eq(bookings.companyId, request.params.id));

      const [deleted] = await app.db
        .delete(companies)
        .where(and(eq(companies.id, request.params.id), eq(companies.propertyId, request.query.propertyId)))
        .returning();
      if (!deleted) return reply.status(404).send({ error: "Компания не найдена" });
      return { success: true };
    },
  );
};
```

### Шаг 2: Создать routes для travel_agents

Создай файл `apps/api/src/routes/travel-agents.ts`.
Аналогично companies, но с полями travel_agents:

Endpoints:
- `GET /api/travel-agents?propertyId=...&q=...`
- `GET /api/travel-agents/:id`
- `POST /api/travel-agents` — поля: propertyId, name, iataCode, commissionPercent, email, phone, address, contactPerson, notes
- `PUT /api/travel-agents/:id` — те же поля + isActive
- `DELETE /api/travel-agents/:id?propertyId=...`

Ошибки на русском: "Турагент не найден"

### Шаг 3: Зарегистрировать routes в app.ts

В `apps/api/src/app.ts`:
1. Добавь import:
```typescript
import { companiesRoutes } from "./routes/companies";
import { travelAgentsRoutes } from "./routes/travel-agents";
```
2. Добавь register (после guestsRoutes):
```typescript
await app.register(companiesRoutes);
await app.register(travelAgentsRoutes);
```

## НЕ ДЕЛАЙ
- НЕ создавай web pages — только API
- НЕ добавляй companyId/travelAgentId в bookings (это задача 14)
- НЕ добавляй seed data (это задача 15)
- НЕ используй `...request.body` — только explicit field picks

## Проверка
```bash
cd /home/oci/pms && pnpm exec tsc --noEmit && pnpm test
```

## Критерии приёмки
- [ ] Файл `apps/api/src/routes/companies.ts` создан
- [ ] Файл `apps/api/src/routes/travel-agents.ts` создан
- [ ] Routes зарегистрированы в app.ts
- [ ] CRUD работает (GET list, GET by id, POST, PUT, DELETE)
- [ ] Explicit field picks (нет `...request.body`)
- [ ] Русские ошибки для 404
- [ ] TypeScript typecheck чистый
- [ ] Существующие тесты проходят
