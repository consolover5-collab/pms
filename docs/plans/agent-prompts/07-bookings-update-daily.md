# Задача 07: Room move → обновить daily details

## Что уже сделано (НЕ делать повторно)
- ✅ PUT /bookings/:id — пересоздаёт daily details при изменении дат/тарифа (строка 520-553 в bookings.ts)
- ✅ Check-in — копирует roomId во все daily details (строка 693-697 в bookings.ts)

## Что осталось
Только **room-move** — при переселении нужно обновить roomId в daily details для оставшихся ночей.

## Файлы для чтения
- `apps/api/src/routes/bookings.ts` — найди endpoint POST /api/bookings/:id/room-move

## Что сделать

Найди room-move endpoint в bookings.ts. Внутри транзакции, ПОСЛЕ обновления `bookings.roomId`, добавь:

```typescript
// Обновить roomId в daily details для оставшихся ночей
const bizDate = await getBusinessDate(tx, booking.propertyId);
await tx
  .update(bookingDailyDetails)
  .set({ roomId: newRoomId, updatedAt: new Date() })
  .where(
    and(
      eq(bookingDailyDetails.bookingId, booking.id),
      gte(bookingDailyDetails.stayDate, bizDate),
    ),
  );
```

Нужен import `gte` из `drizzle-orm` если его нет.

## НЕ ДЕЛАЙ
- НЕ трогай check-in — он уже обновляет daily details
- НЕ трогай PUT /bookings/:id — он уже пересоздаёт daily details
- НЕ трогай check-out
- НЕ трогай auth
- НЕ добавляй rate-limit

## Проверка
```bash
pnpm -r run typecheck && pnpm -r run test
```

## Критерии приёмки
- [ ] Room move обновляет roomId в daily details для ночей >= бизнес-дата
- [ ] Прошлые ночи (до бизнес-даты) сохраняют старый roomId
- [ ] Typecheck чистый, тесты проходят
