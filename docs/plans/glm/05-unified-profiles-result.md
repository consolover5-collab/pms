# Unified Profiles — результат реализации

**Дата:** 2026-04-11
**Длительность:** ~25 мин

---

## Суть изменений

Три таблицы (`guests`, `companies`, `travel_agents`) → одна таблица `profiles` с полем `type` (enum: `individual`, `company`, `travel_agent`, `source`, `contact`).

---

## Созданные файлы (7)

| Файл | Описание |
|---|---|
| `packages/db/src/schema/profiles.ts` | Схема profiles + profileRelationships, 2 pgEnum (profile_type, channel_type_enum) |
| `packages/db/drizzle/0007_unified_profiles.sql` | Миграция: CREATE profiles, миграция данных из guests/companies/travel_agents, создание source-профилей, обновление bookings FK, DROP старых таблиц |
| `apps/api/src/routes/profiles.ts` | CRUD для /api/profiles (GET list, GET :id, POST, PUT, DELETE) с поиском, фильтрацией по type, проверкой дубликатов, защитой от удаления при наличии броней |
| `apps/web/src/app/configuration/profiles/page.tsx` | Серверный компонент — список профилей с табами |
| `apps/web/src/app/configuration/profiles/profiles-list.tsx` | Клиентский компонент — табы, поиск, таблица |
| `apps/web/src/app/configuration/profiles/profile-form.tsx` | Единая форма с условными секциями по type |
| `apps/web/src/app/configuration/profiles/new/page.tsx` | Создание нового профиля |
| `apps/web/src/app/configuration/profiles/[id]/page.tsx` | Просмотр профиля |
| `apps/web/src/app/configuration/profiles/[id]/edit/page.tsx` | Редактирование профиля |

## Удалённые файлы (5)

| Файл | Причина |
|---|---|
| `packages/db/src/schema/guests.ts` | Заменён на profiles |
| `packages/db/src/schema/companies.ts` | Заменён на profiles |
| `apps/api/src/routes/guests.ts` | Заменён на profiles.ts |
| `apps/api/src/routes/companies.ts` | Заменён на profiles.ts |
| `apps/api/src/routes/travel-agents.ts` | Заменён на profiles.ts |
| `apps/web/src/app/configuration/companies/` (вся папка) | Заменён на profiles |
| `apps/web/src/app/configuration/travel-agents/` (вся папка) | Заменён на profiles |

## Изменённые файлы (16)

| Файл | Изменения |
|---|---|
| `packages/db/src/schema/bookings.ts` | `guestId` → `guestProfileId`, `companyId` → `companyProfileId`, `travelAgentId` → `agentProfileId`, +`sourceProfileId`, FK → profiles, индекс обновлён |
| `packages/db/src/schema/index.ts` | Экспорт `./profiles` вместо `./guests` и `./companies` |
| `packages/db/drizzle/meta/_journal.json` | +запись 0007_unified_profiles |
| `packages/db/src/seed.ts` | guests/companies/travelAgents → profiles с type, booking fields: guestProfileId, companyProfileId, agentProfileId |
| `apps/api/src/app.ts` | guestsRoutes/companiesRoutes/travelAgentsRoutes → profilesRoutes (старые закомментированы) |
| `apps/api/src/routes/bookings.ts` | Все JOIN через profiles вместо guests, body fields: guestProfileId/companyProfileId/agentProfileId/sourceProfileId |
| `apps/api/src/routes/dashboard.ts` | guests → profiles, guestId → guestProfileId |
| `apps/api/src/routes/housekeeping.ts` | guests → profiles, guestId → guestProfileId (VIP inspection) |
| `apps/api/src/routes/night-audit.ts` | guests → profiles, guestId → guestProfileId (no-show preview, room charges) |
| `apps/api/src/routes/tape-chart.ts` | guests → profiles, guestId → guestProfileId |
| `apps/api/src/routes/integration.test.ts` | Companies/TravelAgents CRUD → Profiles CRUD (individual, company, travel_agent, source, search), /api/guests → /api/profiles, guestId → guestProfileId |
| `apps/web/src/app/configuration/page.tsx` | Companies + Travel Agents → Profiles |
| `apps/web/src/app/bookings/new/booking-form.tsx` | /api/guests → /api/profiles?type=individual, guestId → guestProfileId |
| `apps/web/src/app/bookings/[id]/edit/booking-edit-form.tsx` | /api/guests → /api/profiles?type=individual, guestId → guestProfileId |
| `apps/web/src/app/guests/page.tsx` | /api/guests → /api/profiles?type=individual, vipStatus: number → string |
| `apps/web/src/app/guests/new/guest-form.tsx` | /api/guests → /api/profiles, +type: "individual", +name |
| `apps/web/src/app/guests/[id]/page.tsx` | /api/guests/:id → /api/profiles/:id |
| `apps/web/src/app/guests/[id]/edit/guest-edit-form.tsx` | /api/guests/:id → /api/profiles/:id, +name field |
| `apps/web/src/app/guests/[id]/edit/page.tsx` | /api/guests/:id → /api/profiles/:id |

---

## Решения при typecheck-ошибках

После первого прохода typecheck выдал ~20 ошибок. Решения:

### 1. Старые route-файлы ещё существовали
**Ошибка:** `companies.ts`, `travel-agents.ts`, `guests.ts` — `Module '"@pms/db"' has no exported member 'companies'/'guests'/'travelAgents'`
**Решение:** Удалены 3 файла: `apps/api/src/routes/{guests,companies,travel-agents}.ts`

### 2. Четыре route-файла не были обновлены
**Ошибка:** `dashboard.ts`, `housekeeping.ts`, `night-audit.ts`, `tape-chart.ts` — импортировали `guests` из `@pms/db` и использовали `bookings.guestId`
**Решение:** В каждом файле:
- `import { guests }` → `import { profiles }`
- `bookings.guestId` → `bookings.guestProfileId`
- `.innerJoin(guests, ...)` → `.innerJoin(profiles, ...)`
- `guests.firstName/lastName` → `profiles.firstName/lastName/name`
- Добавлено поле `name` в select гостя

### 3. Drizzle pgEnum не принимает `string` в INSERT/UPDATE
**Ошибка:** `profiles.ts:150` — `Type 'string | undefined' is not assignable to type '"direct" | "ota" | ... | null | undefined'` для поля `channelType`
**Причина:** Body из Fastify — `channelType?: string`, но Drizzle-схема использует `channelTypeEnum("channel_type")`. TypeScript не даёт spread'ом прокинуть `string` в union enum.
**Решение:** Выделен `channelType` из rest-деструктуризации, приведение через `as any`:
```typescript
const { propertyId, type, force, channelType, ...rest } = request.body;
// INSERT:
...(channelType ? { channelType: channelType as any } : {}),
// UPDATE:
const { channelType: ctBody, ...restBody } = request.body;
...(ctBody ? { channelType: ctBody as any } : {}),
```

---

## Как запустить

### 1. Миграция
```bash
pnpm db:migrate
# Или полный пересид (⚠️ удаляет все данные):
pnpm db:seed
```

### 2. Typecheck
```bash
pnpm typecheck
# Ожидание: 4 successful, 0 failed
```

### 3. Тесты
```bash
# Доменные тесты (не требуют БД)
cd packages/domain && pnpm test

# Интеграционные тесты (нужна running БД + API)
cd apps/api && pnpm test:integration
```

### 4. Ручная проверка через curl
```bash
# Список профилей
curl -s http://localhost:3001/api/profiles?propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad | jq '.total'

# Фильтр по типу
curl -s http://localhost:3001/api/profiles?propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad&type=company | jq '.data[].name'

# Поиск
curl -s "http://localhost:3001/api/profiles?propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad&q=FN470" | jq '.total'

# Создание individual
curl -s -X POST http://localhost:3001/api/profiles \
  -H 'Content-Type: application/json' \
  -d '{"propertyId":"ff1d9135-dfb9-4baa-be46-0e739cd26dad","type":"individual","firstName":"Test","lastName":"User"}' \
  | jq '{id, type, name}'

# Создание company
curl -s -X POST http://localhost:3001/api/profiles \
  -H 'Content-Type: application/json' \
  -d '{"propertyId":"ff1d9135-dfb9-4baa-be46-0e739cd26dad","type":"company","name":"Test Corp","taxId":"12345"}' \
  | jq '{id, type, name, taxId}'
```

---

## Что не сделано (out of scope)

- Navbar ссылка `/guests` не обновлена на `/configuration/profiles` — старые страницы гостей работают через `/api/profiles?type=individual`
- Страница `/guests/[id]` показывает профиль через `/api/profiles/:id` — но Guest type не содержит всех полей profiles
- `profileRelationships` таблица создана в схеме и миграции, но API для неё не реализован
- Дубликат при удалении профиля проверяет все 4 FK в bookings (guest, company, agent, source)
- Commission % в форме travel_agent отключён (disabled) — как в спецификации
