# Задача: Исправить schema booking_daily_details — добавить FK и NOT NULL

## Что сделать

Открой файл `packages/db/src/schema/booking-daily-details.ts` и сделай 2 изменения:

### Изменение 1: ratePlanId — добавить FK

Найди:
```typescript
ratePlanId: uuid("rate_plan_id"),
```

Замени на:
```typescript
ratePlanId: uuid("rate_plan_id")
  .references(() => ratePlans.id, { onDelete: "restrict" }),
```

`ratePlans` уже импортирован в этом файле из `"./bookings"`. НЕ добавляй `.notNull()` — ratePlanId должен оставаться nullable.

### Изменение 2: rateAmount — добавить NOT NULL

Найди:
```typescript
rateAmount: decimal("rate_amount", { precision: 10, scale: 2 }),
```

Замени на:
```typescript
rateAmount: decimal("rate_amount", { precision: 10, scale: 2 }).notNull(),
```

### После изменений

1. Typecheck:
```bash
cd /home/oci/pms && pnpm -r run typecheck
```

2. Миграция:
```bash
cd /home/oci/pms/packages/db && source ../../.env && pnpm exec drizzle-kit push
```

3. Тесты:
```bash
cd /home/oci/pms && pnpm -r run test
```

Если typecheck покажет ошибку `Type 'string | null' is not assignable to type 'string'` — найди место где передаётся `rateAmount: null` и замени на `rateAmount: resolvedRate || "0"`.

Если миграция упадёт с "column contains null values" — выполни:
```sql
UPDATE booking_daily_details SET rate_amount = '0' WHERE rate_amount IS NULL;
```

## Запреты

- НЕ меняй никакие другие файлы кроме `packages/db/src/schema/booking-daily-details.ts`
- НЕ добавляй auth, rate-limit, middleware
- НЕ создавай новые файлы
