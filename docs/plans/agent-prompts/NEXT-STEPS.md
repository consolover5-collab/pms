# Следующие шаги для агента — обновлено 2026-03-31

## Что уже сделано (шаги 01-16)

| # | Статус | Что сделано |
|---|--------|------------|
| 01 | ✅ done | Auth (ОТКЛЮЧЁН обратно — разработка без auth) |
| 02 | ✅ done | Explicit field whitelists на PUT/POST |
| 03 | ✅ done | Schema: companies + travel_agents |
| 04 | ✅ done | API: CRUD companies + travel_agents |
| 05 | ✅ done | Schema: booking_daily_details |
| 06 | ✅ done | Bookings create/update → daily details |
| 07 | ✅ done | Room move и check-in → обновить daily details |
| 08 | ✅ done | Night Audit берёт rate из daily details |
| 09 | ✅ done | Таблица folio_windows |
| 10 | ✅ done | Posting с windowId, auto-create Window 1 |
| 11 | ✅ done | Кассирские смены (userId nullable — auth off) |
| 12 | ✅ done | Пакеты: schema + API + Night Audit |
| 13 | ✅ done | HK задания: schema + API + генерация |
| 14 | ✅ done | companyId/travelAgentId в bookings (сделано досрочно) |
| 15 | ✅ done | Seed: companies, TA, packages, windows, daily details |
| 16 | ✅ done | Тесты: companies, TA, packages, daily details, folio windows, HK, cashier |

## Что осталось

| # | Промпт | Сложность | Описание |
|---|--------|-----------|----------|
| 17 | `17-fix-daily-details-schema.md` | Низкая | FK + NOT NULL в booking_daily_details |

## ВАЖНО: Правила для агента

### Общие правила
1. **ПРОЧИТАЙ файл** перед изменением — НИКОГДА не пиши код вслепую
2. **НЕ трогай auth** — он отключён в `app.ts`, оставь как есть
3. **НЕ добавляй rate-limit** — был баг (глобальный лимит на все endpoints)
4. **`pnpm -r run typecheck`** после каждого шага — должно быть чисто
5. **`pnpm -r run test`** после каждого шага — 29 тестов, 0 failures
6. **Русские ошибки** для бизнес-логики: "Компания не найдена", "Нельзя удалить"
7. **НЕ используй `...request.body` spread** — только explicit field picks
8. **UUID PK, propertyId на каждой таблице, onDelete:"restrict"**
9. **НЕ добавляй vendor-specific термины** Oracle/Opera в коде

### Паттерны этого проекта
- **Schema**: Drizzle ORM, пример — `packages/db/src/schema/rooms.ts`
- **Routes**: Fastify, пример — `apps/api/src/routes/rooms.ts`
- **Новая таблица**: создать файл в `packages/db/src/schema/`, добавить export в `index.ts`
- **Новый route**: создать файл в `apps/api/src/routes/`, зарегистрировать в `app.ts`
- **Миграция**: `pnpm exec drizzle-kit push` из корня проекта
- **Folio**: append-only, ON CONFLICT DO NOTHING, НИКОГДА UPDATE/DELETE
- **Business date**: `getBusinessDate(db, propertyId)`, НИКОГДА `new Date()` для бизнес-логики

### Что уже есть в codebase (не создавать заново)
- `bookingDailyDetails` — `packages/db/src/schema/booking-daily-details.ts`
- `companies`, `travelAgents` — `packages/db/src/schema/companies.ts`
- `packages`, `ratePlanPackages` — `packages/db/src/schema/packages.ts`
- `folioWindows` — `packages/db/src/schema/financial.ts`
- `bookings.companyId`, `bookings.travelAgentId` — уже добавлены
- Daily details генерация при create/update — уже в `bookings.ts`
- Seed: 3 companies, 2 TA, 2 packages, folio windows, company bookings — уже в `seed.ts`

### Структура нового модуля (шаблон)

```
1. Schema: packages/db/src/schema/<name>.ts
   - Добавить export в packages/db/src/schema/index.ts
   - Запустить: pnpm exec drizzle-kit push

2. Routes: apps/api/src/routes/<name>.ts
   - Добавить import + register в apps/api/src/app.ts

3. Проверка:
   - pnpm -r run typecheck
   - pnpm -r run test
```

## Порядок выполнения

Выполняй шаги **строго последовательно**. Один шаг = один промпт.
После каждого шага: typecheck + test.

```
17
```

Шаг 17: Прочитай `17-fix-daily-details-schema.md`

## Текущая база данных

Таблицы:
- properties, rooms, room_types, guests, users, sessions
- bookings, booking_daily_details (НОВАЯ)
- rate_plans, rate_plan_room_rates, rate_plan_packages
- business_dates, transaction_codes, folio_transactions, folio_windows
- companies, travel_agents (НОВЫЕ)
- packages, rate_plan_packages (НОВЫЕ)
- hk_tasks (НОВАЯ)

## Текущие API endpoints

```
GET/POST        /api/properties
GET/PUT         /api/properties/:id
GET/POST        /api/rooms
GET/PUT/DELETE   /api/rooms/:id
GET/POST        /api/guests
GET/PUT/DELETE   /api/guests/:id
GET/POST        /api/bookings
GET/PUT         /api/bookings/:id
POST            /api/bookings/:id/check-in
POST            /api/bookings/:id/check-out
POST            /api/bookings/:id/cancel
POST            /api/bookings/:id/room-move
GET             /api/bookings/:bookingId/folio
POST            /api/bookings/:bookingId/folio/post
POST            /api/bookings/:bookingId/folio/payment
POST            /api/bookings/:bookingId/folio/adjust
GET/POST        /api/room-types
GET/PUT/DELETE   /api/room-types/:id
GET/POST        /api/rate-plans
GET/PUT/DELETE   /api/rate-plans/:id
GET/POST        /api/transaction-codes
GET/PUT/DELETE   /api/transaction-codes/:id
POST            /api/night-audit/preview
POST            /api/night-audit/run
GET             /api/dashboard
GET             /api/business-date
GET             /api/tape-chart
GET/POST        /api/companies          (НОВЫЙ)
GET/PUT/DELETE   /api/companies/:id      (НОВЫЙ)
GET/POST        /api/travel-agents      (НОВЫЙ)
GET/PUT/DELETE   /api/travel-agents/:id  (НОВЫЙ)
GET             /api/housekeeping/tasks        (НОВЫЙ)
POST            /api/housekeeping/generate     (НОВЫЙ)
PATCH           /api/housekeeping/tasks/:id     (НОВЫЙ)
POST            /api/auth/login
POST            /api/auth/logout
GET             /api/auth/me
GET             /health
```
