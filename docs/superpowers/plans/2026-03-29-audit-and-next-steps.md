# PMS Audit & Next Steps — 2026-03-29

## Текущее состояние

**Проект работает.** API (Fastify :3001) + Web (Next.js :3000) запущены, все 10 страниц отвечают 200, все 47 тестов (29 unit + 18 integration) зелёные, typecheck чистый.

- 15K LOC TypeScript, 97 файлов, 83 коммита, 12 таблиц БД
- GitHub: consolover5-collab/pms (public)
- Seed data: 1 отель (GBH), 54 номера, 11 гостей, 13 бронирований

## Найденные проблемы

### Исправлено в этой сессии
- [x] Unit test `validateBookingDates` — ожидал ошибку для day-use (checkIn==checkOut), но код уже разрешает это с коммита `8c57257`
- [x] `.env.example` не содержал всех переменных — дополнен

### Требует исправления (Important)

#### I-01. `...request.body` spread в mutations
**Файлы:** `rate-plans.ts:108`, `guests.ts:92,120`, `transaction-codes.ts:89`
**Проблема:** Spread `request.body` напрямую в `.set()` / `.values()` позволяет клиенту передать произвольные поля (id, createdAt, propertyId). Drizzle отфильтрует неизвестные колонки, но это неявная защита.
**Решение:** Explicit field whitelist — деструктурировать нужные поля.

#### I-02. propertyId не валидируется как UUID в ряде GET-эндпоинтов
**Файлы:** Большинство GET-роутов берут `propertyId` из query без `isValidUuid()`.
**Проблема:** Невалидный UUID передаётся в SQL WHERE, что приводит к 500 (UNDEFINED_VALUE) вместо 400.
**Решение:** Добавить `if (!propertyId || !isValidUuid(propertyId)) return reply.status(400)` на все GET-эндпоинты.

#### I-03. Нет CORS конфигурации
**Файл:** `apps/api/src/server.ts`
**Проблема:** Фронтенд на :3000 обращается к API на :3001 — CORS не настроен (работает только потому что Next.js SSR делает запросы server-side).
**Решение:** `@fastify/cors` с whitelist origin.

#### I-04. Нет loading/not-found/error boundaries в Next.js
**Проблема:** Нет `loading.tsx` (нет skeleton screens), нет `not-found.tsx` (стандартная 404).
**Решение:** Добавить базовые loading.tsx и not-found.tsx в app/.

#### I-05. Тесты оставляют данные в БД
**Проблема:** integration tests создают бронирования/гостей и не чистят за собой (11 гостей вместо 10, 13 букингов вместо 10).
**Решение:** Добавить cleanup в afterEach или использовать транзакцию-rollback.

### Желательные улучшения (Minor)

#### M-01. Нет README.md
Публичный репо на GitHub без README. Нужен минимальный с описанием, stack, как запустить.

#### M-02. `docs/project-context.md` — устаревшие версии
Указан Next.js 16.1.6, но реальная версия может отличаться (Node.js 25 установлен, а в доке — 22 LTS).

#### M-03. Нет health-check для web
API имеет `/health`, web — нет. Для мониторинга полезно.

#### M-04. Бизнес-дата в seed — `2026-02-22`
Фиксированная дата в seed не совпадает с текущей. Night audit требует ручного продвижения.

#### M-05. Auth отключён
Код есть, но middleware не применяется. Для production нужна активация.

#### M-06. Нет rate-limiter на API
Все эндпоинты без ограничения частоты запросов.

## План дальнейшей работы (приоритет)

### Фаза 1 — Hardening (1 сессия)
1. I-01: Explicit field whitelists в mutations
2. I-02: propertyId UUID validation на все GET
3. I-03: CORS configuration
4. M-01: README.md для GitHub

### Фаза 2 — UX Polish (1 сессия)
1. I-04: loading.tsx, not-found.tsx, улучшить error.tsx
2. M-03: Health check для web
3. Responsive design audit (мобильные таблицы)

### Фаза 3 — Test Infrastructure (1 сессия)
1. I-05: Test isolation (cleanup или rollback)
2. Добавить тесты на folio, night-audit, guests CRUD
3. CI pipeline (GitHub Actions: typecheck + test)

### Фаза 4 — Production Readiness
1. M-05: Активация auth middleware
2. M-06: Rate limiting
3. Docker Compose для deployment
4. Обновить project-context.md
