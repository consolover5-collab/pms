# Задача 05: Schema — booking_daily_details + seed migration

## Контекст
Сейчас бронирование хранит одну ставку (`rateAmount`) на весь период.
В реальности ставка может различаться по ночам (сезон, upgrade, пакеты).
Создаём таблицу `booking_daily_details` — одна запись на каждую ночь пребывания.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай перед началом)
- `packages/db/src/schema/bookings.ts` — таблица bookings (текущая структура)
- `packages/db/src/schema/rooms.ts` — rooms и roomTypes (для FK)
- `packages/db/src/schema/index.ts` — добавить экспорт
- `tools/seed.ts` — seed data для бронирований (нужно добавить daily details)

## Что сделать

### Шаг 1: Добавить таблицу в schema/bookings.ts

В КОНЕЦ файла `packages/db/src/schema/bookings.ts` добавь:

```typescript
// Посуточная разбивка бронирования — одна запись на каждую ночь
export const bookingDailyDetails = pgTable("booking_daily_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "restrict" }),
  stayDate: date("stay_date").notNull(),
  roomId: uuid("room_id")
    .references(() => rooms.id, { onDelete: "restrict" }),
  roomTypeId: uuid("room_type_id")
    .notNull()
    .references(() => roomTypes.id, { onDelete: "restrict" }),
  ratePlanId: uuid("rate_plan_id")
    .references(() => ratePlans.id, { onDelete: "restrict" }),
  rateAmount: decimal("rate_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  adults: integer("adults").notNull().default(1),
  children: integer("children").notNull().default(0),
  marketCode: varchar("market_code", { length: 20 }),
  sourceCode: varchar("source_code", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("booking_daily_details_booking_date").on(table.bookingId, table.stayDate),
  index("booking_daily_details_booking_id_idx").on(table.bookingId),
  index("booking_daily_details_stay_date_idx").on(table.stayDate),
  index("booking_daily_details_room_id_idx").on(table.roomId),
]);
```

ВАЖНО: Убедись что импорты `rooms`, `roomTypes`, `ratePlans` доступны в файле.
Файл `bookings.ts` уже импортирует их — проверь.
Если нет — добавь:
```typescript
import { rooms, roomTypes } from "./rooms";
```
`ratePlans` уже определён в этом же файле.

Также добавь `unique`, `index` в import из `drizzle-orm/pg-core` если их нет.

### Шаг 2: Проверить что экспорт работает

В `packages/db/src/schema/index.ts` уже есть `export * from "./bookings"`.
Значит `bookingDailyDetails` будет экспортирован автоматически.

Проверь: `packages/db/src/index.ts` должен re-export из schema:
```typescript
export * from "./schema";
```

### Шаг 3: Применить миграцию

```bash
cd /home/oci/pms && pnpm exec drizzle-kit push
```

Если не работает, SQL:
```sql
CREATE TABLE booking_daily_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  stay_date DATE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE RESTRICT,
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
  rate_plan_id UUID REFERENCES rate_plans(id) ON DELETE RESTRICT,
  rate_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  market_code VARCHAR(20),
  source_code VARCHAR(20),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_daily_details_booking_date UNIQUE (booking_id, stay_date)
);
CREATE INDEX booking_daily_details_booking_id_idx ON booking_daily_details(booking_id);
CREATE INDEX booking_daily_details_stay_date_idx ON booking_daily_details(stay_date);
CREATE INDEX booking_daily_details_room_id_idx ON booking_daily_details(room_id);
```

### Шаг 4: Создать helper для генерации daily details

Создай файл `apps/api/src/lib/daily-details.ts`:

```typescript
import { bookingDailyDetails } from "@pms/db";
import { eq } from "drizzle-orm";

interface DailyDetailsParams {
  bookingId: string;
  checkInDate: string;   // "2026-04-01"
  checkOutDate: string;  // "2026-04-03"
  roomId: string | null;
  roomTypeId: string;
  ratePlanId: string | null;
  rateAmount: string;    // "5000.00"
  adults: number;
  children: number;
  marketCode: string | null;
  sourceCode: string | null;
}

/**
 * Генерирует записи booking_daily_details для каждой ночи бронирования.
 * ВАЖНО: checkOutDate НЕ включается (гость не ночует в день выезда).
 *
 * Пример: checkIn=2026-04-01, checkOut=2026-04-03 → 2 записи (01.04, 02.04)
 */
export function generateDailyDetails(params: DailyDetailsParams) {
  const { bookingId, checkInDate, checkOutDate, roomId, roomTypeId, ratePlanId, rateAmount, adults, children, marketCode, sourceCode } = params;

  const details: Array<typeof bookingDailyDetails.$inferInsert> = [];
  const start = new Date(checkInDate + "T00:00:00");
  const end = new Date(checkOutDate + "T00:00:00");

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const stayDate = d.toISOString().split("T")[0];
    details.push({
      bookingId,
      stayDate,
      roomId,
      roomTypeId,
      ratePlanId,
      rateAmount,
      adults,
      children,
      marketCode,
      sourceCode,
    });
  }

  return details;
}

/**
 * Удаляет все daily details бронирования и вставляет новые.
 * Используется при update бронирования (изменение дат/тарифа).
 * Вызывать ВНУТРИ транзакции.
 */
export async function replaceDailyDetails(tx: any, bookingId: string, details: Array<typeof bookingDailyDetails.$inferInsert>) {
  await tx.delete(bookingDailyDetails).where(eq(bookingDailyDetails.bookingId, bookingId));
  if (details.length > 0) {
    await tx.insert(bookingDailyDetails).values(details);
  }
}
```

### Шаг 5: Добавить seed migration

В файле `tools/seed.ts`, после создания bookings, добавь генерацию daily details:

```typescript
// После: const booking = await db.insert(bookings).values({...}).returning();
// Добавь:
import { bookingDailyDetails } from "@pms/db";

// Для каждого booking — сгенерировать daily details
for (const booking of createdBookings) {
  const start = new Date(booking.checkInDate + "T00:00:00");
  const end = new Date(booking.checkOutDate + "T00:00:00");
  const details = [];
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    details.push({
      bookingId: booking.id,
      stayDate: d.toISOString().split("T")[0],
      roomId: booking.roomId,
      roomTypeId: booking.roomTypeId,
      ratePlanId: booking.ratePlanId,
      rateAmount: booking.rateAmount || "0",
      adults: booking.adults || 1,
      children: booking.children || 0,
      marketCode: booking.marketCode,
      sourceCode: booking.sourceCode,
    });
  }
  if (details.length > 0) {
    await db.insert(bookingDailyDetails).values(details);
  }
}
```

ВНИМАНИЕ: Прочитай `tools/seed.ts` внимательно — структура может отличаться.
Найди где создаются bookings и добавь генерацию daily details ПОСЛЕ каждого.

### Шаг 6: Пересидировать данные

```bash
cd /home/oci/pms && pnpm exec tsx tools/seed.ts
```

Проверь что данные есть:
```bash
psql $DATABASE_URL -c "SELECT count(*) FROM booking_daily_details;"
```
Должно быть > 0.

## НЕ ДЕЛАЙ
- НЕ меняй существующие поля в таблице bookings
- НЕ переименовывай bookings.rateAmount (это задача для позже)
- НЕ меняй Night Audit (это задача 08)
- НЕ меняй Bookings create/update routes (это задачи 06, 07)
- НЕ удаляй данные из bookings

## Проверка
```bash
cd /home/oci/pms && pnpm exec tsc --noEmit && pnpm test
```

## Критерии приёмки
- [ ] Таблица `booking_daily_details` создана в schema и в БД
- [ ] Helper `generateDailyDetails()` в `apps/api/src/lib/daily-details.ts`
- [ ] Seed data содержит daily details для каждого бронирования
- [ ] TypeScript typecheck чистый
- [ ] Все существующие тесты проходят
