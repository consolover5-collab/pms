# Задача 06: Bookings create → генерация daily details

## Контекст
Таблица `booking_daily_details` и helper `generateDailyDetails()` уже созданы (задача 05).
Теперь при создании бронирования нужно автоматически генерировать записи по ночам.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай перед началом)
- `apps/api/src/routes/bookings.ts` — POST /api/bookings (около строки 176-300)
- `apps/api/src/lib/daily-details.ts` — helper функции
- `packages/db/src/schema/bookings.ts` — bookingDailyDetails schema

## Что сделать

### Шаг 1: Добавить import в bookings.ts

В начало файла `apps/api/src/routes/bookings.ts` добавь:
```typescript
import { bookingDailyDetails } from "@pms/db";
import { generateDailyDetails } from "../lib/daily-details";
```

### Шаг 2: Модифицировать POST /api/bookings

Найди в bookings.ts место где создаётся booking в транзакции (примерно строка 274):
```typescript
const booking = await app.db.transaction(async (tx) => {
  // ... confirmation number logic ...
  const [created] = await tx.insert(bookings).values({...}).returning();
  return created;
});
```

ПОСЛЕ `const [created] = await tx.insert(bookings)...` и ВНУТРИ транзакции, добавь:

```typescript
      // Генерация посуточной разбивки
      const dailyDetails = generateDailyDetails({
        bookingId: created.id,
        checkInDate: created.checkInDate,
        checkOutDate: created.checkOutDate,
        roomId: created.roomId,
        roomTypeId: created.roomTypeId,
        ratePlanId: created.ratePlanId,
        rateAmount: created.rateAmount || "0",
        adults: created.adults || 1,
        children: created.children || 0,
        marketCode: created.marketCode,
        sourceCode: created.sourceCode,
      });

      if (dailyDetails.length > 0) {
        await tx.insert(bookingDailyDetails).values(dailyDetails);
      }
```

ВАЖНО:
- Это должно быть ВНУТРИ `app.db.transaction(async (tx) => {...})`
- Используй `tx` (транзакция), НЕ `app.db`
- Если booking — day-use (checkIn === checkOut), dailyDetails будет пустой массив — это нормально

### Шаг 3: Добавить daily details в GET /api/bookings/:id

В GET /api/bookings/:id (строка 122), после получения booking, добавь запрос daily details:

```typescript
      // Получить daily details
      const details = await app.db
        .select()
        .from(bookingDailyDetails)
        .where(eq(bookingDailyDetails.bookingId, request.params.id))
        .orderBy(bookingDailyDetails.stayDate);

      return { ...booking, dailyDetails: details };
```

## НЕ ДЕЛАЙ
- НЕ меняй PUT /api/bookings/:id (это задача 07)
- НЕ меняй check-in/check-out/cancel логику
- НЕ удаляй `bookings.rateAmount` — он остаётся как дефолтное значение
- НЕ меняй Night Audit (это задача 08)
- НЕ меняй валидацию дат

## Проверка
```bash
cd /home/oci/pms && pnpm exec tsc --noEmit && pnpm test
```

Ручная проверка (если API запущен):
```bash
# Создать бронирование и проверить daily details
# POST /api/bookings → должен вернуть booking
# GET /api/bookings/:id → должен содержать dailyDetails[]
```

## Критерии приёмки
- [ ] POST /api/bookings создаёт daily details в той же транзакции
- [ ] GET /api/bookings/:id возвращает dailyDetails[]
- [ ] Day-use booking (checkIn === checkOut) не создаёт daily details (пустой массив)
- [ ] 3-ночное бронирование создаёт 3 записи daily details
- [ ] Все существующие тесты проходят
- [ ] TypeScript typecheck чистый
