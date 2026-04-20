# Задача 03: Schema — companies + travel_agents

## Контекст
Сейчас PMS знает только о физических лицах (guests). Бизнес-отель работает с компаниями и турагентами.
Создаём отдельные таблицы — НЕ расширяем guests, т.к. у компании нет firstName/lastName/dateOfBirth.

## Файлы для чтения (ОБЯЗАТЕЛЬНО прочитай перед началом)
- `packages/db/src/schema/guests.ts` — пример структуры таблицы
- `packages/db/src/schema/rooms.ts` — пример с unique constraint и index
- `packages/db/src/schema/index.ts` — здесь добавить экспорт
- `packages/db/src/index.ts` — проверить что re-export из schema/

## Что сделать

### Шаг 1: Создать файл schema

Создай файл `packages/db/src/schema/companies.ts`:

```typescript
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 255 }).notNull(),
  shortName: varchar("short_name", { length: 100 }),
  taxId: varchar("tax_id", { length: 50 }),
  registrationNumber: varchar("registration_number", { length: 50 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  contactPerson: varchar("contact_person", { length: 255 }),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  paymentTermDays: integer("payment_term_days").notNull().default(30),
  arAccountNumber: varchar("ar_account_number", { length: 50 }),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("companies_property_tax_id").on(table.propertyId, table.taxId),
  index("companies_property_id_idx").on(table.propertyId),
]);

export const travelAgents = pgTable("travel_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 255 }).notNull(),
  iataCode: varchar("iata_code", { length: 20 }),
  commissionPercent: decimal("commission_percent", { precision: 5, scale: 2 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  contactPerson: varchar("contact_person", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("travel_agents_property_id_idx").on(table.propertyId),
]);
```

### Шаг 2: Добавить экспорт в index.ts

В файле `packages/db/src/schema/index.ts` добавь строку:
```typescript
export * from "./companies";
```

### Шаг 3: Применить миграцию

```bash
cd /home/oci/pms && pnpm exec drizzle-kit push
```

Если drizzle-kit не установлен или не работает:
```bash
cd /home/oci/pms/packages/db && pnpm exec drizzle-kit push
```

Если drizzle-kit push не работает, создай SQL миграцию вручную и выполни через psql:
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(100),
  tax_id VARCHAR(50),
  registration_number VARCHAR(50),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  contact_person VARCHAR(255),
  credit_limit DECIMAL(12,2),
  payment_term_days INTEGER NOT NULL DEFAULT 30,
  ar_account_number VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT companies_property_tax_id UNIQUE (property_id, tax_id)
);
CREATE INDEX companies_property_id_idx ON companies(property_id);

CREATE TABLE travel_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  iata_code VARCHAR(20),
  commission_percent DECIMAL(5,2),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  contact_person VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX travel_agents_property_id_idx ON travel_agents(property_id);
```

### Шаг 4: Проверить

```bash
cd /home/oci/pms && pnpm exec tsc --noEmit
```

Проверь что таблицы создались:
```bash
psql $DATABASE_URL -c "\dt companies" -c "\dt travel_agents"
```

## НЕ ДЕЛАЙ
- НЕ меняй таблицу guests — она остаётся для физических лиц
- НЕ добавляй FK в bookings (это задача 14)
- НЕ создавай routes (это задача 04)
- НЕ добавляй seed data (это задача 15)

## Критерии приёмки
- [ ] Файл `packages/db/src/schema/companies.ts` создан
- [ ] Экспорт добавлен в `packages/db/src/schema/index.ts`
- [ ] Таблицы companies и travel_agents существуют в БД
- [ ] TypeScript typecheck чистый
- [ ] Существующие тесты проходят (новые таблицы не ломают старые)
