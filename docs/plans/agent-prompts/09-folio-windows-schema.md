# Задача 09: Schema — folio_windows + folioWindowId в folio_transactions

## Контекст
Окно биллинга (folio window) — разделение счёта. Окно 1 = гость, окно 2 = компания и т.д.
Создаём таблицу и добавляем FK в folio_transactions.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай ВЕСЬ файл перед изменением)
- `packages/db/src/schema/financial.ts` — folioTransactions, businessDates, transactionCodes
- `packages/db/src/schema/bookings.ts` — bookings (для FK)
- `packages/db/src/schema/index.ts`

## ПРАВИЛА
- Auth отключён — НЕ добавляй auth/middleware
- НЕ добавляй rate-limit
- НЕ меняй routes (это задача 10)
- `pnpm -r run typecheck && pnpm -r run test` после каждого изменения

## Что сделать

### Шаг 1: Добавить таблицу folio_windows в financial.ts

В файл `packages/db/src/schema/financial.ts`, **ПЕРЕД** определением `folioTransactions` (сейчас на строке 73), добавь:

```typescript
// Окна биллинга — разделение счёта (1-8 окон на бронирование)
export const folioWindows = pgTable("folio_windows", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "restrict" }),
  windowNumber: integer("window_number").notNull(),
  label: varchar("label", { length: 100 }).notNull().default("Основной"),
  /** 'guest' | 'company' | 'travel_agent' */
  payeeType: varchar("payee_type", { length: 20 }).notNull().default("guest"),
  payeeId: uuid("payee_id"),  // FK на companies или travel_agents (не строгий — разные таблицы)
  paymentMethod: varchar("payment_method", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("folio_windows_booking_window").on(table.bookingId, table.windowNumber),
  index("folio_windows_booking_id_idx").on(table.bookingId),
]);
```

ВАЖНО: folio_windows ДОЛЖНО быть объявлено ПЕРЕД folioTransactions, иначе FK не будет работать.

Тебе может понадобиться добавить `unique` и `index` в import из `drizzle-orm/pg-core` если их нет. Проверь существующий import в начале файла — `unique` и `index` уже должны быть.

### Шаг 2: Добавить folioWindowId в folioTransactions

В определение `folioTransactions` (после поля `bookingId`), добавь ОДНО новое поле:

```typescript
  folioWindowId: uuid("folio_window_id")
    .references(() => folioWindows.id, { onDelete: "restrict" }),
```

Это поле nullable — обратная совместимость с существующими записями.

### Шаг 3: Экспорт

В `packages/db/src/schema/index.ts` — ничего менять НЕ нужно. `folioWindows` экспортируется через `export * from "./financial"` автоматически.

### Шаг 4: Typecheck

```bash
cd /home/oci/pms && pnpm -r run typecheck
```

### Шаг 5: Применить миграцию

```bash
cd /home/oci/pms && pnpm exec drizzle-kit push
```

Ответь `yes` если спросит подтверждение.

### Шаг 6: Тесты

```bash
cd /home/oci/pms && pnpm -r run test
```

## НЕ ДЕЛАЙ
- НЕ меняй логику в folio.ts (это задача 10)
- НЕ создавай auto-create Window 1 логику (это задача 10)
- НЕ добавляй routing rules
- НЕ создавай новые файлы — всё в financial.ts
- НЕ меняй существующие поля folioTransactions
- НЕ добавляй auth/middleware
- НЕ добавляй rate-limit

## Критерии приёмки
- [ ] Таблица `folio_windows` добавлена в financial.ts ПЕРЕД folioTransactions
- [ ] `folioTransactions.folioWindowId` добавлен (nullable FK)
- [ ] UNIQUE constraint на (booking_id, window_number)
- [ ] TypeScript typecheck чистый
- [ ] Все тесты проходят (folioWindowId nullable = обратная совместимость)
