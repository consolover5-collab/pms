# Задача 10: Folio — posting с folioWindowId + auto-create Window 1

## Контекст
Таблица folio_windows создана (задача 09). Теперь нужно:
1. При создании бронирования — автоматически создавать Window 1 (default)
2. При posting — привязывать транзакцию к окну
3. GET folio — показывать баланс по окнам
4. Night Audit — постить в Window 1

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай ВЕСЬ файл перед изменением)
- `apps/api/src/routes/folio.ts` — ВЕСЬ файл
- `apps/api/src/routes/bookings.ts` — POST /api/bookings (create) — найди транзакцию создания
- `apps/api/src/routes/night-audit.ts` — posting (где вставляются folio_transactions)
- `packages/db/src/schema/financial.ts` — folioWindows, folioTransactions

## ПРАВИЛА
- Auth отключён — НЕ добавляй auth/middleware
- НЕ добавляй rate-limit
- НЕ используй `...spread` — только явные поля
- `pnpm -r run typecheck && pnpm -r run test` после каждого изменения

## Что сделать

### Шаг 1: Import folioWindows

Во ВСЕХ файлах, где тебе нужен `folioWindows`, добавь его в СУЩЕСТВУЮЩИЙ import из `@pms/db`. НЕ создавай отдельный import.

Файлы: `bookings.ts`, `folio.ts`, `night-audit.ts`.

Пример — в folio.ts:
```typescript
import {
  folioTransactions,
  transactionCodes,
  businessDates,
  bookings,
  folioWindows,  // ← ДОБАВИТЬ СЮДА
} from "@pms/db";
```

Также понадобится `inArray` из `drizzle-orm` в night-audit.ts (проверь, есть ли уже).

### Шаг 2: Auto-create Window 1 при создании бронирования

В `apps/api/src/routes/bookings.ts`, в POST /api/bookings, ВНУТРИ транзакции `app.db.transaction(async (tx) => { ... })`, ПОСЛЕ создания booking и daily details, ПЕРЕД return, добавь:

```typescript
// Создать default folio window
await tx.insert(folioWindows).values({
  bookingId: created.id,
  windowNumber: 1,
  label: "Основной",
  payeeType: "guest",
});
```

### Шаг 3: API для folio windows

В файле `apps/api/src/routes/folio.ts` добавь ДВА новых endpoint ПОСЛЕ существующих:

```typescript
// GET /api/bookings/:bookingId/folio/windows — список окон
app.get<{ Params: { bookingId: string } }>(
  "/api/bookings/:bookingId/folio/windows",
  async (request, reply) => {
    const { bookingId } = request.params;
    if (!isValidUuid(bookingId)) {
      return reply.status(400).send({ error: "Invalid bookingId format" });
    }
    const windows = await app.db
      .select()
      .from(folioWindows)
      .where(eq(folioWindows.bookingId, bookingId))
      .orderBy(folioWindows.windowNumber);
    return windows;
  },
);

// POST /api/bookings/:bookingId/folio/windows — создать новое окно
app.post<{
  Params: { bookingId: string };
  Body: { label: string; payeeType: string; payeeId?: string; paymentMethod?: string };
}>(
  "/api/bookings/:bookingId/folio/windows",
  async (request, reply) => {
    const { bookingId } = request.params;
    if (!isValidUuid(bookingId)) {
      return reply.status(400).send({ error: "Invalid bookingId format" });
    }
    const { label, payeeType, payeeId, paymentMethod } = request.body;

    // Определить следующий номер окна
    const existing = await app.db
      .select({ windowNumber: folioWindows.windowNumber })
      .from(folioWindows)
      .where(eq(folioWindows.bookingId, bookingId))
      .orderBy(sql`window_number DESC`)
      .limit(1);

    const nextNumber = existing.length > 0 ? existing[0].windowNumber + 1 : 1;
    if (nextNumber > 8) {
      return reply.status(400).send({ error: "Максимум 8 окон биллинга" });
    }

    const [window] = await app.db
      .insert(folioWindows)
      .values({ bookingId, windowNumber: nextNumber, label, payeeType, payeeId, paymentMethod })
      .returning();

    return reply.status(201).send(window);
  },
);
```

Добавь `sql` в import из `drizzle-orm` если его нет в folio.ts.

### Шаг 4: Posting — привязка к окну

В POST /api/bookings/:bookingId/folio/post и POST /api/bookings/:bookingId/folio/payment:

1. Добавь `folioWindowId?: string` в Body type:
```typescript
Body: {
  transactionCodeId: string;
  amount: number;
  description?: string;
  folioWindowId?: string;  // ← ДОБАВИТЬ
};
```

2. Перед insert в `folioTransactions`, добавь логику получения window:
```typescript
// Если folioWindowId не указан — использовать Window 1 (default)
let windowId = request.body.folioWindowId || null;
if (!windowId) {
  const [defaultWindow] = await app.db
    .select({ id: folioWindows.id })
    .from(folioWindows)
    .where(
      and(
        eq(folioWindows.bookingId, bookingId),
        eq(folioWindows.windowNumber, 1),
      ),
    );
  windowId = defaultWindow?.id || null;
}
```

3. В `.values({ ... })` insert добавь:
```typescript
folioWindowId: windowId,
```

Сделай это для ОБОИХ endpoints: `/folio/post` и `/folio/payment`.

### Шаг 5: Night Audit — posting в default window

В `apps/api/src/routes/night-audit.ts`, в POST /api/night-audit/run, ПЕРЕД циклом по checkedIn бронированиям (Room & Tax posting), добавь:

```typescript
// Получить default windows для всех checked_in бронирований
const defaultWindows = await tx
  .select({ bookingId: folioWindows.bookingId, id: folioWindows.id })
  .from(folioWindows)
  .where(
    and(
      inArray(folioWindows.bookingId, checkedIn.map(b => b.id)),
      eq(folioWindows.windowNumber, 1),
    ),
  );
const windowMap = new Map(defaultWindows.map(w => [w.bookingId, w.id]));
```

В КАЖДОМ `insert(folioTransactions).values({ ... })` внутри цикла (Room charge и Tax), добавь:
```typescript
folioWindowId: windowMap.get(booking.id) || null,
```

### Шаг 6: GET folio — группировка по окнам

В GET /api/bookings/:bookingId/folio:

1. В select запроса transactions добавь:
```typescript
folioWindowId: folioTransactions.folioWindowId,
```

2. После получения transactions, ПЕРЕД return, добавь:
```typescript
const windows = await app.db
  .select()
  .from(folioWindows)
  .where(eq(folioWindows.bookingId, bookingId))
  .orderBy(folioWindows.windowNumber);

const windowBalances = windows.map(w => {
  const windowTx = transactions.filter(t => t.folioWindowId === w.id);
  let charges = 0, payments = 0;
  for (const t of windowTx) {
    charges += parseFloat(t.debit) || 0;
    payments += parseFloat(t.credit) || 0;
  }
  return {
    ...w,
    balance: Math.round((charges - payments) * 100) / 100,
    totalCharges: Math.round(charges * 100) / 100,
    totalPayments: Math.round(payments * 100) / 100,
  };
});
```

3. Добавь `windows: windowBalances` в return объект.

## НЕ ДЕЛАЙ
- НЕ создавай routing rules (автоматическая маршрутизация — будущая фаза)
- НЕ добавляй auto-routing логику
- НЕ меняй adjust endpoint (adjustment наследует window от parent)
- НЕ удаляй существующие endpoints
- НЕ добавляй auth/middleware
- НЕ добавляй rate-limit
- НЕ создавай новые файлы routes

## Проверка
```bash
cd /home/oci/pms && pnpm -r run typecheck && pnpm -r run test
```

## Критерии приёмки
- [ ] При создании бронирования автоматически создаётся Window 1 (в транзакции)
- [ ] GET /api/bookings/:id/folio/windows — список окон
- [ ] POST /api/bookings/:id/folio/windows — создать окно (макс 8)
- [ ] POST charge/payment принимает optional folioWindowId
- [ ] Без folioWindowId — используется Window 1
- [ ] GET folio возвращает windows[] с балансами
- [ ] Night Audit posting привязывается к Window 1
- [ ] Все тесты проходят
- [ ] TypeScript typecheck чистый
