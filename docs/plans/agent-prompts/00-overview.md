# Agent Prompts — Overview

16 промптов для пошагового создания MVP PMS.
Каждый промпт — самодостаточный, содержит контекст, паттерны, конкретные шаги и критерии приёмки.

## Порядок выполнения (СТРОГИЙ)

```
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16
```

| # | Файл | Описание | Зависит от |
|---|------|----------|-----------|
| 01 | `01-auth-enable.md` | Включить auth middleware | — |
| 02 | `02-input-whitelists.md` | Explicit field whitelists на routes | — |
| 03 | `03-companies-ta-schema.md` | Таблицы companies + travel_agents | — |
| 04 | `04-companies-ta-api.md` | CRUD API для companies и TA | 03 |
| 05 | `05-daily-details-schema.md` | Таблица booking_daily_details + seed | — |
| 06 | `06-bookings-create-daily.md` | Генерация daily details при создании | 05 |
| 07 | `07-bookings-update-daily.md` | Update/extend/room-move → daily details | 06 |
| 08 | `08-night-audit-daily.md` | Night Audit из daily details | 05 |
| 09 | `09-folio-windows-schema.md` | Таблица folio_windows | — |
| 10 | `10-folio-windows-posting.md` | Folio posting с windowId | 09 |
| 11 | `11-cashier-sessions.md` | Кассирские смены | 01 |
| 12 | `12-packages.md` | Пакеты (schema + API + night audit) | 05, 08 |
| 13 | `13-hk-tasks.md` | HK задания (schema + API) | — |
| 14 | `14-bookings-company-ta.md` | companyId/travelAgentId в bookings | 03 |
| 15 | `15-seed-update.md` | Обновление seed data | 03-14 |
| 16 | `16-tests-update.md` | Обновление integration tests | 01-15 |

## Правила для агента

1. **Прочитай файлы** перед изменением — НИКОГДА не пиши код не прочитав существующий
2. **pnpm test** после каждого изменения — если красное, фикси
3. **pnpm exec tsc --noEmit** — typecheck должен быть чистый
4. **Не добавляй** то, что не указано в промпте
5. **Не удаляй** существующий функционал
6. **Русские ошибки** для бизнес-валидации, английские для системных
7. **Не используй** vendor-specific термины Oracle/Opera в коде
