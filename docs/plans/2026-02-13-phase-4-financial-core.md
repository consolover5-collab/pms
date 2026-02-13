# Phase 4 — Financial Core: Business Date + Folio + Night Audit v2

> Дизайн-документ. Основан на анализе Opera DB (OPERA1, отель HA336) и Oracle Opera Help V5.6.
> Дата: 2026-02-13
> Adversarial review: пройден, 12 находок исправлены.

---

## 1. Обзор

Текущая система не имеет финансового ядра. Night Audit — заглушка (no-show + sync). Нет понятия бизнес-даты, фолио, транзакций.

**Цель**: добавить 3 таблицы + обновить Night Audit, чтобы система могла:
1. Вести бизнес-дату (не `new Date()`)
2. Начислять за номер (room charge) автоматически
3. Принимать оплату (cash, card)
4. Закрывать день и переходить к следующему

**Принцип**: MVP — минимум, но правильная архитектура. Расширяемо без ломки.

### Предварительные требования (prerequisites)

Перед реализацией Phase 4 необходимо:
- **Исправить PUT /bookings security hole** — убрать `...request.body` spread (строка ~253 в bookings.ts), использовать явный whitelist полей. Без этого новые поля (totalAmount, etc.) доступны для атаки через PUT.

---

## 2. Что узнали из Opera DB

### 2.1 Business Date (таблица BUSINESSDATE)
- **1 открытая дата** на отель в любой момент. Все остальные — CLOSED.
- HA336: 1569 closed (2018-06-06 → 2022-09-21), 1 open (2022-09-22)
- Поля: `RESORT`, `BUSINESS_DATE`, `STATE` (OPEN/CLOSED), `LEDGERS_BALANCED_YN`, `PMS_ACTIVE_YN`
- Бизнес-дата меняется ТОЛЬКО после Night Audit, НЕ в полночь

### 2.2 Transaction Codes (таблица TRX$_CODES, 565 записей)
- Иерархия: `TC_GROUP` → `TC_SUBGROUP` → `TRX_CODE`
- Группы для HA336:

| TC_GROUP | Назначение | Кол-во кодов | TC_TRANSACTION_TYPE |
|----------|-----------|-------------|---------------------|
| RO | Room Revenue | 42 | C (Charge) |
| FB | Food & Beverage | 26+ | C |
| MI | Miscellaneous (вкл. налоги) | 80+ | C |
| PM | Payments | 110 | FC (Financial Credit) |
| BQ | Banquet | 8+ | C |
| NO | Non-Revenue | 21 | C |
| IR | Internal | 6 | C |
| IP | Internal Payment | 1 | FC |
| WP | Wrapper/Package | 1 | PK |

- Ключевые коды Room Revenue (RO/R10):
  - `1000` = Accommodation (основной, ADJ=6000)
  - `1003` = Extra Bed, `1004` = No Show, `1008` = Day Use, `1009` = Late Departure
  - `6000`-`6070` = Adjustment коды

- Ключевые Payment коды (PM/P10):
  - `9000` = Cash, `9100` = Visa, `9104` = Mastercard
  - CASHIER_ID=999 — системный кассир Night Audit

- Налог: код `7500` = VAT (TC_GROUP=MI), генерируется автоматически при room charge (TAX_GENERATED_YN='Y')

### 2.3 Financial Transactions (130+ колонок)
- Каждая транзакция привязана к `BUSINESS_DATE` (NOT NULL)
- `FOLIO_VIEW` = окно фолио (1-8)
- Opera использует **раздельные колонки** `GUEST_ACCOUNT_DEBIT` / `GUEST_ACCOUNT_CREDIT` (а не одно signed поле)
- Room charges (1000): суммы 4067-6100 RUB, FOLIO_VIEW=1, CASHIER_ID=999

### 2.4 Night Audit (NIGHT_AUDIT$_PROCEDURES)
Обязательные процедуры в порядке выполнения:

| Seq | Процедура | Действие |
|-----|-----------|----------|
| -100 | reservation.no_show | Пометить неприехавших |
| -99 | synchronize_fo_status | Синхронизация статусов |
| -98 | hkpkg.update_room_status | Обновить HK статусы |
| -97 | refresh_fin_summary | Guest Ledger |
| -96 | populate_trial_balance | Trial Balance |
| -95 | update_statistics | Статистика |
| 23 | populate_grand_totals | Folio Grand Totals |
| 25 | POST_ROOM_AND_TAX | Начисление за номер + налог |

---

## 3. Схема БД (новые таблицы)

### 3.1 business_dates

```typescript
// packages/db/src/schema/financial.ts

import { pgTable, uuid, date, varchar, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const businessDates = pgTable("business_dates", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  date: date("date").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  // "open" | "closed"
  closedAt: timestamp("closed_at"),
  closedBy: uuid("closed_by"),  // userId, когда будет auth
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("uq_business_date_property").on(table.propertyId, table.date),
  // FIX #1: Partial unique index — гарантия ровно 1 open даты на property на уровне БД
  uniqueIndex("uq_one_open_business_date_per_property")
    .on(table.propertyId)
    .where(sql`status = 'open'`),
]);
```

**Правила:**
- На один property — ровно одна `status='open'` запись (гарантировано partial unique index на уровне БД)
- При Night Audit: текущая → `closed`, создаётся следующая `open`
- Все API используют бизнес-дату, не `new Date()`

### 3.2 transaction_codes

```typescript
export const transactionCodes = pgTable("transaction_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  code: varchar("code", { length: 20 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  groupCode: varchar("group_code", { length: 10 }).notNull(),
  // "ROOM" | "PAYMENT" | "TAX" | "FB" | "MISC" | "ADJUSTMENT"
  transactionType: varchar("transaction_type", { length: 10 }).notNull(),
  // "charge" (дебет гостю) | "payment" (кредит гостю)
  isManualPostAllowed: boolean("is_manual_post_allowed").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  // FIX #9: Ссылка на adjustment-код для данного revenue-кода
  adjustmentCodeId: uuid("adjustment_code_id"),
  // self-reference: ROOM → ADJ_ROOM, EXTRA_BED → ADJ_ROOM, etc.
  // nullable: у adjustment-кодов и payment-кодов нет своего adjustment
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("uq_trx_code_property").on(table.propertyId, table.code),
]);
// Примечание: adjustmentCodeId — self-FK на transactionCodes.id.
// Drizzle не поддерживает self-reference в .references(), добавим через raw SQL:
// ALTER TABLE transaction_codes ADD CONSTRAINT fk_adjustment_code
//   FOREIGN KEY (adjustment_code_id) REFERENCES transaction_codes(id);
```

**Seed-данные (MVP)**:

| code | description | groupCode | transactionType | isManualPostAllowed | adjustmentCodeId |
|------|-------------|-----------|-----------------|---------------------|------------------|
| ADJ_ROOM | Room Adjustment | ADJUSTMENT | charge | true | null |
| ADJ_FB | F&B Adjustment | ADJUSTMENT | charge | true | null |
| ROOM | Room Charge | ROOM | charge | false | → ADJ_ROOM |
| ROOM_TAX | Room Tax (VAT) | TAX | charge | false | null |
| EXTRA_BED | Extra Bed | ROOM | charge | true | → ADJ_ROOM |
| NO_SHOW | No Show Charge | ROOM | charge | false | → ADJ_ROOM |
| PAY_CASH | Cash Payment | PAYMENT | payment | true | null |
| PAY_CARD | Card Payment | PAYMENT | payment | true | null |
| PAY_TRANSFER | Bank Transfer | PAYMENT | payment | true | null |
| FB_REST | Restaurant | FB | charge | true | → ADJ_FB |
| FB_BAR | Bar | FB | charge | true | → ADJ_FB |
| MINIBAR | Minibar | MISC | charge | true | → ADJ_FB |

Порядок seed: сначала ADJ_* коды (без adjustmentCodeId), затем остальные (с ссылкой на ADJ_*).

### 3.3 folio_transactions

```typescript
export const folioTransactions = pgTable("folio_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id),
  businessDateId: uuid("business_date_id")
    .notNull()
    .references(() => businessDates.id),
  transactionCodeId: uuid("transaction_code_id")
    .notNull()
    .references(() => transactionCodes.id),
  folioWindow: integer("folio_window").notNull().default(1),
  // 1-8, по аналогии с Opera

  // FIX #7: Раздельные debit/credit вместо signed amount.
  // Ровно одно из двух должно быть > 0, второе = 0.
  // Charge (гость должен) → debit > 0, credit = 0
  // Payment (гость платит) → debit = 0, credit > 0
  debit: decimal("debit", { precision: 10, scale: 2 }).notNull().default("0"),
  credit: decimal("credit", { precision: 10, scale: 2 }).notNull().default("0"),

  quantity: integer("quantity").notNull().default(1),
  description: varchar("description", { length: 500 }),
  isSystemGenerated: boolean("is_system_generated").notNull().default(false),
  // true для Night Audit charges

  // FIX #10: Сохраняем налоговую ставку на момент posting (иммутабельная запись)
  appliedTaxRate: decimal("applied_tax_rate", { precision: 5, scale: 2 }),
  // Заполняется только для TAX-транзакций: ставка, которая была на момент начисления

  parentTransactionId: uuid("parent_transaction_id"),
  // для tax generates и adjustments — ссылка на родительскую транзакцию
  // FIX #6: Однонаправленная связь. Reversal ссылается на оригинал через parentTransactionId.
  // Тип reversal определяется по transactionCode (ADJ_*) + isSystemGenerated.
  // НЕТ обратной ссылки на оригинале — append-only, оригинальная запись не мутируется.

  postedBy: varchar("posted_by", { length: 100 }),
  // "NIGHT_AUDIT" | "user:xxx" | "SYSTEM"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Принципы (обновлённые):**

- **Debit/Credit модель** (как в Opera): `debit > 0` = charge гостю, `credit > 0` = оплата от гостя
- Баланс фолио = `SUM(debit) - SUM(credit)`. Ноль = фолио закрыто. Положительный = гость должен.
- **Append-only**: записи никогда не мутируются после создания. Сторнирование = новая запись с `parentTransactionId → оригинал` и обратным debit/credit.
- `parentTransactionId` связывает: (a) налог → room charge, (b) adjustment → оригинал
- Различаем тип связи по `transactionCode.groupCode`: TAX = налог, ADJUSTMENT = сторно
- **appliedTaxRate** фиксирует ставку на момент posting — защита от смены ставки

---

## 4. API Endpoints

### 4.1 Business Date

```
GET  /api/business-date?propertyId=xxx
     → { id, propertyId, date, status }

POST /api/business-date/initialize
     Body: { propertyId, date }
     → Создать первую бизнес-дату (одноразово при настройке)
```

### 4.2 Folio / Transactions

```
GET  /api/bookings/:bookingId/folio
     → { balance, transactions: [...], summary: { totalCharges, totalPayments } }

POST /api/bookings/:bookingId/folio/post
     Body: { transactionCodeId, amount, quantity?, description?, folioWindow? }
     → Ручное начисление (проверка: isManualPostAllowed, бизнес-дата open)
     → amount записывается в debit (для charge) или credit (для payment) в зависимости от transactionType кода

POST /api/bookings/:bookingId/folio/payment
     Body: { transactionCodeId, amount, description? }
     → Оплата: amount записывается в credit

POST /api/bookings/:bookingId/folio/adjust
     Body: { transactionId, reason }
     → Полное сторно: создать зеркальную запись (debit↔credit) с parentTransactionId → оригинал
     → transactionCode берётся из adjustmentCodeId оригинального кода
     → Ошибка если у кода нет adjustmentCodeId
```

### 4.3 Night Audit v2

```
POST /api/night-audit/preview?propertyId=xxx
     → Превью: что будет сделано (без выполнения)
     → { businessDate, dueOuts, pendingNoShows, roomsToCharge, estimatedRevenue, warnings }

POST /api/night-audit/run
     Body: { propertyId }
     → Полный цикл Night Audit (весь процесс в ОДНОЙ DB-транзакции):

     Шаг 1: Проверки (pre-checks)
       - Есть ли незакрытые checked_in с checkOutDate < businessDate? (due outs → warning)
       - Есть ли confirmed с checkInDate < businessDate? (no shows)

     Шаг 2: Idempotency guard
       - Проверить: есть ли уже folio_transactions с businessDateId = текущая
         AND transactionCode = ROOM AND isSystemGenerated = true?
       - Если да → вернуть ошибку "Night Audit already ran for this business date"

     Шаг 3: No-Show processing
       - confirmed + checkInDate < businessDate → status = "no_show"

     Шаг 4: Room & Tax posting
       - Для каждого checked_in бронирования:
         - Создать folio_transaction ROOM: debit = rateAmount, credit = 0
         - Если property.taxRate > 0:
           - taxAmount = roundToTwo(rateAmount * taxRate / 100)
           - Создать folio_transaction ROOM_TAX: debit = taxAmount, credit = 0,
             appliedTaxRate = taxRate, parentTransactionId → ROOM transaction
         - isSystemGenerated = true, postedBy = "NIGHT_AUDIT"

     Шаг 5: HK Status update
       - Occupied rooms → housekeepingStatus = "dirty"

     Шаг 6: Sync room status
       - (существующая логика)

     Шаг 7: Close business date + open next
       - UPDATE business_dates SET status='closed', closedAt=now() WHERE id = currentId
       - INSERT business_dates (propertyId, date+1, status='open')
       - Partial unique index гарантирует что не будет 2 open дат

     → Если ЛЮБОЙ шаг падает — вся транзакция откатывается, бизнес-дата остаётся open.

     Response: {
       businessDate: "2026-02-13",
       nextBusinessDate: "2026-02-14",
       noShows: 2,
       roomChargesPosted: 45,
       taxChargesPosted: 45,
       roomsUpdated: 45,
       totalRevenue: 125000.00
     }
```

**Важно:**
- Preview — это POST (не GET), т.к. содержит propertyId в query string и выполняет вычисления, но можно и GET с query param — решение: **POST** `/api/night-audit/preview` с query `?propertyId=xxx` (без body на GET).
- Run — строго одна DB-транзакция (все шаги или ничего).

---

## 5. Domain Logic (packages/domain)

### 5.1 Folio Balance

```typescript
// packages/domain/src/folio.ts

export interface FolioTransaction {
  debit: number;
  credit: number;
}

export function calculateFolioBalance(transactions: FolioTransaction[]): number {
  // Положительный баланс = гость должен, отрицательный = переплата
  return transactions.reduce(
    (sum, t) => sum + Number(t.debit) - Number(t.credit),
    0
  );
}

export function canCheckOut(balance: number): boolean {
  // Баланс должен быть 0 или отрицательный (переплата)
  return balance <= 0;
}

// FIX #3: Правильная формула расчёта налога
export function calculateTax(amount: number, taxRatePercent: number): number {
  // taxRatePercent = 20 означает 20%
  // Округление до 2 знаков (копейки)
  return Math.round(amount * taxRatePercent) / 100;
}
```

### 5.2 Night Audit Eligibility

```typescript
// packages/domain/src/night-audit.ts

export interface NightAuditPreCheck {
  canRun: boolean;
  alreadyRan: boolean;     // idempotency: room charges уже есть за эту дату
  dueOuts: number;          // checked_in с checkOutDate <= businessDate
  pendingNoShows: number;   // confirmed с checkInDate < businessDate
  roomsToCharge: number;    // checked_in бронирований для room charge
  warnings: string[];
}

export function evaluateNightAudit(preCheck: Omit<NightAuditPreCheck, 'canRun'>): NightAuditPreCheck {
  const warnings: string[] = [...preCheck.warnings];

  // FIX #5: Блокировка если уже выполнялся
  if (preCheck.alreadyRan) {
    return { ...preCheck, canRun: false, warnings: ["Night Audit already completed for this business date"] };
  }

  if (preCheck.dueOuts > 0) {
    warnings.push(`${preCheck.dueOuts} due out(s) not checked out — will remain as checked_in`);
  }

  return { ...preCheck, canRun: true, warnings };
}
```

---

## 6. Интеграция с существующим кодом

### 6.1 Изменения в bookings

- **Check-out**: проверять баланс фолио (`SUM(debit) - SUM(credit) <= 0`) перед выселением
- **`totalAmount`**: оставить как **хранимое поле** в таблице `bookings`. Пересчитывать при каждом posting/payment (`SUM(debit) WHERE transactionType=charge`). Это кеш для быстрого отображения в списках без JOIN на folio_transactions. При расхождении — folio_transactions является source of truth.
- **PUT /bookings**: (prerequisite) заменить `...request.body` spread на явный whitelist: `{ checkInDate, checkOutDate, roomTypeId, ratePlanId, guestId, roomId, adults, children, notes }`. Поля `status`, `totalAmount`, `confirmationNumber` — read-only через PUT.

### 6.2 Изменения в night-audit.ts
- Полная замена текущей заглушки на Night Audit v2
- Использовать бизнес-дату вместо `new Date()`
- Вся операция — в `app.db.transaction(async (tx) => { ... })`

### 6.3 Изменения в dashboard
- Показывать текущую бизнес-дату в хедере
- Кнопка "Run Night Audit" (пока без полноценного UI)

### 6.4 Seed данные
- Создать начальную бизнес-дату для property
- Создать базовые transaction codes (12 кодов из таблицы выше, ADJ_* первыми)

### 6.5 Миграция существующих данных

Существующие бронирования (Phase 3) не имеют folio-транзакций. Стратегия:

1. **Business Date**: seed создаёт одну `open` дату = сегодня. Предыдущие даты НЕ создаём (нет ретроактивных данных).
2. **Checked-in бронирования**: у них `rateAmount` уже заполнен. При первом Night Audit после миграции — они получат room charge только за текущую бизнес-дату (не ретроактивно за все прошлые ночи).
3. **totalAmount**: оставить текущие значения как есть. После первого Night Audit — folio_transactions станет source of truth для новых начислений.
4. **Никаких ретроактивных charges**: если бронирование было checked_in 3 дня назад, мы НЕ создаём задним числом folio_transactions за пропущенные ночи. Это осознанное решение — чистый старт финансового модуля.

---

## 7. Конфигурация налогов (MVP)

Для MVP — один налог (VAT), ставка в property:

```typescript
// Добавить в properties:
taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
// 20.00 = 20% VAT
```

При room charge posting:
1. Создать ROOM charge: `debit = rateAmount`
2. Если `taxRate > 0`:
   - `taxAmount = Math.round(rateAmount * taxRate) / 100`
   - Создать ROOM_TAX charge: `debit = taxAmount`, `appliedTaxRate = taxRate`
   - `parentTransactionId` → ID room charge транзакции

**Защита от смены ставки (FIX #10):** Каждая TAX-транзакция в `folio_transactions` хранит `appliedTaxRate` — ставку на момент posting. При изменении `property.taxRate` старые записи сохраняют историческую ставку. Отчёты берут ставку из `folio_transactions.appliedTaxRate`, а не из `properties.taxRate`.

Позже: отдельная таблица `tax_rates` с несколькими налогами, periods, effective dates.

---

## 8. Порядок реализации

### Prerequisite: Fix PUT /bookings (30 мин)
1. Заменить `...request.body` spread на whitelist полей
2. Добавить Zod-схему для body validation

### Layer 0: Business Date (1-2 часа)
1. Схема `business_dates` + миграция (включая partial unique index)
2. Seed: одна open дата = сегодня
3. API: GET + initialize
4. Хелпер `getCurrentBusinessDate(propertyId)`

### Layer 1: Transaction Codes + Folio (2-3 часа)
1. Схема `transaction_codes` + `folio_transactions` + миграция
2. Self-FK для adjustmentCodeId (raw SQL migration)
3. Seed: 12 базовых кодов (ADJ_* первыми)
4. API: GET folio, POST charge, POST payment, POST adjust
5. Domain: balance calculation (debit/credit модель)

### Layer 2: Night Audit v2 (2-3 часа)
1. Переписать night-audit.ts полностью
2. Всё в одной DB-транзакции
3. Idempotency guard: проверка ROOM charges за текущую бизнес-дату
4. Шаги: no-show → room+tax posting → HK update → sync → close date → open next
5. API: preview (POST с query param) + run
6. `taxRate` поле в properties + `appliedTaxRate` в folio_transactions

### Layer 3: UI (2-3 часа)
1. Бизнес-дата в хедере
2. Folio tab на странице бронирования (debit/credit колонки, баланс)
3. Night Audit page (preview + run button)
4. Простая форма для ручного начисления

---

## 9. Что НЕ входит в MVP

- Multi-window folio routing (всё идёт в window 1)
- Cashier open/close
- Deposit ledger
- AR (Accounts Receivable)
- Multi-currency
- Folio printing/PDF
- Commission processing
- Tax-inclusive pricing (все цены — net)
- Несколько налогов
- Частичное сторно (только полное через adjust)
