# Промт для GLM5.1: Unified Profiles — полная реализация

## Контекст

Проект: PMS на Next.js 16 (App Router) + React 19 + Fastify 5 + Drizzle ORM + PostgreSQL.  
Монорепо: `apps/web/` (фронтенд, порт 3000), `apps/api/` (бэкенд, порт 3001), `packages/db/` (схема + seed).

### Что сейчас есть

Три отдельные таблицы профайлов:
- `guests` → `packages/db/src/schema/guests.ts`
- `companies` + `travel_agents` → `packages/db/src/schema/companies.ts`

Таблица `bookings` (`packages/db/src/schema/bookings.ts`) ссылается на них через:
- `guest_id` (NOT NULL) → `guests.id`
- `company_id` (nullable) → `companies.id`
- `travel_agent_id` (nullable) → `travel_agents.id`
- `source_code` (varchar) — текстовая строка, не FK

Три отдельных API-роута: `apps/api/src/routes/guests.ts`, `companies.ts`, `travel-agents.ts`.  
Три отдельных раздела конфигурации в web: `/configuration/companies/`, `/configuration/travel-agents/`.

### Что нужно сделать

Заменить три таблицы одной — `profiles` с полем `type`. Перенести все данные. Обновить bookings. Создать единый API и единый UI.

---

## Задача

Реализуй изменения поэтапно в порядке ниже. Каждый шаг применяй напрямую в файлах.

---

## Фаза 1 — Схема БД (Drizzle)

### 1.1 Создай `packages/db/src/schema/profiles.ts`

```typescript
import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  date, decimal, integer, timestamp, index,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const profileTypeEnum = pgEnum("profile_type", [
  "individual",
  "company",
  "travel_agent",
  "source",
  "contact",
]);

export const channelTypeEnum = pgEnum("channel_type_enum", [
  "direct", "ota", "gds", "corporate", "walkin", "other",
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  type: profileTypeEnum("type").notNull(),

  // common
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),

  // individual only
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  dateOfBirth: date("date_of_birth"),
  nationality: varchar("nationality", { length: 100 }),
  gender: varchar("gender", { length: 1 }),
  language: varchar("language", { length: 10 }),
  passportNumber: varchar("passport_number", { length: 100 }),
  documentType: varchar("document_type", { length: 50 }),
  vipStatus: varchar("vip_status", { length: 20 }),

  // company only
  shortName: varchar("short_name", { length: 100 }),
  taxId: varchar("tax_id", { length: 50 }),
  registrationNumber: varchar("registration_number", { length: 50 }),
  address: text("address"),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  paymentTermDays: integer("payment_term_days"),
  arAccountNumber: varchar("ar_account_number", { length: 50 }),

  // travel_agent only
  iataCode: varchar("iata_code", { length: 20 }),
  commissionPercent: decimal("commission_percent", { precision: 5, scale: 2 }),

  // source only
  sourceCode: varchar("source_code", { length: 20 }),
  channelType: channelTypeEnum("channel_type"),

  // contact / shared
  contactPerson: varchar("contact_person", { length: 200 }),
  contactTitle: varchar("contact_title", { length: 100 }),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("profiles_property_id_idx").on(table.propertyId),
  index("profiles_type_idx").on(table.type),
  index("profiles_name_idx").on(table.name),
]);

export const profileRelationships = pgTable("profile_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromProfileId: uuid("from_profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  toProfileId: uuid("to_profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  relationshipType: varchar("relationship_type", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 1.2 Обнови `packages/db/src/schema/bookings.ts`

В импортах замени:
```typescript
// УДАЛИ:
import { guests } from "./guests";
import { companies, travelAgents } from "./companies";

// ДОБАВЬ:
import { profiles } from "./profiles";
```

В таблице `bookings` замени FK-поля:
```typescript
// УДАЛИ эти три поля:
guestId: uuid("guest_id").notNull().references(() => guests.id, { onDelete: "restrict" }),
companyId: uuid("company_id").references(() => companies.id, { onDelete: "restrict" }),
travelAgentId: uuid("travel_agent_id").references(() => travelAgents.id, { onDelete: "restrict" }),

// ДОБАВЬ вместо них:
guestProfileId: uuid("guest_profile_id")
  .notNull()
  .references(() => profiles.id, { onDelete: "restrict" }),
companyProfileId: uuid("company_profile_id")
  .references(() => profiles.id, { onDelete: "restrict" }),
agentProfileId: uuid("agent_profile_id")
  .references(() => profiles.id, { onDelete: "restrict" }),
sourceProfileId: uuid("source_profile_id")
  .references(() => profiles.id, { onDelete: "restrict" }),
```

Также обнови индексы — замени `bookings_guest_id_idx` на `bookings_guest_profile_id_idx` по полю `guestProfileId`.

### 1.3 Обнови `packages/db/src/schema/index.ts`

Добавь экспорт profiles, удали guests и companies:
```typescript
// УДАЛИ:
export * from "./guests";
export * from "./companies";

// ДОБАВЬ:
export * from "./profiles";
```

### 1.4 Удали старые файлы схемы

```
packages/db/src/schema/guests.ts     → УДАЛИТЬ
packages/db/src/schema/companies.ts  → УДАЛИТЬ
```

---

## Фаза 2 — Миграция БД

### 2.1 Создай файл миграции

Создай `packages/db/drizzle/0007_unified_profiles.sql`:

```sql
-- Enums
CREATE TYPE "profile_type" AS ENUM ('individual','company','travel_agent','source','contact');
CREATE TYPE "channel_type_enum" AS ENUM ('direct','ota','gds','corporate','walkin','other');

-- Profiles table
CREATE TABLE "profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "type" profile_type NOT NULL,
  "name" text NOT NULL,
  "email" varchar(255),
  "phone" varchar(50),
  "notes" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "first_name" varchar(100),
  "last_name" varchar(100),
  "date_of_birth" date,
  "nationality" varchar(100),
  "gender" varchar(1),
  "language" varchar(10),
  "passport_number" varchar(100),
  "document_type" varchar(50),
  "vip_status" varchar(20),
  "short_name" varchar(100),
  "tax_id" varchar(50),
  "registration_number" varchar(50),
  "address" text,
  "credit_limit" decimal(12,2),
  "payment_term_days" integer,
  "ar_account_number" varchar(50),
  "iata_code" varchar(20),
  "commission_percent" decimal(5,2),
  "source_code" varchar(20),
  "channel_type" channel_type_enum,
  "contact_person" varchar(200),
  "contact_title" varchar(100),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "profiles_property_id_idx" ON "profiles"("property_id");
CREATE INDEX "profiles_type_idx" ON "profiles"("type");
CREATE INDEX "profiles_name_idx" ON "profiles"("name");

-- Profile relationships
CREATE TABLE "profile_relationships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "to_profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "relationship_type" varchar(50) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Migrate guests → profiles (type = individual)
INSERT INTO "profiles" (
  "id", "property_id", "type", "name",
  "first_name", "last_name", "email", "phone",
  "document_type", "passport_number", "nationality",
  "gender", "language", "date_of_birth", "vip_status",
  "notes", "is_active", "created_at", "updated_at"
)
SELECT
  id, property_id, 'individual',
  first_name || ' ' || last_name,
  first_name, last_name, email, phone,
  document_type, document_number, nationality,
  gender, language, date_of_birth, vip_status,
  notes, true, created_at, updated_at
FROM "guests";

-- Migrate companies → profiles (type = company)
INSERT INTO "profiles" (
  "id", "property_id", "type", "name",
  "short_name", "tax_id", "registration_number",
  "email", "phone", "address", "contact_person",
  "credit_limit", "payment_term_days", "ar_account_number",
  "notes", "is_active", "created_at", "updated_at"
)
SELECT
  id, property_id, 'company', name,
  short_name, tax_id, registration_number,
  email, phone, address, contact_person,
  credit_limit, payment_term_days, ar_account_number,
  notes, is_active, created_at, updated_at
FROM "companies";

-- Migrate travel_agents → profiles (type = travel_agent)
INSERT INTO "profiles" (
  "id", "property_id", "type", "name",
  "iata_code", "commission_percent",
  "email", "phone", "address", "contact_person",
  "notes", "is_active", "created_at", "updated_at"
)
SELECT
  id, property_id, 'travel_agent', name,
  iata_code, commission_percent,
  email, phone, address, contact_person,
  notes, is_active, created_at, updated_at
FROM "travel_agents";

-- Create source profiles from distinct source_code values in bookings
INSERT INTO "profiles" ("property_id", "type", "name", "source_code", "is_active")
SELECT DISTINCT
  b.property_id,
  'source',
  CASE b.source_code
    WHEN 'phone' THEN 'Phone'
    WHEN 'web' THEN 'Web Direct'
    WHEN 'ota' THEN 'OTA'
    WHEN 'walk_in' THEN 'Walk-in'
    WHEN 'gds' THEN 'GDS'
    ELSE initcap(b.source_code)
  END,
  b.source_code,
  true
FROM "bookings" b
WHERE b.source_code IS NOT NULL AND b.source_code <> '';

-- Add new FK columns to bookings
ALTER TABLE "bookings"
  ADD COLUMN "guest_profile_id" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT,
  ADD COLUMN "company_profile_id" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT,
  ADD COLUMN "agent_profile_id" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT,
  ADD COLUMN "source_profile_id" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT;

-- Populate guest_profile_id from existing guest_id
UPDATE "bookings" SET "guest_profile_id" = "guest_id";

-- Populate company_profile_id from existing company_id
UPDATE "bookings" SET "company_profile_id" = "company_id" WHERE "company_id" IS NOT NULL;

-- Populate agent_profile_id from existing travel_agent_id
UPDATE "bookings" SET "agent_profile_id" = "travel_agent_id" WHERE "travel_agent_id" IS NOT NULL;

-- Populate source_profile_id from source_code
UPDATE "bookings" b
SET "source_profile_id" = p.id
FROM "profiles" p
WHERE p.type = 'source'
  AND p.source_code = b.source_code
  AND p.property_id = b.property_id;

-- Make guest_profile_id NOT NULL (all rows should now be populated)
ALTER TABLE "bookings" ALTER COLUMN "guest_profile_id" SET NOT NULL;

-- Drop old FK columns
ALTER TABLE "bookings"
  DROP COLUMN "guest_id",
  DROP COLUMN "company_id",
  DROP COLUMN "travel_agent_id";

-- Drop old tables
DROP TABLE "travel_agents";
DROP TABLE "companies";
DROP TABLE "guests";
```

### 2.2 Обнови `packages/db/drizzle/meta/_journal.json`

Добавь запись для миграции 0007 в конец массива `entries`:
```json
{
  "idx": 7,
  "version": "7",
  "when": 1744387200000,
  "tag": "0007_unified_profiles",
  "breakpoints": true
}
```

---

## Фаза 3 — API: новый роут `/api/profiles`

### 3.1 Создай `apps/api/src/routes/profiles.ts`

Реализуй следующие эндпоинты:

**GET /api/profiles**
- Query params: `propertyId` (обязателен), `type?` (фильтр по типу), `q?` (поиск), `limit?`, `offset?`
- Поиск по `name`, `email`, `phone`, `first_name`, `last_name`, `iata_code`, `source_code`
- Возвращает `{ data: Profile[], total: number }`

**GET /api/profiles/:id**
- Возвращает один профайл или 404

**POST /api/profiles**
- Body: `{ propertyId, type, name, ...type-specific fields }`
- Для `type=individual`: проверка дубликатов по `first_name + last_name` (409 с `code: "POSSIBLE_DUPLICATE"` если найдены, если не передан `force: true`)
- Возвращает 201 с созданным профайлом

**PUT /api/profiles/:id**
- Обновляет профайл. Возвращает обновлённый объект или 404.

**DELETE /api/profiles/:id**
- Query: `propertyId` (обязателен)
- Проверить: нет ли броней, ссылающихся на этот профайл (через guest_profile_id, company_profile_id, agent_profile_id, source_profile_id)
- Если есть брони → 400 с `code: "HAS_BOOKINGS"` и `count`
- Иначе удалить и вернуть `{ success: true }`

### 3.2 Обнови `apps/api/src/app.ts`

Зарегистрируй `profilesRoutes`. Удали регистрацию `guestsRoutes`, `companiesRoutes`, `travelAgentsRoutes`.

### 3.3 Удали старые роуты

```
apps/api/src/routes/guests.ts         → УДАЛИТЬ
apps/api/src/routes/companies.ts      → УДАЛИТЬ
apps/api/src/routes/travel-agents.ts  → УДАЛИТЬ
```

---

## Фаза 4 — API: обнови `/api/bookings`

В `apps/api/src/routes/bookings.ts`:

1. Замени импорты: `guests`, `companies`, `travelAgents` → `profiles`
2. В запросах на создание/обновление брони замени поля:
   - `guestId` → `guestProfileId` (обязательное)
   - `companyId` → `companyProfileId` (опциональное)
   - `travelAgentId` → `agentProfileId` (опциональное)
   - добавь `sourceProfileId` (опциональное)
3. В GET `/api/bookings/:id` добавь JOIN/select полей гостя из `profiles`:
   - `guestName: profiles.name`
   - `guestFirstName: profiles.firstName`
   - `guestLastName: profiles.lastName`
4. В GET `/api/bookings` (список) аналогично — выводи `guestName` из profiles.
5. Удали проверки/ссылки на `bookings.guestId` — используй `bookings.guestProfileId`.

---

## Фаза 5 — Обнови seed

В `packages/db/src/seed.ts`:

1. Удали импорты `guests`, `companies`, `travelAgents`
2. Добавь импорт `profiles`
3. Замени вставки в старые таблицы — вставляй напрямую в `profiles`:
   - Несколько `individual` профайлов (бывшие гости)
   - Несколько `company` профайлов
   - Несколько `travel_agent` профайлов
   - Несколько `source` профайлов (DIRECT, BOOKING, EXPEDIA, WALKIN)
4. В создании броней используй `guestProfileId` вместо `guestId`

---

## Фаза 6 — Frontend: `/configuration/profiles`

### 6.1 Удали старые страницы

```
apps/web/src/app/configuration/companies/       → УДАЛИТЬ папку
apps/web/src/app/configuration/travel-agents/   → УДАЛИТЬ папку
```

### 6.2 Создай `/configuration/profiles/`

Структура:
```
apps/web/src/app/configuration/profiles/
  page.tsx           — список с табами: All / Guests / Companies / Agents / Sources
  [id]/page.tsx      — просмотр/редактирование
  new/page.tsx       — создание (query param: ?type=individual|company|travel_agent|source)
  profile-form.tsx   — единая форма с условными секциями по типу
  profiles-list.tsx  — клиентский компонент со строкой поиска
```

**`page.tsx`** — серверный компонент:
- Получает query params: `type?`, `q?`
- Делает fetch `GET /api/profiles?propertyId=&type=&q=`
- Рендерит `ProfilesList` + кнопки "Add Guest / Company / Agent / Source"

**`profiles-list.tsx`** — клиентский компонент:
- Табы фильтрации: All | Individual | Company | Travel Agent | Source
- Строка поиска
- Таблица: Name | Type (badge) | Email | Phone | Active

**`profile-form.tsx`** — клиентский компонент:
- Всегда показывает: Name, Email, Phone, Notes, Active
- Если `type === 'individual'`: добавляет First Name, Last Name, Date of Birth, Nationality, Passport №, VIP Status
- Если `type === 'company'`: добавляет Short Name, Tax ID, Credit Limit, Payment Terms (days), AR Account
- Если `type === 'travel_agent'`: добавляет IATA Code (Commission % — показываем поле, помечаем "Coming soon — disabled")
- Если `type === 'source'`: добавляет Source Code, Channel Type (select)
- Contact Person и Contact Title — показывать для company и travel_agent
- POST/PUT на `/api/profiles` и `/api/profiles/:id`

### 6.3 Обнови `/configuration/page.tsx`

Замени карточки Companies и Travel Agents на одну карточку "Profiles" (ссылка на `/configuration/profiles`).

---

## Фаза 7 — Frontend: форма брони

В `apps/web/src/app/bookings/[id]/` и `apps/web/src/app/bookings/new/` (или где создаётся бронь):

1. Замени поле выбора гостя (ищет по `/api/guests`) → `/api/profiles?type=individual&q=`
2. Добавь три опциональных поля с autocomplete:
   - Company → `/api/profiles?type=company&q=`
   - Travel Agent → `/api/profiles?type=travel_agent&q=`
   - Source → `/api/profiles?type=source&q=`
3. При отправке формы используй `guestProfileId`, `companyProfileId`, `agentProfileId`, `sourceProfileId`

Для autocomplete используй паттерн `<input>` с debounce — как в существующей форме поиска гостя.

---

## Фаза 8 — Тесты

Обнови `apps/api/src/routes/integration.test.ts`.

### Удали тесты для:
- Companies CRUD (тест-блок про companies — удали)
- Travel Agents CRUD (удали)

### Добавь тесты для Profiles CRUD:

```
describe("Profiles — Individual CRUD")
  test: POST /api/profiles (type=individual) → 201, returns profile with firstName
  test: GET /api/profiles?type=individual → 200, array includes created profile
  test: GET /api/profiles/:id → 200, correct fields
  test: PUT /api/profiles/:id → 200, name updated
  test: DELETE with bookings → 400, code=HAS_BOOKINGS
  test: DELETE without bookings → 200, success=true

describe("Profiles — Company CRUD")
  test: POST /api/profiles (type=company) → 201, taxId present
  test: GET /api/profiles?type=company → includes company
  test: PUT → updated
  test: DELETE → success

describe("Profiles — Travel Agent CRUD")
  test: POST (type=travel_agent) → 201, iataCode present
  test: GET ?type=travel_agent → includes agent

describe("Profiles — Source CRUD")
  test: POST (type=source) → 201, sourceCode present
  test: GET ?type=source → includes source

describe("Profiles — Search")
  test: GET /api/profiles?q=partial_name → finds matching profiles across types

describe("Booking with profile IDs")
  test: POST /api/bookings with guestProfileId → 201
  test: GET /api/bookings/:id → has guestName from profile
  test: POST with invalid guestProfileId → 400 or 404
```

Используй тот же паттерн `api<T>()` хелпера, что уже есть в файле. `PROP` константа уже определена.

---

## Завершение

После всех изменений:

1. Убедись что TypeScript не ругается: в `apps/api/` и `apps/web/` нет ошибок типов (все старые импорты `guests`, `companies`, `travelAgents` заменены).
2. Сохрани отчёт в `docs/plans/glm/05-unified-profiles-result.md`:
   - Список созданных файлов
   - Список удалённых файлов
   - Список изменённых файлов с кратким описанием
   - Как запустить тесты: команда
   - Как проверить вручную: 2-3 curl-запроса
