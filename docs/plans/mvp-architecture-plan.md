# MVP Architecture Plan v2 — 2026-03-30

## Философия

Наш PMS — **модульный, расширяемый**, вдохновлён лучшими практиками гостиничных систем.
Не копируем чужую архитектуру, а строим свою — чистую и эффективную.

**Принципы:**
- Каждый модуль — самодостаточный (schema + routes + domain logic + tests)
- Схема БД должна поддерживать будущие модули без ломающих миграций
- Избегаем vendor-specific терминов в коде — используем описательные имена
- MVP = минимум, который позволяет принять гостя, выставить счёт, закрыть день
- Архитектурные изменения ДО новых модулей — иначе придётся переписывать

---

## Текущее состояние

### Что есть и работает
| Модуль | API | Web | Schema | Тесты |
|--------|-----|-----|--------|-------|
| Rooms (номера + типы + HK статус) | CRUD + OOO/OOS | Список + управление | rooms, room_types | Unit + Integration |
| Guests (профили физлиц) | CRUD | Список + карточка | guests | Unit |
| Bookings (бронирования) | CRUD + check-in/out/cancel | Список + карточка | bookings | Unit + Integration |
| Folio (финансы) | Post charges/payments | Просмотр | folio_transactions | Unit + Integration |
| Night Audit | Run + preview + no-show | Панель | business_dates | Integration |
| Rate Plans | CRUD | Конфигурация | rate_plans, rate_plan_room_rates | Unit |
| Transaction Codes | CRUD | Конфигурация | transaction_codes | Unit |
| Dashboard | Статистика | Главная | — | — |
| Tape Chart | Наглядная сетка | Страница | — | — |
| Properties | CRUD | Конфигурация | properties | — |

### Что работает хорошо (не трогаем)
- `SELECT ... FOR UPDATE` для confirmation numbers и check-in (race condition prevention)
- Append-only folio с ON CONFLICT DO NOTHING (idempotency)
- Business date discipline — `getBusinessDate()` вместо `new Date()`
- RESTRICT FK + pre-check dependencies с русскими сообщениями
- Night audit: блокировка при overdue due-outs, no-show processing, OOO restore
- Domain logic isolation в `packages/domain/`

---

## Недостающие компоненты для MVP

### КРИТИЧЕСКИЕ (без них запуск невозможен)

1. **Посуточная разбивка бронирования** — ставка/комната по ночам (сейчас плоский `rateAmount`)
2. **Базовый auth** — все API открыты, `postedBy` всегда `"system"`, аудит-трейл бесполезен
3. **Компании и турагенты** — 50%+ бронирований бизнес-отеля привязаны к юрлицам

### ВАЖНЫЕ (можно запуститься, но скоро упрёшься)

4. **Окна биллинга** — разделение счёта (компания vs гость)
5. **Кассирские смены** — кто провёл операцию, сверка наличных
6. **Пакеты** — завтрак, трансфер, привязанные к тарифу
7. **HK задания** — назначение горничных, не только статус комнат

### ОТЛОЖЕННЫЕ (Фаза C — после запуска)

8. Групповые бронирования (блоки, pickup, cutoff)
9. Маршрутизация начислений (auto-routing по transaction code)
10. Дебиторская задолженность (AR)
11. Депозиты и предоплаты (реализуемы через folio без отдельной таблицы)

---

## Фазы реализации

### Фаза 0 — Фундамент безопасности
### Фаза A — Архитектурные изменения схемы
### Фаза B — Новые MVP модули
### Фаза C — Расширения после запуска

---

## Фаза 0 — Безопасность (блокирует Фазу A)

> Без auth невозможен модуль кассиров, бесполезен аудит-трейл, API полностью открыт.

### 0-1. Включить auth middleware

**Файлы:** `apps/api/src/app.ts`, `apps/api/src/routes/auth.ts`

Auth уже написан (закомментирован). Задача:
- Раскомментировать `await app.register(authPlugin)` в `app.ts`
- Добавить `secure: true` на cookie в production (проверка `NODE_ENV`)
- CORS: ограничить origin до `process.env.CORS_ORIGIN || 'http://localhost:3000'`
- Добавить `@fastify/rate-limit` на `/api/auth/login` (5 попыток / минута)
- Убедиться что seed-пользователи имеют рабочие пароли
- Тесты: добавить helper для authenticated requests

**Критерии:** Все API кроме `/health` и `/api/auth/login` требуют сессию. Тесты проходят.

### 0-2. Input validation: explicit field whitelists

**Файлы:** ВСЕ route файлы с `...request.body`

Заменить `...request.body` на explicit field picks:
```typescript
// БЫЛО (опасно — mass assignment):
const { ...request.body } → await db.update(bookings).set(request.body)

// СТАЛО:
const { guestId, roomId, checkInDate, checkOutDate, adults, children, rateAmount, notes } = request.body;
await db.update(bookings).set({ guestId, roomId, checkInDate, ... });
```

**Файлы для fix:** `bookings.ts:404`, `guests.ts:120`, `rate-plans.ts:108`, `room-types.ts:85`, `properties.ts:54`

---

## Фаза A — Архитектура

### A-1. Посуточная разбивка (`booking_daily_details`)

**Зачем:** Без неё невозможно: разные тарифы по дням, пакеты, правильный Room & Tax posting, сезонное ценообразование.

**Новая таблица:**
```
booking_daily_details
├── id (uuid PK)
├── bookingId (FK → bookings)
├── stayDate (date) — конкретная ночь
├── roomId (FK → rooms, nullable) — может меняться при переселении
├── roomTypeId (FK → room_types)
├── ratePlanId (FK → rate_plans, nullable)
├── rateAmount (decimal) — ставка на ЭТУ ночь
├── adults (int, default 1)
├── children (int, default 0)
├── marketCode (varchar, nullable)
├── sourceCode (varchar, nullable)
├── UNIQUE(bookingId, stayDate)
```

**Source of truth:**
- `booking_daily_details` — единственный источник правды для ставок, комнаты по ночам
- `bookings.rateAmount` → переименовать в `bookings.averageRate` (вычисляемое, для быстрого отображения)
- `bookings.roomId` → остаётся как "текущая комната" (для checked_in), при check-in копируется во все daily details
- `bookings.marketCode`, `bookings.sourceCode` → остаются как дефолтные значения

**Влияние на существующий код:**
- **Bookings create**: при создании бронирования → генерировать N записей в `booking_daily_details` (одна на ночь)
- **Bookings update**: при изменении дат/тарифа → пересоздать daily details
- **Night audit** (строка 313-406 в `night-audit.ts`): Room & Tax posting читает `rateAmount` из `booking_daily_details` где `stayDate = bizDate.date` вместо `bookings.rateAmount`
- **Tape chart**: данные из `booking_daily_details` вместо `bookings`
- **Room move**: обновить `roomId` в daily details для оставшихся ночей

**Миграция seed data:** Для каждого из 13 существующих бронирований — сгенерировать daily details из `bookings.rateAmount` × количество ночей.

### A-2. Компании и турагенты

**Зачем:** Корпоративные клиенты — основа revenue бизнес-отеля. Без них нет групп, AR, корп. тарифов.

**Решение: отдельные таблицы (НЕ расширение `guests`)**

Почему не в `guests`: у компании нет `firstName`, `lastName`, `dateOfBirth`, `gender`. Запихнуть всё в одну таблицу → 15+ nullable полей + `WHERE profile_type = 'individual'` в каждом запросе.

**Новые таблицы:**
```
companies
├── id (uuid PK)
├── propertyId (FK → properties)
├── name (varchar, NOT NULL) — "ООО Ромашка"
├── shortName (varchar, nullable) — "Ромашка"
├── taxId (varchar, nullable) — ИНН
├── registrationNumber (varchar, nullable) — ОГРН
├── email (varchar, nullable)
├── phone (varchar, nullable)
├── address (text, nullable)
├── contactPerson (varchar, nullable)
├── creditLimit (decimal, nullable)
├── paymentTermDays (int, default 30) — сколько дней на оплату
├── arAccountNumber (varchar, nullable) — номер счёта дебиторки
├── isActive (boolean, default true)
├── notes (text, nullable)
├── UNIQUE(propertyId, taxId) — один ИНН на отель

travel_agents
├── id (uuid PK)
├── propertyId (FK → properties)
├── name (varchar, NOT NULL)
├── iataCode (varchar, nullable)
├── commissionPercent (decimal, nullable)
├── email, phone, address
├── contactPerson (varchar, nullable)
├── isActive (boolean, default true)
├── notes (text, nullable)
```

**Влияние на bookings:**
```
ALTER bookings ADD:
├── companyId (FK → companies, nullable)
├── travelAgentId (FK → travel_agents, nullable)
```

**API:** CRUD для `/api/companies` и `/api/travel-agents`
**Web:** Страницы управления компаниями и TA

### A-3. Окна биллинга (`folio_windows`)

**Зачем:** Разделение счёта — базовая потребность. Даже без auto-routing, ручное разделение нужно.

**Новая таблица:**
```
folio_windows
├── id (uuid PK)
├── bookingId (FK → bookings)
├── windowNumber (int, 1-8)
├── label (varchar) — "Компания", "Личные расходы", "Завтраки"
├── payeeType (varchar) — 'guest' | 'company' | 'travel_agent'
├── payeeId (uuid, nullable) — FK → companies/travel_agents (если не guest)
├── paymentMethod (varchar, nullable)
├── UNIQUE(bookingId, windowNumber)
```

**Влияние:**
- `folio_transactions` получает `folioWindowId` (FK → folio_windows, **nullable** — обратная совместимость)
- При создании бронирования → автоматически создать Window 1 (default, тип 'guest')
- При привязке компании → предложить создать Window 2 (тип 'company')
- Checkout: баланс каждого окна отдельно, закрытие по окнам
- **Routing (Фаза C):** auto-routing будет перемещать начисления между окнами

### A-4. Кассирские смены (`cashier_sessions`)

**Зависимость:** Фаза 0 (auth) — нужен `user_id`.

**Новая таблица:**
```
cashier_sessions
├── id (uuid PK)
├── propertyId (FK → properties)
├── userId (FK → users)
├── cashierNumber (int, 1-99)
├── openedAt (timestamp, default now)
├── closedAt (timestamp, nullable)
├── openingBalance (decimal, default 0)
├── closingBalance (decimal, nullable)
├── status (varchar) — 'open' | 'closed'
├── UNIQUE(propertyId, cashierNumber) WHERE status = 'open'
```

**Влияние:**
- `folio_transactions` получает `cashierSessionId` (FK, **nullable**)
- При posting: если пользователь имеет открытую cashier session → привязать
- Night audit: проверить что все cashier sessions закрыты (warning, не blocker)
- End of shift: отчёт по кассиру (итого cash in/out)

---

## Фаза B — Новые MVP модули

### B-1. Пакеты (packages)

**Зачем:** "Завтрак включён" — один из самых частых запросов гостей. Без пакетов тариф — просто число.

**Новые таблицы:**
```
packages
├── id (uuid PK)
├── propertyId (FK)
├── code (varchar) — 'BKFST', 'PARKING', 'SPA'
├── name (varchar) — 'Завтрак'
├── description (text, nullable)
├── transactionCodeId (FK → transaction_codes) — куда постить
├── calculationRule (varchar) — 'per_night' | 'per_stay' | 'per_person_per_night'
├── amount (decimal) — цена (0 = включён в тариф, отдельно не начисляется)
├── postingRhythm (varchar) — 'every_night' | 'arrival_only' | 'departure_only'
├── isActive (boolean, default true)
├── UNIQUE(propertyId, code)

rate_plan_packages (M:M)
├── ratePlanId (FK → rate_plans)
├── packageId (FK → packages)
├── includedInRate (boolean) — включён в тариф (не генерирует отдельное начисление) или доп. услуга
```

**Влияние на Night Audit:**
После Room & Tax posting → Package posting:
```
for each checked_in booking where checkOutDate > bizDate:
  get ratePlan → get packages where postingRhythm = 'every_night'
  for each package:
    if NOT includedInRate:
      post charge (amount × persons if per_person_per_night)
```

### B-2. HK задания (housekeeping tasks)

**Зачем:** Горничная должна знать какие номера убирать, менеджер — видеть прогресс.

**Новая таблица:**
```
hk_tasks
├── id (uuid PK)
├── propertyId (FK)
├── roomId (FK → rooms)
├── businessDateId (FK → business_dates)
├── taskType (varchar) — 'checkout_clean' | 'stayover_clean' | 'deep_clean' | 'inspection' | 'turndown'
├── assignedTo (varchar, nullable) — имя горничной (без FK на users — HK staff не обязаны иметь аккаунт)
├── priority (int, default 0) — 0=normal, 1=rush (VIP, early arrival)
├── status (varchar) — 'pending' | 'in_progress' | 'completed' | 'skipped'
├── startedAt (timestamp, nullable)
├── completedAt (timestamp, nullable)
├── notes (text, nullable)
├── UNIQUE(roomId, businessDateId, taskType)
```

**Генерация задач (утро или после Night Audit):**
- Все rooms WHERE occupancyStatus = 'occupied' → `stayover_clean`
- Все bookings WHERE status = 'checked_out' AND actualCheckOut на бизнес-дату → `checkout_clean`
- VIP arrivals на сегодня → `inspection` с priority = 1

**API:** CRUD + PATCH status, GET по бизнес-дате, фильтр по assignedTo/status
**Web:** Список задач с группировкой по этажу, drag-n-drop назначение

---

## Фаза C — Расширения (после MVP)

Архитектура Фаз A-B их поддерживает:

| Модуль | Зависит от | Описание |
|--------|-----------|----------|
| Групповые бронирования | A-2 (companies) | group_blocks + group_block_rooms. `picked_up_count` — **вычисляемый** через COUNT, не хранимый |
| Auto-routing | A-3 (folio windows) | routing_rules таблица + интеграция с posting. **Сложный модуль** — MVP обходится ручным переносом между окнами |
| AR (дебиторка) | A-2 + A-3 | Перенос открытого баланса на account receivable при checkout компании |
| Депозиты | A-3 (folio windows) | Не нужна отдельная таблица — это payment в folio с group_code='deposit' |
| Сезонное ценообразование | A-1 (daily details) | rate_plan_seasons таблица, генерация daily details с разными ставками |
| Комиссии TA | A-2 (travel_agents) | Автоматический расчёт при checkout |
| Revenue Management | A-1 (daily details) | Анализ ADR, RevPAR, occupancy по датам |
| Multi-currency | A-3 (folio windows) | currency + exchangeRate на folio_transactions |
| Фискализация (РФ) | folio_transactions | Интеграция с ОФД, чеки |
| Интерфейсы (POS, ключи) | A-4 (cashiers) | Внешние системы постят через API |

---

## Порядок выполнения (для агента)

### Зависимости
```
Фаза 0-1 (auth) ──────────┐
Фаза 0-2 (whitelists) ────┤
                           ├──→ A-1 (daily details) ──→ обновить Night Audit
                           │                         ──→ обновить Bookings create/update
                           │                         ──→ обновить Tape Chart
                           │                         ──→ seed migration
                           ├──→ A-2 (companies/TA) ──→ обновить Bookings (companyId, travelAgentId)
                           │                        ──→ seed: добавить компании/TA
                           ├──→ A-3 (folio windows) ──→ обновить Folio posting
                           │                         ──→ обновить Checkout
                           └──→ A-4 (cashiers) ──→ обновить Folio posting (cashierSessionId)
                                               ──→ Night Audit pre-check

A-1 done ──→ B-1 (packages) ──→ обновить Night Audit (package posting)
A-4 done ──→ B-2 (HK tasks)
```

### Шаги (промпты для агента)

| # | Шаг | Сложность | Описание |
|---|-----|-----------|----------|
| 1 | **0-1: Auth** | Средняя | Раскомментировать auth, CORS, rate-limit, тесты |
| 2 | **0-2: Whitelists** | Низкая | Explicit field picks на 5 route файлов |
| 3 | **A-2: Companies + TA** | Средняя | Schema + CRUD API + seed (НЕ зависит от A-1) |
| 4 | **A-1: Daily details schema** | Низкая | Только таблица + seed migration |
| 5 | **A-1: Bookings refactor (create)** | Высокая | При create booking → генерировать daily details |
| 6 | **A-1: Bookings refactor (update/move/extend)** | Высокая | Update, room move, extend stay → пересоздать daily details |
| 7 | **A-1: Night Audit refactor** | Высокая | Room & Tax из daily details + no-show на правильном шаге |
| 8 | **A-3: Folio windows schema** | Низкая | Таблица + auto-create Window 1 при бронировании |
| 9 | **A-3: Folio posting refactor** | Средняя | folioWindowId при постинге, баланс по окнам |
| 10 | **A-4: Cashier sessions** | Средняя | Schema + API + интеграция с folio |
| 11 | **B-1: Packages** | Средняя | Schema + API + Night Audit integration |
| 12 | **B-2: HK tasks** | Средняя | Schema + API + task generation + web page |
| 13 | **Bookings: companyId/travelAgentId** | Низкая | Добавить FK в bookings, обновить create/update/list |
| 14 | **Tape Chart refactor** | Средняя | Из daily details вместо bookings |
| 15 | **Seed data update** | Низкая | Companies, TA, daily details, folio windows для всех 13 бронирований |
| 16 | **Integration tests update** | Средняя | Обновить все 18 integration tests под новую схему |

**Итого: ~16 шагов, ~16-18 сессий агента** (шаги 5-7 могут потребовать по 2 сессии каждый).

---

## Формат промпта для агента

```markdown
# Задача: [номер] — [название]

## Контекст
[Краткое описание что уже сделано и зачем нужен этот шаг]

## Файлы для изменения
- Schema: `packages/db/src/schema/[file].ts`
- Routes: `apps/api/src/routes/[file].ts`
- Web: `apps/web/src/app/[dir]/`
- Tests: `apps/api/src/[file].test.ts`

## Паттерны проекта (ОБЯЗАТЕЛЬНО соблюдать)
- Drizzle ORM (пример: `packages/db/src/schema/rooms.ts`)
- Fastify routes (пример: `apps/api/src/routes/rooms.ts`)
- UUID PK, propertyId scoping на КАЖДОЙ таблице, onDelete:"restrict"
- Append-only folio — НИКОГДА не UPDATE/DELETE folio_transactions
- `getBusinessDate(db, propertyId)` — НИКОГДА `new Date()` для бизнес-логики
- Русские ошибки для бизнес-валидации
- RESTRICT FK + pre-check dependencies перед DELETE
- `router.replace()` после сохранения формы (не `push()`)
- Никаких vendor-specific кодов (Oracle и т.п.) в публичных файлах

## Что сделать
[Конкретные шаги]

## Критерии приёмки
- [ ] Schema создана / обновлена
- [ ] API endpoints работают
- [ ] Все существующие тесты проходят
- [ ] Новые тесты написаны (unit + integration)
- [ ] TypeScript typecheck clean
- [ ] Seed data обновлен (если нужно)
```

---

## Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Агент сломает существующие тесты | Высокая | Каждый шаг заканчивается `pnpm test` — не мержить если красное |
| Daily details + bookings рассинхрон | Средняя | Bookings create/update ВСЕГДА в транзакции с daily details |
| Auth ломает все integration tests | Высокая | Шаг 1: добавить test helper для authenticated requests ДО включения auth |
| Слишком много изменений за раз | Средняя | Один шаг = один PR. Мержить последовательно |
| Agent hallucination (выдумывает несуществующие API) | Средняя | В промпте указывать конкретные файлы для чтения как reference |

---

## Что НЕ входит в MVP

Чтобы не раздувать scope:

- ❌ Multi-property (всё scoped по propertyId, но UI только 1 отель)
- ❌ Revenue management / dynamic pricing
- ❌ Channel manager integration
- ❌ Mobile app
- ❌ Email notifications
- ❌ Reports (PDF/Excel export)
- ❌ Multi-language UI (только русский)
- ❌ Multi-currency
- ❌ Loyalty / membership program
