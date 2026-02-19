# Opera PMS Alignment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use bmad-bmm-dev-story to implement each task.

**Goal:** Привести систему в соответствие с бизнес-логикой Opera PMS в рамках существующих модулей — без расширения функционала.

**Architecture:** Схемные изменения через Drizzle-миграции → исправление бизнес-логики в API → обновление UI. Всё атомарно по задачам. Никаких новых модулей — только исправление и дополнение существующих.

**Tech Stack:** Drizzle ORM, PostgreSQL, Fastify 5, Next.js 15 (App Router), TypeScript, pnpm/Turborepo

---

## Баги и расхождения: полный реестр

| ID | Severity | Модуль | Описание | Статус |
|----|----------|--------|----------|--------|
| B-01 | CRITICAL | Night Audit | Due outs не блокируют запуск аудита | Требует исправления |
| B-02 | IMPORTANT | Rooms | OOO без дат начала/конца (нет oooFromDate/oooToDate) | Требует исправления |
| B-03 | IMPORTANT | Folio | Уникальный индекс слишком жёсткий (блокирует повторный аудит) | Требует исправления |
| B-04 | IMPORTANT | Bookings | `totalAmount` рассинхронизируется с фолио | Требует исправления |
| B-05 | CRITICAL | Rooms | OOO можно поставить на занятую/забронированную комнату | Требует исправления |
| P-01 | IMPORTANT | Bookings | Нет `guaranteeCode` — невозможно обрабатывать no-show корректно | Требует добавления |
| P-02 | MINOR | Bookings | Нет `channel` (VARCHAR40), `marketCode`, `sourceCode` | Требует добавления |
| P-03 | MINOR | Rooms | Нет автовосстановления OOO в ночном аудите | Требует исправления |
| P-04 | IMPORTANT | Guests | `vipStatus` — тип INTEGER вместо VARCHAR(20) | Требует исправления |

---

## Порядок выполнения

```
Task 0 (B-01: Night Audit Due Outs) — нет зависимостей от схемы, делается первым
  ↓
Task 1 (DB Migration) — все схемные изменения в одной миграции
  ↓
Task 2 (API Bookings)    Task 3 (API Rooms)     Task 4 (API Guests)
Task 5 (Night Audit)     ← параллельно после Task 1 →
  ↓
Task 6 (Configurator)
  ↓
Task 7 (Frontend)
  ↓
Task 8 (Tests + Deploy)
```

---

## Task 0: B-01 — Night Audit блокируется при overdue due outs

**Баг:** `/api/night-audit/run` запускается даже когда есть заселённые гости с `checkOut < bizDate`.
Opera блокирует End of Day пока не обработаны все overdue due outs.

**Files:**
- Modify: `apps/api/src/routes/night-audit.ts`

### Step 1: Прочитать текущий код

```bash
grep -n "dueOuts\|checked_in\|checkOutDate\|due.out" apps/api/src/routes/night-audit.ts | head -30
```

### Step 2: Добавить проверку overdue due outs перед транзакцией

В `/api/night-audit/run`, **после** получения `bizDate` и **до** `app.db.transaction(...)`, добавить:

```typescript
// B-01: Блокировка при наличии просроченных due outs
// Opera не позволяет запустить EOD если есть заселённые гости с checkOut < bizDate
const overdueDueOuts = await app.db
  .select({
    id: bookings.id,
    confirmationNumber: bookings.confirmationNumber,
    checkOutDate: bookings.checkOutDate,
  })
  .from(bookings)
  .where(
    and(
      eq(bookings.propertyId, propertyId),
      eq(bookings.status, "checked_in"),
      sql`${bookings.checkOutDate} < ${bizDate.date}`,
    ),
  );

if (overdueDueOuts.length > 0) {
  return reply.status(400).send({
    error: `Невозможно запустить ночной аудит: ${overdueDueOuts.length} гост(ей) с просроченным выездом (checkOut < ${bizDate.date}). Сначала выполните checkout или продлите бронь.`,
    code: "OVERDUE_DUE_OUTS",
    overdueDueOuts: overdueDueOuts.map((b) => ({
      id: b.id,
      confirmationNumber: b.confirmationNumber,
      checkOutDate: b.checkOutDate,
    })),
  });
}
```

**Важно:** Гости с `checkOut = bizDate` (сегодня) — это нормальные due outs текущего дня.
Они уже отображаются в предупреждении в preview. Они НЕ блокируют аудит — ночной аудит
их зарядит за последнюю ночь, а выезд они совершат в течение дня.

### Step 3: Обновить preview — разделить due outs по типу

В `/api/night-audit/preview` разделить `dueOuts` на две группы:

```typescript
// Overdue (checkOut < bizDate) — блокирующие
const overdueDueOuts = await app.db
  .select({ id: bookings.id, confirmationNumber: bookings.confirmationNumber, checkOutDate: bookings.checkOutDate })
  .from(bookings)
  .where(
    and(
      eq(bookings.propertyId, propertyId),
      eq(bookings.status, "checked_in"),
      sql`${bookings.checkOutDate} < ${bizDate.date}`,
    ),
  );

// Due today (checkOut = bizDate) — информационные
const dueToday = await app.db
  .select({ id: bookings.id, confirmationNumber: bookings.confirmationNumber, checkOutDate: bookings.checkOutDate })
  .from(bookings)
  .where(
    and(
      eq(bookings.propertyId, propertyId),
      eq(bookings.status, "checked_in"),
      sql`${bookings.checkOutDate} = ${bizDate.date}`,
    ),
  );
```

Обновить ответ preview:
```typescript
return {
  businessDate: bizDate.date,
  overdueDueOuts: overdueDueOuts.length,   // блокируют аудит
  dueToday: dueToday.length,               // выезжают сегодня
  // ... остальные поля
  warnings: [
    ...overdueDueOuts.length > 0
      ? [`БЛОКИРОВКА: ${overdueDueOuts.length} гост(ей) с просроченным выездом — checkout до запуска аудита`]
      : [],
    ...dueToday.length > 0
      ? [`${dueToday.length} гост(ей) выезжает сегодня`]
      : [],
  ],
};
```

### Step 4: Typecheck

```bash
cd /home/oci/pms && pnpm typecheck
```

### Step 5: Commit

```bash
git add apps/api/src/routes/night-audit.ts
git commit -m "fix(api): block night audit when overdue due outs exist (B-01)"
```

---

## Task 1: DB Migration — Schema Changes

**Files:**
- Modify: `packages/db/src/schema/bookings.ts`
- Modify: `packages/db/src/schema/rooms.ts`
- Modify: `packages/db/src/schema/financial.ts`
- Modify: `packages/db/src/schema/guests.ts`
- Create: `packages/db/drizzle/0004_opera_alignment.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`

### Step 1: Обновить `bookings.ts`

В таблице `bookings`, после поля `paymentMethod`, добавить:

```typescript
/**
 * @opera GUARANTEE_CODE на RESERVATION_NAME (VARCHAR2 20)
 * MVP маппинг: cc_guaranteed=GCC, company_guaranteed=GCO,
 *              deposit_guaranteed=GRD, non_guaranteed=NON,
 *              travel_agent_guaranteed=GRT
 */
guaranteeCode: varchar("guarantee_code", { length: 30 }),
/**
 * @opera MARKET_CODE в RESERVATION_DAILY_ELEMENTS (посуточно)
 * MVP упрощение: храним на уровне брони, не посуточно
 * Примеры: direct, corporate, ota, group, government, leisure
 */
marketCode: varchar("market_code", { length: 20 }),
/**
 * @opera SOURCE_CODE в FINANCIAL_TRANSACTIONS + RESERVATION_DAILY_ELEMENTS
 * Примеры: phone, web, ota, walk_in, gds
 */
sourceCode: varchar("source_code", { length: 20 }),
/**
 * @opera CHANNEL VARCHAR2(40) в RESERVATION_NAME
 * Примеры: direct, booking_com, expedia, airbnb, other
 */
channel: varchar("channel", { length: 40 }),
```

**Удалить** поле `totalAmount`:
```diff
- totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
```

### Step 2: Обновить `rooms.ts`

В таблице `rooms`, после поля `occupancyStatus`, добавить:

```typescript
/**
 * @opera Даты OOO/OOS периода (из логики ROOM_OOO)
 * Обязательны при установке out_of_order / out_of_service
 */
oooFromDate: date("ooo_from_date"),
oooToDate: date("ooo_to_date"),
/** Статус возврата после окончания OOO: clean | dirty */
returnStatus: varchar("return_status", { length: 20 }),
```

### Step 3: ~~Убрать constraint (B-03)~~ — ОТМЕНЕНО по ревью Opus

**Решение изменено:** `folio_tx_night_audit_unique` НЕ удаляется. Вместо этого в `night-audit.ts` используется `.onConflictDoNothing()` при вставке room charge.

**Обоснование (Opus review):** Unique index — единственная гарантия на уровне БД против дублей при конкурентном доступе. Application-level проверка `existingBookingCharge` может быть обойдена при race condition. Правильный паттерн: сохранить index + `ON CONFLICT DO NOTHING` для идемпотентности.

**Статус:** Реализовано в commit "fix: keep folio unique index, use ON CONFLICT DO NOTHING in night audit".

### Step 4: Обновить `guests.ts` — vipStatus VARCHAR (P-04)

В таблице `guests` заменить тип `vipStatus`:

```diff
- /** VIP level (0-5) */
- vipStatus: integer("vip_status"),
+ /**
+  * @opera VIP_STATUS VARCHAR2(20) — коды "VIP", "GOLD", "SILVER" и т.п.
+  * Изменено с integer: Opera хранит строку, не число
+  */
+ vipStatus: varchar("vip_status", { length: 20 }),
```

### Step 5: Создать SQL-миграцию

Создать `packages/db/drizzle/0004_opera_alignment.sql`:

```sql
-- Opera Alignment Migration
-- Fixes: B-02 (OOO dates), B-03 (folio constraint), B-04 (totalAmount), P-01 (guaranteeCode), P-02 (channel), P-04 (vipStatus)

-- 1. bookings: добавить guarantee/market/source/channel
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS guarantee_code VARCHAR(30),
  ADD COLUMN IF NOT EXISTS market_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS source_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS channel VARCHAR(40);

-- 2. bookings: убрать total_amount (вычисляется из folio)
ALTER TABLE bookings DROP COLUMN IF EXISTS total_amount;

-- 3. rooms: добавить OOO диапазон дат
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS ooo_from_date DATE,
  ADD COLUMN IF NOT EXISTS ooo_to_date DATE,
  ADD COLUMN IF NOT EXISTS return_status VARCHAR(20);

-- 4. folio_transactions: unique constraint НЕ удаляется (см. Step 3 — отменено по Opus review)
-- Используется ON CONFLICT DO NOTHING в night-audit.ts вместо удаления index

-- 5. guests: vipStatus integer -> varchar
ALTER TABLE guests
  ALTER COLUMN vip_status TYPE VARCHAR(20) USING vip_status::VARCHAR;
```

### Step 6: Обновить `_journal.json`

В `packages/db/drizzle/meta/_journal.json` добавить запись в массив `entries`:
```json
{
  "idx": 4,
  "version": "7",
  "when": 1739923200000,
  "tag": "0004_opera_alignment",
  "breakpoints": true
}
```

### Step 7: Применить миграцию

```bash
psql $DATABASE_URL < /home/oci/pms/packages/db/drizzle/0004_opera_alignment.sql
```

Проверить:
```bash
psql $DATABASE_URL -c "\d bookings" | grep -E "guarantee|market|source|channel|total"
psql $DATABASE_URL -c "\d rooms" | grep -E "ooo|return"
psql $DATABASE_URL -c "\d guests" | grep vip
```

### Step 8: Проверить typecheck

```bash
cd /home/oci/pms && pnpm typecheck
```

Ожидаемые ошибки: только там где используется `totalAmount` — фиксируем в Task 2/7.
`vipStatus` как строка должен проходить (TypeScript widening).

### Step 9: Commit

```bash
git add packages/db/src/schema/bookings.ts packages/db/src/schema/rooms.ts \
  packages/db/src/schema/financial.ts packages/db/src/schema/guests.ts \
  packages/db/drizzle/0004_opera_alignment.sql \
  packages/db/drizzle/meta/_journal.json
git commit -m "feat(db): opera alignment schema — guarantee_code, OOO dates, market/source/channel; fix folio constraint, vipStatus type, drop totalAmount"
```

---

## Task 2: API Bookings — guaranteeCode, market/source/channel, убрать totalAmount

**Files:**
- Modify: `apps/api/src/routes/bookings.ts`

### Step 1: Найти все места где используется totalAmount

```bash
grep -n "totalAmount\|total_amount" apps/api/src/routes/bookings.ts
```

### Step 2: Обновить Body type в POST /api/bookings

Добавить:
```typescript
guaranteeCode?: string;
marketCode?: string;
sourceCode?: string;
channel?: string;
```
Убрать `totalAmount?: string` из Body type.

### Step 3: Убрать вычисление calcTotalAmount в POST

Найти и удалить блок:
```typescript
// Авторасчёт totalAmount если не указан
let calcTotalAmount = request.body.totalAmount;
if (!calcTotalAmount && request.body.rateAmount) {
  // ... расчёт через nights
}
```

### Step 4: Обновить INSERT в транзакции POST

```diff
- totalAmount: calcTotalAmount || null,
+ guaranteeCode: request.body.guaranteeCode || null,
+ marketCode: request.body.marketCode || null,
+ sourceCode: request.body.sourceCode || null,
+ channel: request.body.channel || null,
```

### Step 5: Обновить Body type в PUT /api/bookings/:id

Добавить:
```typescript
guaranteeCode?: string;
marketCode?: string;
sourceCode?: string;
channel?: string;
```
Убрать `totalAmount` из Body type.

### Step 6: Обновить select в GET /api/bookings/:id

Добавить в select:
```typescript
guaranteeCode: bookings.guaranteeCode,
marketCode: bookings.marketCode,
sourceCode: bookings.sourceCode,
channel: bookings.channel,
```
Убрать `totalAmount: bookings.totalAmount`.

### Step 7: Обновить select в GET /api/bookings (list)

Убрать `totalAmount: bookings.totalAmount`. Оставить `rateAmount: bookings.rateAmount`.

### Step 8: Typecheck + commit

```bash
cd /home/oci/pms && pnpm typecheck
git add apps/api/src/routes/bookings.ts
git commit -m "feat(api): bookings — guarantee code, market/source/channel; remove totalAmount (B-04)"
```

---

## Task 3: API Rooms — OOO даты + B-05 валидация

**Files:**
- Modify: `apps/api/src/routes/rooms.ts`

### Step 1: Прочитать текущий код

```bash
grep -n "out_of_order\|out_of_service\|occupancyStatus\|housekeepingStatus" apps/api/src/routes/rooms.ts | head -40
```

### Step 2: Добавить OOO поля в Body type

В POST /api/rooms/:id/status Body type:
```typescript
oooFromDate?: string;  // YYYY-MM-DD
oooToDate?: string;    // YYYY-MM-DD, включительно
returnStatus?: string; // clean | dirty
```

### Step 3: B-05 — Валидация: нельзя OOO на занятую комнату

В обработчике POST /api/rooms/:id/status, **перед** обновлением статуса:

```typescript
const housekeepingStatus = request.body.housekeepingStatus;
const { oooFromDate, oooToDate, returnStatus } = request.body;

if (housekeepingStatus === "out_of_order" || housekeepingStatus === "out_of_service") {
  // B-05a: Нельзя OOO если комната занята (occupied)
  // Oracle docs: "It is not possible to take an occupied or reserved room to OOO"
  if (room.occupancyStatus === "occupied") {
    return reply.status(400).send({
      error: "Нельзя перевести занятую комнату в статус Out of Order. Сначала выполните checkout.",
      code: "ROOM_IS_OCCUPIED",
    });
  }

  // B-05b: Нельзя OOO если есть активные брони в указанном периоде
  if (oooFromDate && oooToDate) {
    const conflictingBookings = await app.db
      .select({ id: bookings.id, confirmationNumber: bookings.confirmationNumber })
      .from(bookings)
      .where(
        and(
          eq(bookings.roomId, room.id),
          inArray(bookings.status, ["confirmed", "checked_in"]),
          // Перекрытие периодов: bookingIn < oooTo AND bookingOut > oooFrom
          sql`${bookings.checkInDate} < ${oooToDate}`,
          sql`${bookings.checkOutDate} > ${oooFromDate}`,
        ),
      );

    if (conflictingBookings.length > 0) {
      return reply.status(400).send({
        error: `Нельзя установить Out of Order: комната забронирована на этот период (${conflictingBookings.length} брон(ей)).`,
        code: "ROOM_HAS_BOOKINGS_IN_PERIOD",
        conflictingBookings: conflictingBookings.map((b) => b.confirmationNumber),
      });
    }
  }
}
```

Добавить в импорты: `import { inArray } from "drizzle-orm";`

### Step 4: Валидация OOO дат

**ВАЖНО:** Oracle docs явно требуют OOO даты — *"From Date and Through Date are required"*.
Обе даты ОБЯЗАТЕЛЬНЫ при установке OOO/OOS:

```typescript
if (housekeepingStatus === "out_of_order" || housekeepingStatus === "out_of_service") {
  // @opera https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/out_of_order_service_hsk_ooo.htm
  // Rule: "From Date and Through Date are required. Cannot exceed 5 years in future."
  if (!oooFromDate || !oooToDate) {
    return reply.status(400).send({
      error: "Для OOO/OOS обязательно укажите даты начала и окончания периода.",
      code: "OOO_DATES_REQUIRED",
    });
  }
}
if (oooToDate && oooFromDate && oooToDate < oooFromDate) {
  return reply.status(400).send({
    error: "Дата окончания OOO не может быть раньше даты начала.",
    code: "INVALID_OOO_DATES",
  });
}
if (returnStatus && !["clean", "dirty"].includes(returnStatus)) {
  return reply.status(400).send({
    error: "Статус возврата должен быть clean или dirty.",
    code: "INVALID_RETURN_STATUS",
  });
}
```

### Step 5: Сохранять OOO поля

В объект `updates` добавить:
```typescript
if (oooFromDate !== undefined) updates.oooFromDate = oooFromDate;
if (oooToDate !== undefined) updates.oooToDate = oooToDate;
if (returnStatus !== undefined) updates.returnStatus = returnStatus;

// При снятии OOO/OOS — очищать даты автоматически
if (
  housekeepingStatus &&
  housekeepingStatus !== "out_of_order" &&
  housekeepingStatus !== "out_of_service"
) {
  updates.oooFromDate = null;
  updates.oooToDate = null;
  updates.returnStatus = null;
}
```

### Step 6: Добавить OOO поля в GET select

В GET /api/rooms и /api/rooms/:id добавить в select:
```typescript
oooFromDate: rooms.oooFromDate,
oooToDate: rooms.oooToDate,
returnStatus: rooms.returnStatus,
```

### Step 7: Typecheck + commit

```bash
cd /home/oci/pms && pnpm typecheck
git add apps/api/src/routes/rooms.ts
git commit -m "fix(api): OOO date range + block OOO on occupied/reserved rooms (B-02, B-05)"
```

---

## Task 4: API Guests — vipStatus string (P-04)

**Files:**
- Modify: `apps/api/src/routes/guests.ts`

### Step 1: Найти все места vipStatus

```bash
grep -n "vipStatus\|vip_status" apps/api/src/routes/guests.ts
```

### Step 2: Проверить Body type

В POST и PUT body types убедиться что `vipStatus` принимает `string | null`, не `number`:
```typescript
vipStatus?: string | null;
```

Если была числовая валидация — убрать, принимать строку как есть (длина ≤ 20).

### Step 3: Typecheck + commit

```bash
cd /home/oci/pms && pnpm typecheck
git add apps/api/src/routes/guests.ts
git commit -m "fix(api): guests vipStatus — integer to varchar(20) (P-04)"
```

---

## Task 5: Night Audit — восстановление OOO по дате + guaranteeCode в preview

**Files:**
- Modify: `apps/api/src/routes/night-audit.ts`

### Step 1: Добавить `guaranteeCode` в pending no-shows preview

Найти запрос `pendingNoShows` в `/api/night-audit/preview` и добавить:
```typescript
guaranteeCode: bookings.guaranteeCode,
```

В ответе:
```typescript
pendingNoShowDetails: pendingNoShows.map((b) => ({
  id: b.id,
  confirmationNumber: b.confirmationNumber,
  guestName: `${b.guestFirstName} ${b.guestLastName}`,
  checkInDate: b.checkInDate,
  checkOutDate: b.checkOutDate,
  guaranteeCode: b.guaranteeCode,  // <- добавить
})),
```

### Step 2: Добавить импорты `lte`, `or`

```typescript
import { eq, and, lt, lte, or, sql, inArray } from "drizzle-orm";
```

### Step 3: Добавить в /run — шаг восстановления OOO/OOS (P-03)

В `app.db.transaction(...)`, после Step 6 (sync room statuses), **перед** Step 7 (close business date):

```typescript
// Step 6b: Restore OOO/OOS rooms whose oooToDate <= business date
// @opera Логика аналогична ночному восстановлению комнат в Opera
const expiredOooRooms = await tx
  .select({
    id: rooms.id,
    roomNumber: rooms.roomNumber,
    returnStatus: rooms.returnStatus,
  })
  .from(rooms)
  .where(
    and(
      eq(rooms.propertyId, propertyId),
      or(
        eq(rooms.housekeepingStatus, "out_of_order"),
        eq(rooms.housekeepingStatus, "out_of_service"),
      ),
      lte(rooms.oooToDate, bizDate.date),
    ),
  );

let oooRoomsRestored = 0;
for (const room of expiredOooRooms) {
  const restoredStatus = (room.returnStatus as string) || "dirty";
  await tx
    .update(rooms)
    .set({
      housekeepingStatus: restoredStatus,
      oooFromDate: null,
      oooToDate: null,
      returnStatus: null,
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, room.id));
  oooRoomsRestored++;
}
```

### Step 4: Добавить `oooRoomsRestored` в результат /run

```typescript
return {
  // ...все существующие поля
  oooRoomsRestored,
};
```

### Step 5: Typecheck + commit

```bash
cd /home/oci/pms && pnpm typecheck
git add apps/api/src/routes/night-audit.ts
git commit -m "feat(api): night audit — restore OOO rooms by date, show guaranteeCode in no-show preview (P-03)"
```

---

## Task 6: Configurator — Страница гарантийных кодов

**Files:**
- Create: `apps/web/src/app/configuration/guarantee-codes/page.tsx`
- Modify: `apps/web/src/app/configuration/page.tsx`

Это информационный справочник — read-only список предустановленных кодов (без БД).

### Step 1: Прочитать configuration/page.tsx

```bash
grep -n "transaction-codes\|rate-plans\|href" apps/web/src/app/configuration/page.tsx | head -20
```

### Step 2: Создать страницу гарантийных кодов

`apps/web/src/app/configuration/guarantee-codes/page.tsx`:

```tsx
import { BackButton } from "@/components/back-button";

const GUARANTEE_CODES = [
  {
    code: "cc_guaranteed",
    label: "Гарантия кредитной картой",
    description: "Бронь обеспечена кредитной картой гостя. No-show — списание с карты.",
  },
  {
    code: "company_guaranteed",
    label: "Гарантия компании",
    description: "Счёт выставляется компании. No-show — счёт компании.",
  },
  {
    code: "deposit_guaranteed",
    label: "Гарантия депозитом",
    description: "Гость внёс предоплату. При no-show депозит удерживается.",
  },
  {
    code: "non_guaranteed",
    label: "Без гарантии",
    description: "Бронь не обеспечена. При no-show списание невозможно.",
  },
  {
    code: "travel_agent_guaranteed",
    label: "Гарантия турагента",
    description: "Турагент несёт ответственность. No-show — счёт агенту.",
  },
];

export default function GuaranteeCodesPage() {
  return (
    <main className="p-8 max-w-3xl mx-auto">
      <BackButton fallbackHref="/configuration" label="Back to Configuration" />
      <h1 className="text-2xl font-bold mt-2 mb-6">Коды гарантии</h1>
      <p className="text-sm text-gray-500 mb-6">
        Код гарантии определяет чем обеспечена бронь. Влияет на обработку no-show и отмены.
      </p>
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase w-48">Код</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Название</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Описание</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {GUARANTEE_CODES.map((g) => (
              <tr key={g.code} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-blue-700">{g.code}</td>
                <td className="px-4 py-3 font-medium">{g.label}</td>
                <td className="px-4 py-3 text-gray-600">{g.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

### Step 3: Добавить ссылку на главной конфигуратора

В `apps/web/src/app/configuration/page.tsx` добавить карточку по аналогии с существующими:
```tsx
<Link href="/configuration/guarantee-codes">
  <div className="...">
    <h2>Коды гарантии</h2>
    <p>Типы гарантий бронирования</p>
  </div>
</Link>
```

### Step 4: Commit

```bash
git add apps/web/src/app/configuration/guarantee-codes/ \
  apps/web/src/app/configuration/page.tsx
git commit -m "feat(web): add guarantee codes reference page to configuration"
```

---

## Task 7: Frontend — guaranteeCode в формах, убрать totalAmount, OOO даты, vipStatus

**Files:**
- Modify: `apps/web/src/app/bookings/new/page.tsx`
- Modify: `apps/web/src/app/bookings/[id]/page.tsx`
- Modify: `apps/web/src/app/night-audit/page.tsx`
- Modify: `apps/web/src/app/guests/[id]/page.tsx` (или где отображается vipStatus)
- Modify: `apps/web/src/app/rooms/[id]/page.tsx` (или rooms list)

### Step 1: Найти все упоминания totalAmount в web

```bash
grep -r "totalAmount\|total_amount" apps/web/src --include="*.tsx" -l
grep -r "totalAmount\|total_amount" apps/web/src --include="*.ts" -l
```

### Step 2: Убрать totalAmount из форм и отображения

Заменить статичное `totalAmount` на вычисляемое:
```tsx
const nights = Math.ceil(
  (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime())
  / (1000 * 60 * 60 * 24)
);
const estimatedTotal = booking.rateAmount
  ? (parseFloat(booking.rateAmount) * nights).toFixed(2)
  : null;
```

Подпись: "Расчётная сумма (без налогов)" или просто убрать — реальный баланс в фолио.

### Step 3: Добавить поле guaranteeCode в форму создания/редактирования брони

```tsx
const GUARANTEE_OPTIONS = [
  { value: "", label: "Не указан" },
  { value: "cc_guaranteed", label: "Кредитная карта" },
  { value: "company_guaranteed", label: "Компания" },
  { value: "deposit_guaranteed", label: "Депозит" },
  { value: "non_guaranteed", label: "Без гарантии" },
  { value: "travel_agent_guaranteed", label: "Турагент" },
];

// В форме:
<select name="guaranteeCode" value={form.guaranteeCode || ""} onChange={...}>
  {GUARANTEE_OPTIONS.map((o) => (
    <option key={o.value} value={o.value}>{o.label}</option>
  ))}
</select>
```

### Step 4: Показывать guaranteeCode в карточке брони

В `/bookings/[id]` добавить:
```tsx
{booking.guaranteeCode && (
  <div>
    <span className="text-gray-500">Гарантия:</span>{" "}
    <span>{GUARANTEE_LABEL[booking.guaranteeCode] ?? booking.guaranteeCode}</span>
  </div>
)}
```

### Step 5: Показывать OOO период в списке/карточке комнат

В комнате где `housekeepingStatus === "out_of_order"` или `"out_of_service"`:
```tsx
{room.oooToDate && (
  <span className="text-xs text-red-600">
    OOO до {room.oooToDate}
    {room.returnStatus && ` → вернуть: ${room.returnStatus}`}
  </span>
)}
```

### Step 6: Обновить no-show preview в ночном аудите

В `/app/night-audit/page.tsx` в разделе pending no-shows добавить колонку `Гарантия`:
```tsx
<td>{noShow.guaranteeCode
  ? GUARANTEE_LABEL[noShow.guaranteeCode] ?? noShow.guaranteeCode
  : "—"
}</td>
```

### Step 7: Обновить поле vipStatus в гостях

Найти форму создания/редактирования гостя. Заменить числовой input на текстовый:
```diff
- <input type="number" name="vipStatus" value={form.vipStatus} ... />
+ <input type="text" name="vipStatus" maxLength={20} placeholder="VIP, GOLD, SILVER..." value={form.vipStatus || ""} ... />
```

### Step 8: Обновить split between overdueDueOuts и dueToday в ночном аудите UI

Если preview показывает `dueOuts`, обновить UI чтобы разделить на:
- `overdueDueOuts` — красным (блокируют)
- `dueToday` — жёлтым (информационно)

### Step 9: Typecheck + build

```bash
cd /home/oci/pms && pnpm typecheck
cd /home/oci/pms/apps/web && pnpm build
```

### Step 10: Commit

```bash
git add apps/web/src/app/
git commit -m "feat(web): guaranteeCode in bookings, OOO dates in rooms, vipStatus as string, remove totalAmount"
```

---

## Task 8: Тесты + финальный деплой

**Files:**
- Modify: `apps/api/src/tests/` (integration tests)

### Step 1: Обновить существующие тесты — убрать totalAmount

```bash
grep -r "totalAmount" apps/api/src/tests/ --include="*.ts" -l
```
Исправить тесты где проверяется `totalAmount` — убрать поле из assert.

### Step 2: Тест B-01 — night audit блокируется при overdue due outs

```typescript
test("Night audit is blocked when overdue due-outs exist", async () => {
  // Создать booking с checkOut = вчера (overdue)
  // Попробовать запустить ночной аудит
  const resp = await app.inject({
    method: "POST",
    url: "/api/night-audit/run",
    body: { propertyId },
  });
  expect(resp.statusCode).toBe(400);
  const data = JSON.parse(resp.body);
  expect(data.code).toBe("OVERDUE_DUE_OUTS");
});
```

### Step 3: Тест B-05 — нельзя OOO на occupied комнату

```typescript
test("Cannot set OOO on an occupied room", async () => {
  // Взять checked_in бронь с комнатой
  const resp = await app.inject({
    method: "POST",
    url: `/api/rooms/${occupiedRoomId}/status`,
    body: { housekeepingStatus: "out_of_order", oooFromDate: "2026-02-20", oooToDate: "2026-02-25" },
  });
  expect(resp.statusCode).toBe(400);
  expect(JSON.parse(resp.body).code).toBe("ROOM_IS_OCCUPIED");
});
```

### Step 4: Тест B-05 — нельзя OOO на забронированный период

```typescript
test("Cannot set OOO for period with active bookings", async () => {
  // Найти комнату с confirmed booking
  const resp = await app.inject({
    method: "POST",
    url: `/api/rooms/${roomWithBookingId}/status`,
    body: {
      housekeepingStatus: "out_of_order",
      oooFromDate: bookingCheckIn,
      oooToDate: bookingCheckOut,
    },
  });
  expect(resp.statusCode).toBe(400);
  expect(JSON.parse(resp.body).code).toBe("ROOM_HAS_BOOKINGS_IN_PERIOD");
});
```

### Step 5: Тест P-01 — guaranteeCode сохраняется и возвращается

```typescript
test("POST /api/bookings — guaranteeCode, marketCode, channel saved", async () => {
  const resp = await app.inject({
    method: "POST",
    url: "/api/bookings",
    body: { ...validBookingBody, guaranteeCode: "cc_guaranteed", marketCode: "direct", channel: "phone" },
  });
  expect(resp.statusCode).toBe(201);
  const data = JSON.parse(resp.body);
  expect(data.guaranteeCode).toBe("cc_guaranteed");
  expect(data.marketCode).toBe("direct");
  expect(data.channel).toBe("phone");
});
```

### Step 6: Тест OOO дат — восстановление в ночном аудите

```typescript
test("Night audit restores OOO rooms whose oooToDate <= bizDate", async () => {
  // Поставить комнату в OOO с oooToDate = bizDate
  // Запустить ночной аудит
  // Проверить что комната вернулась в returnStatus (dirty)
  const result = JSON.parse(runResp.body);
  expect(result.oooRoomsRestored).toBeGreaterThan(0);
});
```

### Step 7: Запустить все тесты

```bash
cd /home/oci/pms && pnpm test
```
Ожидаемый результат: все тесты проходят.

### Step 8: Деплой

```bash
# Kill old processes
kill $(pgrep -f "tsx src/server.ts") $(pgrep -f "next-server") 2>/dev/null; sleep 1

# Start API (no build needed)
cd /home/oci/pms/apps/api && nohup node_modules/.bin/tsx src/server.ts > /tmp/api-prod.log 2>&1 &

# Build and start web
cd /home/oci/pms/apps/web && pnpm build && nohup node_modules/.bin/next start --port 3000 > /tmp/web-prod.log 2>&1 &

# Verify
sleep 5 && curl -s http://localhost:3001/health && curl -s -o /dev/null -w "Web: %{http_code}\n" http://localhost:3000/
```

### Step 9: Финальный commit

```bash
git add apps/api/src/tests/
git commit -m "test: opera alignment — B-01 due outs, B-05 OOO validation, guarantee codes, OOO restore"
```

---

## Что намеренно НЕ делаем (MVP упрощения)

| Расхождение | Opera | Решение |
|-------------|-------|---------|
| RESERVATION_DAILY_ELEMENTS | Посуточные данные (rate, room, market) | Per-booking, нет посуточного breakdown — MVP OK |
| PROSPECT status | 2,618 броней в HA336 | Нет в MVP — только confirmed/checked_in/etc |
| NAME_TYPE / гостевые роли | Guest/Company/Agent/TA через NAME_USAGE_TYPE | Нет в MVP — только физлицо |
| Cancellation reason codes | CANCELLATION_REASON_CODE | Нет в MVP — не влияет на операции |
| Walk-in flag | ORIGIN_OF_BOOKING | Нет в MVP |
| UDF (User Defined Fields) | 40+40+20 custom fields | Нет в MVP |
| LOS restrictions | Min/Max stays по типу комнаты | Нет в MVP |
| Allotments / Groups | BLOCK_ID, ALLOTMENT_HEADER_ID | Вне MVP scope |
| Sharers | SHARE_SEQ_NO, MASTER_SHARE | Вне MVP scope |
| No Show Posting Rules | Автоматический постинг по типу гарантии | Ручное решение оператора — MVP OK |
| VIP_STATUS | Числовые коды 1-5 в Opera NAME | Используем descriptive VARCHAR(20) — читаемее для OSS |
| CHANNEL коды | "P" (Phone) / "B" (Booking) в HA336 | Используем descriptive strings — те же данные, читаемее |
| GUARANTEE_CODE "CHECKED IN" | 112K аномальных записей в HA336 (артефакт мигрирации) | Игнорировать как NULL, реальные коды: GCC/NON/GCO/GRD/GRT/DEP |

---

*Обновлено: 2026-02-19. Версия 2.0 — включены все баги из ретроспективного анализа.*
