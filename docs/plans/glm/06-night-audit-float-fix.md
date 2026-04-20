# Промт для GLM: исправление float-арифметики в ночном аудите

## Контекст

Файл: `apps/api/src/routes/night-audit.ts`

Проведено исследование логики расчёта Room Tax. Найдены два бага с форматированием денежных значений при записи в `folio_transactions.debit` (колонка `DECIMAL(10,2)`):

1. `String(rate)` — JS-число без фиксации знаков после точки: `String(4500)` → `"4500"` вместо `"4500.00"`. При определённых значениях JS float arithmetic может давать `4500.000000000001`.
2. `String(taxAmount)` — та же проблема для суммы налога.
3. `totalRevenue` накапливается через `+=` без промежуточного округления — float drift при нескольких бронированиях.

## Задача

Внести три точечных исправления в `apps/api/src/routes/night-audit.ts`. Больше ничего не менять.

---

### Исправление 1 — строка 369

**Было:**
```typescript
debit: String(rate),
```

**Стало:**
```typescript
debit: booking.rateAmount!,
```

Объяснение: `booking.rateAmount` — это уже строка из Drizzle (`DECIMAL` возвращается как `string`). Использовать её напрямую вместо `parseFloat → String` — надёжнее и без потери точности.

---

### Исправление 2 — строка 394

**Было:**
```typescript
debit: String(taxAmount),
```

**Стало:**
```typescript
debit: taxAmount.toFixed(2),
```

`taxAmount` вычисляется через `calculateTax` (float math) — здесь `toFixed(2)` обязателен.

---

### Исправление 3 — строки 384 и 404

**Было:**
```typescript
totalRevenue += rate;          // строка 384
// ...
totalRevenue += taxAmount;     // строка 404
```

**Стало:**
```typescript
totalRevenue = Math.round((totalRevenue + rate) * 100) / 100;          // строка 384
// ...
totalRevenue = Math.round((totalRevenue + taxAmount) * 100) / 100;     // строка 404
```

---

## Проверка

После изменений:
```bash
cd apps/api && npx tsc --noEmit
```

Ожидание: 0 ошибок.

## Отчёт

Сохрани краткий отчёт в `docs/plans/glm/06-night-audit-float-fix-result.md`:
- подтверждение трёх исправлений
- результат typecheck
