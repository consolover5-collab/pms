---
project_name: pms
user_name: Oci
date: '2026-02-18'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'critical_rules']
status: complete
rule_count: 47
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| | Технология | Версия |
|---|---|---|
| Frontend | Next.js (App Router only) | 16.1.6 |
| UI | React | 19.2.3 |
| CSS | Tailwind CSS | 4.x |
| Backend | Fastify | 5.7.4 |
| ORM | Drizzle ORM | 0.44.7 |
| DB | PostgreSQL (драйвер: postgres) | 16 / 3.4.8 |
| Language | TypeScript | 5.7 |
| Runtime | Node.js | 22 LTS |

### Проектно-специфичные правила стека

- **TypeScript**: `moduleResolution: bundler` — НЕ добавляй `.js` к относительным импортам
- **Tailwind 4**: конфиг только в CSS — `@import "tailwindcss"` в globals.css; `tailwind.config.js` не создаётся
- **Fastify**: каждый роут — `FastifyPluginAsync`, регистрация через `app.register()` в `server.ts`; эталон — `apps/api/src/routes/bookings.ts`
- **Drizzle**: адаптер `drizzle-orm/postgres-js`; `decimal/numeric` возвращается как **строка**; миграции только через `pnpm db:generate` + `pnpm db:migrate`
- **ESM**: `__dirname` недоступен → `fileURLToPath(import.meta.url)`
- **bcrypt**: нативная компиляция — добавляй нативные пакеты в `pnpm.onlyBuiltDependencies`
- **Монорепо**: внутренние deps как `"@pms/пакет": "workspace:*"`; бизнес-логика → `packages/domain/` (без фреймворков); `@pms/shared` — только общие TypeScript-типы (не утилиты)
- `formatCurrency()` → `apps/web/src/lib/format.ts` (только фронт)

---

## Critical Implementation Rules

### Language-Specific Rules

- **Strict mode**: `strict: true` + `isolatedModules: true` во всех tsconfig
  НЕ используй `const enum` (ломается при `isolatedModules`) и namespace-реэкспорты
- **Path aliases**: `@/` → `src/` работает только в `@pms/web` (Next.js)
  В `@pms/api` и пакетах — только относительные пути (`../lib/validation`)
- **Обработка ошибок в роутах**: всегда `return reply.status(4xx).send({ error: "..." })`
  Без `return` — риск "Cannot set headers after they are sent"
  Незахваченные исключения → Fastify отдаёт 500 автоматически
- **UUID**: все ID генерируются БД через `gen_random_uuid()`, не в коде приложения
- **Drizzle-типы**: `typeof table.$inferSelect` / `typeof table.$inferInsert` вместо ручных интерфейсов
- **Drizzle-enum**: используй `pgEnum` из `drizzle-orm/pg-core` (тип на уровне БД),
  не TypeScript `enum`; определения в `packages/db/src/schema/`
- **Domain-функции**: явно экспортируй типы возвращаемых значений в `packages/domain/`
  (не полагайся на вывод типов при потреблении из `@pms/api`)
- **Явный return**: в роутах всегда `return` перед `reply` — Fastify 5 не сериализует `undefined`

### Framework-Specific Rules

**Next.js (App Router)**
- Server Components по умолчанию — `"use client"` только для хуков/браузерных API
- Данные в Server Component: `apiFetch(path, options?)` из `@/lib/api`
  (добавляет `NEXT_PUBLIC_API_URL` + forward headers из `next/headers`)
  Данные в Client Component: прямой `fetch()`
- После save/submit: `router.replace()` вместо `router.push()` — предотвращает back-button loop
- SSR-ошибки: `try/catch` + inline красный `<div>` с сообщением (не throw на уровне страницы)
- Поиск гостей: debounce 300ms через `setTimeout/clearTimeout` (не библиотеки)
- Role-based UI: `useUser()` из `@/lib/use-user.ts` — не пиши свою логику проверки ролей
- Folio Optimistic UI: pending-строки показываются с `opacity-60`
- Валюта на фронте: `formatCurrency()` из `@/lib/format.ts` (ru-RU, 2 decimals)

**Fastify**
- Роут: `FastifyPluginAsync`, регистрация в `server.ts` через `app.register()`
- Валидация: функции из `apps/api/src/lib/validation.ts` (не пиши свою)
- Multi-table операции: `app.db.transaction(async (tx) => { ... })` — внутри используй `tx`, не `app.db`
- Пагинация: всегда `{ data: [...], total: N }` + поддержка `?limit=50&offset=0` (max 100)
- Confirmation numbers: генерируются автоматически в `routes/bookings.ts` — не генерируй вручную

**Drizzle / БД**
- Схема: `packages/db/src/schema/` (rooms.ts, guests.ts, bookings.ts, financial.ts, users.ts)
- После изменения схемы: только `pnpm db:generate` → `pnpm db:migrate`
- Все FK: `onDelete: "restrict"` — перед DELETE делай `SELECT COUNT(*)` по ВСЕМ зависимым таблицам
  включая soft-deleted; возвращай `400 { error: "Нельзя удалить: связано с N бронированиями" }`
- Soft delete: записи не удаляются физически
- Check-in: `SELECT ... FOR UPDATE` в транзакции (race condition prevention)
- Night Audit: пропускай уже posted charges по `(bookingId, businessDate)` — идемпотентность
- Деньги хранятся как `decimal` (строка из Drizzle), на фронте → `formatCurrency()`

### Testing Rules

- **Фреймворк**: Node.js built-in `node:test` + `tsx` (без Vitest/Jest — намеренно, нет лишних deps)
  Нет встроенного mocking — используй dependency injection вместо моков
  ```ts
  import { test } from 'node:test';
  import assert from 'node:assert/strict';
  ```
- **Расположение**: `*.test.ts` в той же директории что и тестируемый файл
- **Конвенции**: используй `test()` для тест-кейсов; стиль именования — как в существующих тестах
- **Запуск тестов**: `npx tsx --test src/lib/validation.test.ts` из `apps/api/`
  ⚠️ Нет `test` script в `package.json` — при добавлении новых тестов добавь script
- **Что тестировать**: бизнес-логику в `packages/domain/` и `apps/api/src/lib/`
  Чистые функции — передавай данные напрямую, без БД и HTTP
- **Обязательно**: новая бизнес-логика в `packages/domain/` **требует** unit-теста
  (domain изолирован именно для этого — без теста нет смысла в изоляции)
- **Даты в тестах**: всегда ISO-строка `'2026-01-15'`, не объект `new Date()`
  Domain-функции, зависящие от даты, принимают её как параметр (не `new Date()` внутри)
- **API-тесты**: при необходимости — `app.inject()` из `light-my-request` (встроен в Fastify)
  Без реального сервера; требует тест-БД (пока не настроено — только unit-тесты)
- **Что НЕ тестировать**: UI-компоненты, E2E (нет setup для MVP)
- **Текущее покрытие**: `apps/api/src/lib/validation.test.ts` — даты, occupancy, room conflicts
  Не дублируй уже покрытые случаи
- **Изоляция domain**: `packages/domain/` без внешних зависимостей — намеренно
  Не импортируй fastify/drizzle/next в domain — сломает тестируемость
- **Перед коммитом**: `pnpm typecheck` + `pnpm lint` + `pnpm build` + все тесты зелёные

### Code Quality & Style Rules

**Именование**
- Файлы: `kebab-case` везде (`booking-detail.tsx`, `use-user.ts`)
- Компоненты React: `PascalCase` (`BookingSearchForm`)
- Функции/переменные: `camelCase`; route-модули: суффикс `Routes` (`bookingsRoutes`)

**Структура файлов**
- Страницы: `apps/web/src/app/[route]/page.tsx`
- Компоненты страницы: рядом с `page.tsx` в той же директории (`search-form.tsx`, `date-filter.tsx`)
- API-роуты: `apps/api/src/routes/[resource].ts` (один файл = один ресурс)
- Типы локальные к файлу: объявляй в том же файле, не выноси в отдельный `types.ts`
- `app/layout.tsx` общий для всего — не создавай вложенные layout'ы без необходимости

**Стиль кода**
- Отступы: **2 пробела** (не табы)
- ESLint: `eslint-config-next` в web; без Prettier
- Комментарии только там где логика неочевидна
- JSDoc только для публичных функций в `packages/domain/` — не везде

**UI-паттерны (Tailwind)**
- Статусные цвета бронирований (фиксированные):
  `confirmed→blue`, `checked_in→green`, `checked_out→gray`, `cancelled→red`, `no_show→yellow`
  Формат: `bg-{color}-100 text-{color}-800`
- Кнопки: синие для charges (`bg-blue-600`), зелёные для payments (`bg-green-600`)
- Таблицы: `divide-y divide-gray-200`, hover: `hover:bg-gray-50`
- Формы: `border border-gray-300 rounded-md px-3 py-2`
- Пустые состояния: всегда показывай текст ("Нет данных"), не оставляй пустой экран
- Loading: нет spinner-компонента — используй текст или `opacity-60` на pending-элементах

### Development Workflow Rules

**Git**
- Ветка по умолчанию: `main`
- Коммит-сообщения: Conventional Commits
  `feat: add room availability API` · `fix: prevent double check-in race condition`
  Префиксы: `feat:` `fix:` `refactor:` `docs:`

**Команды разработки**
- `pnpm dev` — запуск web + api параллельно через Turborepo
  ⚠️ При холодном старте web покажет ошибку fetch пока API не поднялся — это нормально
- Web: порт **3000** (зафиксирован `--port 3000`)
- `pnpm build` · `pnpm typecheck` · `pnpm lint` — все из корня монорепо
- При странных ошибках сборки: `pnpm turbo clean` сбрасывает кэш

**Переменные окружения** (не коммитятся)
- `packages/db/.env` → `DATABASE_URL`
- `apps/api/.env` → `DATABASE_URL`, `PORT`, `JWT_SECRET`
- `apps/web/.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:3001`

**БД**
- `pnpm db:generate` → `pnpm db:migrate` — после изменения схемы
- `pnpm db:seed` — **полный сброс БД**: удаляет все данные (гости, бронирования, комнаты, пользователи) и пересевает заново

**MCP / Oracle**
- Oracle-коннектор: `tools/mcp-server/`
- Credentials: `.mcp.json` в корне (не в git, `.gitignore`)

**Auth**
- Аутентификация: код реализован но **намеренно отключён** (см. `apps/api/src/plugins/auth.ts`)
  Не "чини" auth middleware — он выключен осознанно для разработки

### Critical Don't-Miss Rules

> Эти правила обеспечивают целостность данных, тестируемость и консистентность проекта.
> Не нарушай их без явного согласования с архитектурным решением.

**Никогда не делай**
- ❌ Хранить деньги как `number` — только строки из Drizzle, `formatCurrency()` на фронте
- ❌ Использовать `new Date()` как бизнес-дату — только из таблицы `business_dates`
- ❌ Передавать `id` при INSERT — UUID генерируется автоматически через Drizzle default
- ❌ Создавать SQL-миграции вручную — только `pnpm db:generate`
- ❌ Импортировать fastify/drizzle/next в `packages/domain/`
- ❌ Использовать `__dirname` в ESM — `fileURLToPath(import.meta.url)`
- ❌ Создавать `tailwind.config.js` — Tailwind 4 настраивается только в CSS
- ❌ Удалять записи физически — soft delete или RESTRICT pre-check
- ❌ Класть бизнес-логику в route-handler — только в `packages/domain/`
- ❌ `router.push()` после save — только `router.replace()`
- ❌ Забывать `await` перед Drizzle-запросами (TypeScript не всегда поймает)
- ❌ Вызывать `reply.send()` дважды — всегда `return reply.send()` при раннем выходе
- ❌ Проверять nullable поля через `!value` — Drizzle возвращает `null`, используй `=== null`

**Критические инварианты**
- **propertyId**: каждый DB-запрос фильтруется по `propertyId` — не забывай этот WHERE
- **2D статус комнаты**: `housekeepingStatus` (clean/dirty/pickup/inspected/out_of_order/out_of_service) и `occupancyStatus` (vacant/occupied) — два независимых поля, меняются отдельно
- **HK-статус**: изменения housekeeping status только через `validateRoomStatusUpdate()` в `apps/api/src/lib/validation.ts`
- **Folio**: транзакции только append-only, никакого UPDATE/DELETE записей
- **Night Audit**: идемпотентен — пропускает уже posted `(bookingId, businessDate)`
- **Check-in**: `SELECT ... FOR UPDATE` в транзакции — обязательно
- **Все FK**: `onDelete: "restrict"` — перед DELETE всегда pre-check всех зависимостей

**Фиксированные данные (не изменяй без миграции)**
- Коды типов комнат: `STD` `STD_TWN` `SUP` `PRM` `JRS` `STE`
- Seed-данные: property `GBH` (Grand Baltic Hotel), 54 комнаты, 10 гостей, 10 бронирований
- Статусы бронирований: `confirmed` `checked_in` `checked_out` `cancelled` `no_show`

**Безопасность**
- Никогда не хардкодить секреты — только через `.env`
- Explicit field whitelists на mutations — не spread `request.body` целиком
- Валидировать пользовательский ввод перед любой DB-операцией

---

## Usage Guidelines

**For AI Agents:**
- Читай этот файл перед реализацией любого кода в проекте
- Следуй ВСЕМ правилам точно как задокументировано
- При сомнениях — выбирай более строгий вариант
- Обновляй файл если обнаружил новые паттерны

**For Humans:**
- Держи файл lean — только то что агентам нужно знать
- Обновляй при изменении стека или архитектурных решений
- Удаляй правила которые стали очевидными со временем

_Last Updated: 2026-02-18_
