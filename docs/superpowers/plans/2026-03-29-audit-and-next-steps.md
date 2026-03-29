# PMS Audit & Next Steps — 2026-03-29

## Текущее состояние

**Проект работает.** API (Fastify :3001) + Web (Next.js :3000) запущены, все 10 страниц отвечают 200, все 47 тестов (29 unit + 18 integration) зелёные, typecheck чистый.

- 15K LOC TypeScript, 97 файлов, 83 коммита, 12 таблиц БД
- GitHub: consolover5-collab/pms (public)
- Seed data: 1 отель (GBH), 54 номера, 11 гостей, 13 бронирований

## Исправлено в этой сессии
- [x] Unit test `validateBookingDates` — ожидал ошибку для day-use, обновлён
- [x] `.env.example` — дополнен всеми переменными
- [x] MEMORY.md — реструктурирован (5 файлов вместо 1 монолита)

---

## Найденные проблемы

### CRITICAL (5) — Безопасность

#### C-01. Auth полностью отключён
**Файл:** `apps/api/src/app.ts:31` — `// await app.register(authPlugin)`
Все API эндпоинты доступны без аутентификации. `postedBy` в folio всегда `"system"` — аудит-трейл бесполезен.

#### C-02. Mass assignment через `...request.body`
**Файлы:** `bookings.ts:404`, `guests.ts:120`, `rate-plans.ts:108`, `room-types.ts:85`, `properties.ts:54`
Без Fastify JSON Schema лишние поля не фильтруются. Атакующий может послать `{"status":"checked_in"}` на PUT /bookings/:id и обойти state machine.

#### C-03. CORS отражает любой origin + credentials
**Файл:** `app.ts:24` — `{ origin: true, credentials: true }`
Любой сайт может делать cross-origin запросы с куками. При включении auth — полный доступ с любого домена.

#### C-04. Session cookie без `secure` флага
**Файл:** `auth.ts:54-58` — `httpOnly: true, sameSite: "lax"`, но нет `secure: true`.

#### C-05. Захардкоженные seed-пароли
**Файл:** `seed.ts:561-581` — `"admin123"`, `"front123"`, `"hk123"`.

### IMPORTANT (10) — Качество и надёжность

#### I-01. Нет UUID-валидации на params
`request.params.id` идёт в SQL без `isValidUuid()` в rooms, guests, bookings, rate-plans, room-types, properties. Невалидный UUID → 500 вместо 400.

#### I-02. Нет Fastify JSON Schema ни на одном роуте
TypeScript generics дают только compile-time проверку. В рантайме body/query не валидируются — пропущенные поля → SQL-ошибки 500.

#### I-03. Нет rate-limit на login
Неограниченный brute-force + слабые seed-пароли = компрометация.

#### I-04. Нет security headers
Нет `@fastify/helmet` — отсутствуют X-Content-Type-Options, X-Frame-Options, CSP, HSTS.

#### I-05. DB pool не закрывается при shutdown
Нет `app.addHook('onClose', ...)`, нет SIGTERM/SIGINT handler в server.ts.

#### I-06. Expired sessions не чистятся
Sessions с `expiresAt < now()` не удаляются — таблица растёт бесконечно.

#### I-07. PUT /bookings/:id обходит state machine
`...request.body` spread позволяет передать `status` напрямую, минуя check-in/check-out/cancel валидации. **Самая опасная бизнес-уязвимость.**

#### I-08. Дублирование OOO-валидации в POST/PATCH rooms
`rooms.ts:137-233` и `rooms.ts:236-326` — ~90 строк идентичной логики.

#### I-09. `getBusinessDate()` дублирован в 3 файлах
bookings.ts, dashboard.ts, night-audit (inline). Разные обработки ошибок.

#### I-10. Night audit preview: тип Querystring, чтение из body
`night-audit.ts:17-20` — TypeScript type говорит Querystring, код читает body.

### MINOR (10) — Технический долг

| # | Проблема | Файл(ы) |
|---|----------|---------|
| M-01 | 66 `any` по 8 файлам | validation.ts, folio.ts, night-audit.ts |
| M-02 | Смешение русских/английских ошибок | rooms.ts, room-types.ts vs bookings.ts |
| M-03 | Нет loading.tsx / not-found.tsx | apps/web/src/app/ |
| M-04 | Frontend fetch без error handling | booking-actions.tsx:35-47 |
| M-05 | Properties без propertyId scoping | properties.ts:6 |
| M-06 | Seed использует `new Date()` | seed.ts:231 |
| M-07 | Domain state machine не используется | booking/state-machine.ts определён, API не вызывает |
| M-08 | formatCurrency без символа валюты | format.ts |
| M-09 | Unused imports в validation.ts | `rooms`, `roomTypes` не используются |
| M-10 | Night audit N+1 queries | night-audit.ts:335-406 |

---

## Что работает хорошо
- `SELECT ... FOR UPDATE` для race condition prevention (check-in, room-move, confirmation numbers)
- Append-only folio с ON CONFLICT DO NOTHING (idempotency)
- Business date discipline — `getBusinessDate()` вместо `new Date()`
- RESTRICT FK + pre-check dependencies с русскими сообщениями
- Domain logic isolation в `packages/domain/`
- 47 тестов (29 unit + 18 integration) — все зелёные

---

## План дальнейшей работы

### Фаза 1 — Security Hardening (приоритет: высокий)
1. **C-02 + I-07**: Explicit field whitelists на ВСЕ PUT/POST endpoints (особенно bookings)
2. **C-03**: CORS — ограничить origin до `localhost:3000` / env variable
3. **I-01**: UUID validation на все `:id` params (Fastify preValidation hook)
4. **I-02**: JSON Schema хотя бы на bookings POST/PUT, night-audit POST
5. **C-04**: `secure: true` на cookie в production
6. **I-04**: `@fastify/helmet` для security headers
7. README.md для публичного GitHub

### Фаза 2 — Code Quality (приоритет: средний)
1. **I-07 + M-07**: Подключить domain state machine в API routes
2. **I-08**: Извлечь OOO-валидацию в общую функцию
3. **I-09**: Вынести `getBusinessDate()` в `apps/api/src/lib/business-date.ts`
4. **I-10**: Исправить type mismatch в night-audit preview
5. **M-09**: Удалить unused imports
6. **M-02**: Унифицировать язык ошибок (русский)
7. **M-01**: Заменить `any` на proper types

### Фаза 3 — UX & Frontend (приоритет: средний)
1. **M-03**: loading.tsx, not-found.tsx
2. **M-04**: Error handling в client-side fetch
3. **M-08**: formatCurrency с символом валюты
4. Responsive design для мобильных таблиц

### Фаза 4 — Infrastructure (приоритет: низкий)
1. **I-05**: Graceful shutdown (DB pool close + signal handlers)
2. **I-03**: Rate limiting на login (`@fastify/rate-limit`)
3. **I-06**: Session cleanup (night audit или cron)
4. Test isolation — cleanup/rollback для integration tests
5. CI pipeline (GitHub Actions: typecheck + test)
6. Docker Compose

### Фаза 5 — Production (когда готовы)
1. **C-01**: Активация auth middleware
2. **C-05**: Seed-пароли из env или document "never run in prod"
3. HTTPS + secure cookies
4. Обновить docs/project-context.md
