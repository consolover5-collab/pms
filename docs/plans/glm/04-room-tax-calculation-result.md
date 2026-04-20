# Исследование: логика расчёта Room Tax в ночном аудите

## Карта потока: ставка → применение → запись

```
properties.taxRate (DECIMAL 5,2, seed: "20.00")
       │
       ▼
night-audit.ts:202  parseFloat(property.taxRate) → taxRate: number
       │
       ▼
night-audit.ts:210–211  codes.find(c => c.code === "ROOM_TAX") → roomTaxCode
       │
       ▼  (для каждого checked_in бронирования, где checkOutDate > bizDate)
       │
night-audit.ts:359  rate = parseFloat(booking.rateAmount)
       │
       ├─► debit = String(rate)                     → ROOM transaction
       │
       └─► taxAmount = calculateTax(rate, taxRate)  → ROOM_TAX transaction
           │         packages/domain/folio.ts:33
           │         Math.round(rate × (taxRate / 100) × 100) / 100
           │
           └─► debit = String(taxAmount)
               appliedTaxRate = String(taxRate)     ← снапшот ставки
               parentTransactionId = roomCharge.id   ← связь с room charge
```

## Ответы на вопросы

### 1. Где определяется ставка Room Tax?

**`packages/domain/src/folio.ts:29–34`** — чистая функция `calculateTax(amount, taxRatePercent)`:
```ts
Math.round(amount * (taxRatePercent / 100) * 100) / 100
```

Вызывается из `night-audit.ts:388`.

### 2. Как ставка конфигурируется?

**Из БД, не хардкод.** Колонка `properties.taxRate` (`DECIMAL(5,2)`, default `"0"`, seed: `"20.00"`).
Обновляется через `PUT /api/properties/:id { taxRate: "18.00" }`.

В ночном аудите (`night-audit.ts:196–202`):
```ts
const [property] = await app.db
  .select({ taxRate: properties.taxRate })
  .from(properties)
  .where(eq(properties.id, propertyId));
const taxRate = parseFloat(property?.taxRate || "0");
```

### 3. Аналогия с Opera Transaction Codes

В Opera налог настраивается через Transaction Code с типом `tax`. У нас:
- `transaction_codes` с `code = "ROOM_TAX"`, `groupCode = "tax"` — **используется только для классификации** проводки (какой код проводки создать)
- **Сама ставка** берётся из `properties.taxRate`, не из transaction code

Это упрощение: в Opera один TC типа `tax` содержит и процент, и логику применения. У нас — ставка на уровне property, TC — только «контейнер» для проводки.

**Рекомендация:** текущая модель достаточно для MVP. Для multi-tax (городской + федеральный налог) потребуется расширение — массив tax rules на property.

### 4. Налог начисляется на Room Charge или Room Charge + пакеты?

**Только на Room Charge.** Это корректно.

Поток в `night-audit.ts:359–405`:
1. `rate = parseFloat(booking.rateAmount)` — берётся ставка номера
2. Проводка `ROOM` на сумму `rate`
3. Проводка `ROOM_TAX` на `calculateTax(rate, taxRate)` — **только от ставки номера**

Пакетные начисления (BREAKFAST и т.д.) в ночном аудите **отсутствуют** — они есть только в сид-данных как предзаполненные проводки. Налог на пакеты не начисляется.

**Это корректно** — в Opera пакеты обычно имеют собственный налоговый режим (включён в цену или отдельный TC для tax).

### 5. Сумма 4500,01 — источник дробной копейки

**Найден баг: `night-audit.ts:369`**

```ts
const rate = parseFloat(booking.rateAmount!);  // "4500.00" → 4500 (number)
// ...
debit: String(rate),  // 4500 → "4500" — теряем ".00"
```

**Проблема:** `String(rate)` форматирует JS-число без фиксированного количества знаков после точки:
- `String(4500)` → `"4500"` (теряет `.00`)
- `String(4500.01)` → `"4500.01"` (сохраняет)

Это не создаёт 0.01 само по себе, но есть второй потенциальный источник:

**Накопление ошибки в `totalRevenue`:**
```ts
totalRevenue += rate;          // JS float arithmetic
totalRevenue += taxAmount;     // JS float arithmetic
// ...
totalRevenue: Math.round(totalRevenue * 100) / 100,  // финальное округление
```

При нескольких бронированиях JavaScript float arithmetic может давать `4500.000000000001` → `String()` → `"4500.000000000001"` → PostgreSQL `DECIMAL(10,2)` округляет до `"4500.00"`. Но при определённых комбинациях значений округление может дать `"4500.01"`.

**Второй возможный источник:** бронирование создано через UI, где `rateAmount` введён или вычислен с дробной частью. В booking-form.tsx rate берётся из rate matrix (`rp.baseRate`) или вводится вручную (`<input type="number" step="0.01">`). Если rate matrix содержит `"4500.00"` и пользователь не менял поле — дробной части не будет.

### Вердикт по 4500,01

Наиболее вероятная причина — **исходный `rateAmount` бронирования уже содержал дробную копейку** (введён через UI или установлен вручную). Ночной аудит не создаёт дробных копеек из целых ставок.

## Рекомендации

### Обязательное исправление

**`night-audit.ts:369`** — использовать `toFixed(2)` вместо `String()` для записи debit:

```ts
// Было:
debit: String(rate),

// Стало:
debit: rate.toFixed(2),
```

То же для `debit: String(taxAmount)` на строке 394:
```ts
debit: taxAmount.toFixed(2),
```

Это гарантирует, что в folio_transactions всегда записывается ровно 2 знака после точки, даже если JS float даёт `4500.0000000001`.

### Улучшение (не блокер)

1. **Не использовать `parseFloat` для денежный значений.** Drizzle возвращает `decimal` как строки — передавать как есть:
   ```ts
   // Было:
   const rate = parseFloat(booking.rateAmount!);
   debit: String(rate),

   // Лучше (прямая передача строки):
   debit: booking.rateAmount!,
   ```
   Налог при этом всё равно нужно вычислять через `parseFloat`, но результат форматировать через `.toFixed(2)`.

2. **`totalRevenue`** — заменить float accumulation на строковую арифметику (bigint в копейках) или хотя бы округлять после каждой итерации:
   ```ts
   totalRevenue = Math.round((totalRevenue + rate + taxAmount) * 100) / 100;
   ```
