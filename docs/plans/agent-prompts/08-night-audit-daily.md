# Задача 08: Night Audit — Room & Tax posting из daily details

## Контекст
Сейчас Night Audit берёт ставку из `bookings.rateAmount` (одна ставка на всё бронирование).
Нужно читать из `booking_daily_details` где `stayDate = текущая бизнес-дата`.
Это позволит разные ставки по ночам.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай ВЕСЬ файл)
- `apps/api/src/routes/night-audit.ts` — ВЕСЬ файл (~538 строк)
- `packages/db/src/schema/booking-daily-details.ts` — таблица bookingDailyDetails

## ПРАВИЛА
- Auth отключён — НЕ добавляй auth/middleware
- НЕ добавляй rate-limit
- НЕ используй `...spread` — только явные поля
- `pnpm -r run typecheck && pnpm -r run test` после каждого изменения

## Что сделать

### Шаг 1: Добавить import bookingDailyDetails

В начало `night-audit.ts`, в существующий import из `@pms/db` добавь `bookingDailyDetails`:

```typescript
import {
  bookings,
  rooms,
  guests,
  properties,
  businessDates,
  transactionCodes,
  folioTransactions,
  bookingDailyDetails,  // ← ДОБАВИТЬ СЮДА
} from "@pms/db";
```

НЕ создавай отдельный import — добавь в СУЩЕСТВУЮЩИЙ.

### Шаг 2: Изменить preview

В POST /api/night-audit/preview найди запрос `roomsToCharge`. Он выглядит так:

```typescript
const roomsToCharge = await app.db
  .select({
    id: bookings.id,
    rateAmount: bookings.rateAmount,
    ...
  })
  .from(bookings)
  .leftJoin(rooms, ...)
  .innerJoin(guests, ...)
  .where(...);
```

Замени на:

```typescript
const roomsToCharge = await app.db
  .select({
    id: bookings.id,
    rateAmount: bookingDailyDetails.rateAmount,
    roomNumber: rooms.roomNumber,
    guestFirstName: guests.firstName,
    guestLastName: guests.lastName,
  })
  .from(bookings)
  .innerJoin(
    bookingDailyDetails,
    and(
      eq(bookingDailyDetails.bookingId, bookings.id),
      eq(bookingDailyDetails.stayDate, bizDate.date),
    ),
  )
  .leftJoin(rooms, eq(bookings.roomId, rooms.id))
  .innerJoin(guests, eq(bookings.guestId, guests.id))
  .where(
    and(
      eq(bookings.propertyId, propertyId),
      eq(bookings.status, "checked_in"),
      sql`${bookings.checkOutDate} > ${bizDate.date}`,
    ),
  );
```

ВАЖНО: Сохрани ВСЕ остальные поля select, которые уже есть. Замени ТОЛЬКО источник `rateAmount`: было `bookings.rateAmount`, стало `bookingDailyDetails.rateAmount`. И добавь INNER JOIN на `bookingDailyDetails`.

После запроса roomsToCharge добавь проверку:

```typescript
// Проверить: есть ли checked_in бронирования БЕЗ daily details на сегодня
const checkedInTotal = await app.db
  .select({ count: sql<number>`count(*)` })
  .from(bookings)
  .where(
    and(
      eq(bookings.propertyId, propertyId),
      eq(bookings.status, "checked_in"),
      sql`${bookings.checkOutDate} > ${bizDate.date}`,
    ),
  );

const checkedInCount = Number(checkedInTotal[0].count);
if (checkedInCount > roomsToCharge.length) {
  warnings.push(
    `${checkedInCount - roomsToCharge.length} бронирований без посуточной разбивки на ${bizDate.date} — начисления пропущены`
  );
}
```

### Шаг 3: Изменить run — Room & Tax posting

В POST /api/night-audit/run найди запрос `checkedIn` (используется для Room & Tax charges). Он выглядит примерно так:

```typescript
const checkedIn = await tx
  .select({
    id: bookings.id,
    rateAmount: bookings.rateAmount,
    roomId: bookings.roomId,
  })
  .from(bookings)
  .where(...);
```

Замени на:

```typescript
const checkedIn = await tx
  .select({
    id: bookings.id,
    rateAmount: bookingDailyDetails.rateAmount,
    roomId: bookings.roomId,
  })
  .from(bookings)
  .innerJoin(
    bookingDailyDetails,
    and(
      eq(bookingDailyDetails.bookingId, bookings.id),
      eq(bookingDailyDetails.stayDate, bizDate.date),
    ),
  )
  .where(
    and(
      eq(bookings.propertyId, propertyId),
      eq(bookings.status, "checked_in"),
      sql`${bookings.checkOutDate} > ${bizDate.date}`,
    ),
  );
```

ВАЖНО: Остальная логика (parseFloat, shouldPostRoomCharge, ON CONFLICT DO NOTHING, цикл for) остаётся БЕЗ ИЗМЕНЕНИЙ. Меняется только ИСТОЧНИК rateAmount и добавляется JOIN.

### Шаг 4: Нет других изменений

Бронирования без daily details на дату просто не попадут в INNER JOIN → не будет charged. Это правильное поведение.

## НЕ ДЕЛАЙ
- НЕ удаляй/меняй no-show processing — он работает правильно
- НЕ меняй OOO restore logic
- НЕ меняй HK status update
- НЕ меняй business date close/open
- НЕ меняй idempotency logic (ON CONFLICT DO NOTHING)
- НЕ меняй блокировку overdue due-outs
- НЕ удаляй `shouldPostRoomCharge()` проверку
- НЕ меняй `calculateTax()` вызов
- НЕ добавляй auth/middleware
- НЕ добавляй rate-limit
- НЕ добавляй новые endpoints
- НЕ создавай новые файлы

## Проверка
```bash
cd /home/oci/pms && pnpm -r run typecheck && pnpm -r run test
```

## Критерии приёмки
- [ ] Preview берёт rateAmount из booking_daily_details (INNER JOIN)
- [ ] Run берёт rateAmount из booking_daily_details (INNER JOIN)
- [ ] Бронирования без daily details на дату — не начисляются (не ошибка)
- [ ] Preview показывает warning если есть бронирования без daily details
- [ ] Idempotency (ON CONFLICT DO NOTHING) по-прежнему работает
- [ ] No-show processing по-прежнему работает
- [ ] Все тесты проходят
- [ ] TypeScript typecheck чистый
