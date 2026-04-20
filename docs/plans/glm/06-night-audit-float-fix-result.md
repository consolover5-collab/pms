# Результат: исправление float-арифметики в ночном аудите

## Исправления в `apps/api/src/routes/night-audit.ts`

| # | Было | Стало | Строка |
|---|------|-------|--------|
| 1 | `debit: String(rate)` | `debit: booking.rateAmount!` | 369 |
| 2 | `debit: String(taxAmount)` | `debit: taxAmount.toFixed(2)` | 394 |
| 3 | `totalRevenue += rate` | `totalRevenue = Math.round((totalRevenue + rate) * 100) / 100` | 384 |
| 4 | `totalRevenue += taxAmount` | `totalRevenue = Math.round((totalRevenue + taxAmount) * 100) / 100` | 404 |

## Typecheck

`tsc --noEmit` — 0 ошибок.
