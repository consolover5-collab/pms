# Задача 14: Добавить companyId и travelAgentId в bookings

## Контекст
Таблицы companies и travel_agents уже созданы (задача 03). Теперь нужно привязать бронирования к компаниям/TA.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай перед началом)
- `packages/db/src/schema/bookings.ts` — таблица bookings
- `packages/db/src/schema/companies.ts` — companies, travelAgents
- `apps/api/src/routes/bookings.ts` — create/update/list

## Что сделать

### Шаг 1: Добавить FK в schema

В `packages/db/src/schema/bookings.ts`, добавь import:
```typescript
import { companies, travelAgents } from "./companies";
```

В определение таблицы `bookings` добавь поля (после `guestId`):
```typescript
companyId: uuid("company_id")
  .references(() => companies.id, { onDelete: "restrict" }),
travelAgentId: uuid("travel_agent_id")
  .references(() => travelAgents.id, { onDelete: "restrict" }),
```

### Шаг 2: Миграция
```bash
cd /home/oci/pms && pnpm exec drizzle-kit push
```

SQL fallback:
```sql
ALTER TABLE bookings ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE bookings ADD COLUMN travel_agent_id UUID REFERENCES travel_agents(id) ON DELETE RESTRICT;
CREATE INDEX bookings_company_id_idx ON bookings(company_id);
CREATE INDEX bookings_travel_agent_id_idx ON bookings(travel_agent_id);
```

### Шаг 3: Обновить POST /api/bookings

Добавь `companyId` и `travelAgentId` в Body type:
```typescript
companyId?: string;
travelAgentId?: string;
```

В explicit field list (если задача 02 выполнена) добавь эти поля.

При create — валидировать что company/TA существуют:
```typescript
if (request.body.companyId) {
  const [company] = await app.db.select({ id: companies.id }).from(companies).where(eq(companies.id, request.body.companyId));
  if (!company) return reply.status(400).send({ error: "Компания не найдена.", code: "COMPANY_NOT_FOUND" });
}
if (request.body.travelAgentId) {
  const [ta] = await app.db.select({ id: travelAgents.id }).from(travelAgents).where(eq(travelAgents.id, request.body.travelAgentId));
  if (!ta) return reply.status(400).send({ error: "Турагент не найден.", code: "TA_NOT_FOUND" });
}
```

### Шаг 4: Обновить GET /api/bookings/:id

Добавь join для company и TA:
```typescript
.leftJoin(companies, eq(bookings.companyId, companies.id))
.leftJoin(travelAgents, eq(bookings.travelAgentId, travelAgents.id))
```

Добавь в select:
```typescript
company: {
  id: companies.id,
  name: companies.name,
},
travelAgent: {
  id: travelAgents.id,
  name: travelAgents.name,
},
```

### Шаг 5: Обновить DELETE в companies и travel-agents routes

В `companies.ts` DELETE — добавь проверку зависимостей:
```typescript
const [bookingRef] = await app.db
  .select({ count: sql<number>`count(*)` })
  .from(bookings)
  .where(eq(bookings.companyId, request.params.id));

if (Number(bookingRef.count) > 0) {
  return reply.status(400).send({
    error: `Невозможно удалить компанию: ${bookingRef.count} бронирований связано. Деактивируйте вместо удаления.`,
    code: "HAS_BOOKINGS",
  });
}
```

Аналогично для travel-agents.

## НЕ ДЕЛАЙ
- НЕ делай companyId/travelAgentId обязательными
- НЕ меняй существующую логику check-in/out

## Проверка
```bash
cd /home/oci/pms && pnpm exec tsc --noEmit && pnpm test
```

## Критерии приёмки
- [ ] bookings.companyId и travelAgentId добавлены (nullable FK)
- [ ] POST /api/bookings принимает companyId, travelAgentId
- [ ] GET /api/bookings/:id возвращает company и travelAgent
- [ ] DELETE company/TA блокируется если есть бронирования
- [ ] Все тесты проходят
