# Промпты для Gemini CLI — PMS Demo Readiness Plan
> Дата: 2026-04-10  
> Цель: демо с бизнес-логикой, выверенной по Oracle Opera PMS  
> Исполнитель: Gemini CLI (один промпт = одна сессия)

---

## Текущее состояние (что уже сделано)

- Все TypeScript-схемы новых таблиц написаны: `companies`, `travel_agents`, `booking_daily_details`, `cashier_sessions`, `folio_windows`, `packages`, `rate_plan_packages`, `hk_tasks`
- `bookings` уже содержит `companyId` + `travelAgentId` FK
- `folio_transactions` уже содержит `folioWindowId` + `cashierSessionId` FK
- `seed.ts` вставляет все новые данные
- Ночной аудит читает ставку из `booking_daily_details`, постит пакеты, использует `folioWindowId`
- Файлы маршрутов для новых модулей существуют: `companies.ts`, `travel-agents.ts`, `cashier.ts`, `packages.ts`, `housekeeping.ts`
- Интеграционные тесты уже покрывают новые модули
- Auth намеренно отключён (не трогать)

## Порядок выполнения

```
PROMPT-01 (Migration)  ←── BLOCKER для всего остального
    ↓
PROMPT-02 (Checkout balance)  ←── Opera alignment
PROMPT-03 (Dirty room warn)   ←── Opera alignment  
PROMPT-04 (Due In/Out UI)     ←── Opera alignment
    ↓
PROMPT-05 (Companies/TA web)  ←── новые UI страницы
PROMPT-06 (Packages web)      ←── новые UI страницы
PROMPT-07 (HK Tasks web)      ←── новые UI страницы
    ↓
PROMPT-08 (Mass assignment)   ←── безопасность
PROMPT-09 (Refactor biz date) ←── tech debt
```

---

## PROMPT-01 — SQL Migration 0006 (КРИТИЧЕСКИЙ БЛОКЕР)

```
Ты работаешь над open-source PMS (Property Management System) — TypeScript монорепозиторий.
Прежде всего прочитай AGENTS.md в корне проекта — там описаны все паттерны и соглашения.

КОНТЕКСТ:
Все новые TypeScript-схемы написаны (companies, travel_agents, booking_daily_details,
cashier_sessions, folio_windows, packages, rate_plan_packages, hk_tasks), но SQL-миграции
для них нет. Последняя миграция: packages/db/drizzle/0005_opera_alignment.sql.
Без миграции база данных не содержит этих таблиц — всё падает.

ЗАДАЧА:
Сгенерируй SQL-миграцию 0006, которая создаёт все 7 новых таблиц.

ШАГ 1 — Прочитай эти файлы, чтобы понять схему:
- packages/db/src/schema/companies.ts
- packages/db/src/schema/booking-daily-details.ts
- packages/db/src/schema/financial.ts  (cashierSessions + folioWindows + изменения в folioTransactions)
- packages/db/src/schema/bookings.ts   (companyId + travelAgentId FK в таблице bookings)
- packages/db/src/schema/packages.ts
- packages/db/src/schema/housekeeping.ts
- packages/db/drizzle/0005_opera_alignment.sql  (образец стиля)
- packages/db/drizzle.config.ts                  (конфиг Drizzle)

ШАГ 2 — Запусти генерацию миграции:
  cd /home/oci/pms && pnpm db:generate

Это создаст файл packages/db/drizzle/0006_*.sql автоматически из diff схем.

ШАГ 3 — Проверь сгенерированный файл:
- Убедись что он содержит CREATE TABLE для: companies, travel_agents, booking_daily_details,
  cashier_sessions, folio_windows, rate_plan_packages, hk_tasks
- Убедись что он содержит ALTER TABLE bookings ADD COLUMN company_id и travel_agent_id
- Убедись что он содержит ALTER TABLE folio_transactions ADD COLUMN folio_window_id
  и cashier_session_id
- Если чего-то не хватает — добавь вручную, сверяясь со схемой

ШАГ 4 — Примени миграцию:
  cd /home/oci/pms && pnpm db:migrate

ШАГ 5 — Проверь typecheck:
  cd /home/oci/pms && pnpm typecheck

ШАГ 6 — Пересиди базу (новые таблицы должны наполниться данными):
  cd /home/oci/pms && pnpm db:seed

КРИТЕРИИ ПРИЁМКИ:
- [ ] pnpm db:generate завершается без ошибок
- [ ] Файл 0006_*.sql создан и содержит все новые таблицы
- [ ] pnpm db:migrate применяет без ошибок
- [ ] pnpm db:seed заполняет все таблицы (выводит "Seeded: ...")
- [ ] pnpm typecheck — нет ошибок
- [ ] psql: SELECT COUNT(*) FROM companies; — возвращает 3

ВАЖНЫЕ ОГРАНИЧЕНИЯ:
- Не менять схемы TypeScript — они уже правильные
- Не удалять существующие миграции
- Не запускать pnpm db:seed без предварительного pnpm db:migrate
- Auth в app.ts закомментирован — не трогать
```

---

## PROMPT-02 — Checkout: проверка баланса по окнам фолио

```
Ты работаешь над open-source PMS (Property Management System) — TypeScript монорепозиторий.
Прежде всего прочитай AGENTS.md в корне проекта — там описаны все паттерны и соглашения.

КОНТЕКСТ (OPERA ALIGNMENT):
В Opera PMS при выезде гостя система проверяет баланс КАЖДОГО окна фолио отдельно.
Нельзя выехать пока хотя бы одно окно имеет положительный баланс.
Текущий код в apps/api/src/routes/bookings.ts (строки ~773-785) проверяет СУММАРНЫЙ
баланс по всем транзакциям — это неправильно, если у брони несколько окон.

ЗАДАЧА:
Изменить валидацию баланса при checkout в POST /api/bookings/:id/checkout так, чтобы
проверялся баланс каждого folio window отдельно.

ШАГ 1 — Прочитай эти файлы:
- apps/api/src/routes/bookings.ts (найди POST /api/bookings/:id/checkout — секция "Проверка баланса фолио")
- packages/db/src/schema/financial.ts (folioWindows + folioTransactions)
- packages/domain/src/folio.ts (функция calculateFolioBalance)
- apps/api/src/routes/folio.ts (как используются окна)

ШАГ 2 — Логика изменения:
Вместо одного SELECT по всем транзакциям брони:

  БЫЛО:
    SELECT debit, credit FROM folio_transactions WHERE booking_id = $id
    → balance = SUM(debit) - SUM(credit)
    → если balance > 0: ошибка

  СТАЛО:
    1. Получить все folio_windows для этой брони
    2. Если окон нет — откатиться к старой логике (aggregate balance)
    3. Для каждого окна:
       a. Транзакции с folioWindowId = window.id
       b. Транзакции с folioWindowId IS NULL (нераспределённые — к Window 1)
       c. balance = SUM(debit) - SUM(credit)
       d. Если balance > 0: вернуть 400 с указанием номера окна и суммы
    4. Если все окна zero: разрешить выезд

ШАГ 3 — Код:
Замени секцию "Проверка баланса фолио" (~строки 772-785) на новую логику.
Используй Drizzle ORM паттерн из этого файла (не sql raw).
Ошибка должна быть на русском языке, например:
  "Нельзя выехать: окно {N} ({label}) имеет открытый баланс {X}. Примите оплату."

ШАГ 4 — Проверь:
  cd /home/oci/pms && pnpm typecheck
  cd apps/api && pnpm test:integration   (нужна запущенная БД и API)

КРИТЕРИИ ПРИЁМКИ:
- [ ] Если все окна имеют нулевой баланс — checkout проходит
- [ ] Если хотя бы одно окно имеет balance > 0 — checkout возвращает 400 с кодом UNPAID_BALANCE
- [ ] В ответе ошибки указан windowNumber и label проблемного окна
- [ ] Нераспределённые транзакции (folioWindowId IS NULL) учитываются в Window 1
- [ ] pnpm typecheck — чисто
- [ ] Существующие тесты не сломаны

ОГРАНИЧЕНИЯ:
- Фолио append-only — никогда не UPDATE/DELETE folio_transactions
- Не трогать другие эндпоинты в файле
- Оставить старую логику как fallback если folio_windows не существует для брони
```

---

## PROMPT-03 — Предупреждение при заселении в грязный номер

```
Ты работаешь над open-source PMS (Property Management System) — TypeScript монорепозиторий.
Прежде всего прочитай AGENTS.md в корне проекта — там описаны все паттерны и соглашения.

КОНТЕКСТ (OPERA ALIGNMENT):
В Opera PMS при заселении гостя в номер с housekeepingStatus = 'dirty' или 'pickup'
система выдаёт предупреждение. Фронт-деск видит предупреждение и может подтвердить
заселение или подождать пока горничная доделает уборку. Это НЕ блокирующая ошибка —
гость может заселиться, но персонал должен знать.

Текущий код: POST /api/bookings/:id/check-in в apps/api/src/routes/bookings.ts
не проверяет housekeepingStatus номера.

ЗАДАЧА:
Добавить предупреждение при check-in если номер грязный.

ШАГ 1 — Прочитай:
- apps/api/src/routes/bookings.ts (найди POST /api/bookings/:id/check-in)
- packages/db/src/schema/rooms.ts (housekeepingStatus валидные значения)

ШАГ 2 — Логика в API:
После получения booking и проверки статуса (перед финальной транзакцией check-in),
добавить:

  1. Если у брони есть roomId — получить housekeepingStatus номера
  2. Если housekeepingStatus = 'dirty' или 'pickup':
     a. Если в теле запроса НЕТ флага `force: true` — вернуть 400:
        {
          error: "Номер {roomNumber} требует уборки (статус: {housekeepingStatus}). Дождитесь горничной или используйте force=true для принудительного заселения.",
          code: "ROOM_NOT_READY",
          housekeepingStatus: "dirty",
          roomNumber: "301"
        }
     b. Если `force: true` — заселить без препятствий (только логировать)
  3. Если housekeepingStatus = 'inspected' или 'clean' — заселять без вопросов

ШАГ 3 — В Web UI обновить форму check-in:
Файл: apps/web/src/app/bookings/[id]/ (найди кнопку Check-In или форму)
  - Если API вернул ROOM_NOT_READY: показать диалог-подтверждение с предупреждением
  - Кнопка "Заселить всё равно" делает повторный запрос с force=true
  - Кнопка "Отмена" закрывает диалог

ШАГ 4 — Проверь:
  pnpm typecheck

КРИТЕРИИ ПРИЁМКИ:
- [ ] Check-in в clean/inspected номер — работает без изменений
- [ ] Check-in в dirty номер без force — возвращает 400 с кодом ROOM_NOT_READY
- [ ] Check-in в dirty номер с force=true — заселяет успешно
- [ ] В web UI показывается предупреждение с кнопками подтверждения
- [ ] pnpm typecheck — чисто
- [ ] Существующие тесты не сломаны

ОГРАНИЧЕНИЯ:
- Не трогать логику смены housekeepingStatus — только ЧИТАТЬ статус
- В AGENTS.md: статусы номера — 'clean' | 'dirty' | 'pickup' | 'inspected' | 'out_of_order' | 'out_of_service'
- Auth закомментирован — не трогать
```

---

## PROMPT-04 — Due In / Due Out в веб-интерфейсе

```
Ты работаешь над open-source PMS (Property Management System) — TypeScript монорепозиторий.
Прежде всего прочитай AGENTS.md в корне проекта — там описаны все паттерны и соглашения.

КОНТЕКСТ (OPERA ALIGNMENT):
В Opera PMS список приезжающих называется "Due In" — гости, которые должны заехать сегодня
со статусом 'confirmed'. Список выезжающих называется "Due Out" — гости со статусом
'checked_in' и checkOutDate = сегодня.
Текущий UI показывает стандартные бейджи статуса ('confirmed' синий, 'checked_in' зелёный)
вместо специальных "Due In" / "Due Out" бейджей.

ЗАДАЧА:
Обновить отображение статусов в страницах Arrivals и Departures.

ШАГ 1 — Прочитай эти файлы:
- apps/web/src/app/bookings/page.tsx  (список броней с фильтрами view=arrivals, view=departures)
- apps/web/src/app/bookings/  (посмотри все файлы в папке)
- apps/web/src/app/  (посмотри структуру страниц)

ШАГ 2 — Что изменить в UI:
A. В списке бронирований при view=arrivals:
   - Бронирования со status='confirmed' и checkInDate=сегодня → показать бейдж
     "Due In" (оранжевый, bg-orange-100 text-orange-800) вместо синего "confirmed"
   - Бронирования со status='checked_in' и checkInDate=сегодня → показать бейдж
     "Заселён сегодня" (зелёный, bg-green-100 text-green-800)

B. В списке бронирований при view=departures:
   - Бронирования со status='checked_in' и checkOutDate=сегодня → показать бейдж
     "Due Out" (жёлтый, bg-yellow-100 text-yellow-800) вместо зелёного "checked_in"
   - Бронирования со status='checked_out' и actualCheckOut=сегодня → показать бейдж
     "Выехал сегодня" (серый, bg-gray-100 text-gray-800)

C. В Dashboard (apps/web/src/app/page.tsx или dashboard):
   - Счётчики "Arrivals today" и "Departures today" должны называться "Due In" и "Due Out"

ШАГ 3 — Логика определения "сегодня":
API возвращает текущую бизнес-дату в ответах. Сравнивай checkInDate/checkOutDate
с полем businessDate из ответа API (не с new Date() на клиенте!).

ШАГ 4 — Проверь:
  pnpm typecheck
  cd apps/web && pnpm build (нет ошибок сборки)

КРИТЕРИИ ПРИЁМКИ:
- [ ] На странице Arrivals (view=arrivals) confirmed брони имеют оранжевый бейдж "Due In"
- [ ] На странице Departures (view=departures) checked_in брони имеют жёлтый бейдж "Due Out"
- [ ] Бейджи используют паттерн: bg-{color}-100 text-{color}-800 (согласно AGENTS.md)
- [ ] На Dashboard счётчики называются "Due In" / "Due Out"
- [ ] pnpm typecheck — чисто
- [ ] pnpm build (web) — нет ошибок

ОГРАНИЧЕНИЯ:
- Tailwind 4: только CSS-конфиг, никогда не создавать tailwind.config.js
- Server Components по умолчанию, "use client" только при необходимости
- Не изменять API — только UI
```

---

## PROMPT-05 — Web UI: Компании и Турагенты

```
Ты работаешь над open-source PMS (Property Management System) — TypeScript монорепозиторий.
Прежде всего прочитай AGENTS.md в корне проекта — там описаны все паттерны и соглашения.

КОНТЕКСТ:
API для компаний и турагентов уже реализован:
  - GET/POST /api/companies
  - GET/PUT/DELETE /api/companies/:id
  - GET/POST /api/travel-agents
  - GET/PUT/DELETE /api/travel-agents/:id
Нет только web-страниц.

ЗАДАЧА:
Создать страницы управления компаниями и турагентами в секции Configuration.

ШАГ 1 — Прочитай для понимания паттернов:
- apps/web/src/app/configuration/page.tsx (или найди конфигурационный раздел)
- apps/web/src/app/configuration/rate-plans/page.tsx (образец CRUD страницы)
- apps/web/src/lib/api.ts  (apiFetch функция)
- apps/web/src/lib/format.ts  (formatCurrency)
- apps/api/src/routes/companies.ts (структура ответов API)
- apps/api/src/routes/travel-agents.ts (структура ответов API)
- packages/db/src/schema/companies.ts (поля таблиц)

ШАГ 2 — Создай страницу компаний: apps/web/src/app/configuration/companies/page.tsx
Функционал:
  - Список компаний (name, shortName, taxId, contactPerson, isActive)
  - Поиск по названию
  - Кнопка "Добавить компанию" → форма
  - В строке каждой компании: кнопки Редактировать / Деактивировать
  - Форма создания/редактирования:
    - name (обязательное), shortName, taxId, registrationNumber
    - email, phone, address, contactPerson
    - creditLimit, paymentTermDays (по умолчанию 30)
    - notes
  - Soft-delete через isActive=false (не DELETE, если есть брони)
  - После сохранения: router.replace() (не push!)

ШАГ 3 — Создай страницу турагентов: apps/web/src/app/configuration/travel-agents/page.tsx
Функционал:
  - Список (name, iataCode, commissionPercent, isActive)
  - Форма: name (обязательное), iataCode, commissionPercent, email, phone, contactPerson, notes
  - После сохранения: router.replace()

ШАГ 4 — Добавь ссылки в навигацию/конфигурацию:
Найди где в apps/web/src/app/configuration/ или навбаре размещены ссылки на другие
разделы конфигурации и добавь "Компании" и "Турагенты".

ШАГ 5 — Проверь:
  pnpm typecheck
  cd apps/web && pnpm build

КРИТЕРИИ ПРИЁМКИ:
- [ ] /configuration/companies — список с поиском, добавление, редактирование
- [ ] /configuration/travel-agents — список, добавление, редактирование
- [ ] Формы используют router.replace() после сохранения
- [ ] creditLimit отображается через formatCurrency()
- [ ] Бейдж isActive/неактивен с правильными цветами
- [ ] Ссылки добавлены в навигацию Configuration
- [ ] pnpm typecheck — чисто
- [ ] pnpm build (web) — нет ошибок

ОГРАНИЧЕНИЯ:
- Используй apiFetch для Server Components, прямой fetch для Client Components
- Все URL API жёсткие строки, не хардкод baseUrl — используй api.ts
- Tailwind 4: только CSS, никаких tailwind.config.js
- propertyId берётся из настроек/контекста (смотри как это делают другие страницы)
```

---

## PROMPT-06 — Web UI: Пакеты услуг

```
Ты работаешь над open-source PMS (Property Management System) — TypeScript монорепозиторий.
Прежде всего прочитай AGENTS.md в корне проекта — там описаны все паттерны и соглашения.

КОНТЕКСТ:
API для пакетов реализован в apps/api/src/routes/packages.ts.
Схема: packages/db/src/schema/packages.ts
В сиде есть 2 пакета: BKFST (Завтрак, 800₽/чел/ночь) и PARK (Парковка, 500₽/ночь).
Пакет привязывается к тарифным планам через rate_plan_packages.

ЗАДАЧА:
Создать страницу управления пакетами услуг: apps/web/src/app/configuration/packages/page.tsx

ШАГ 1 — Прочитай для понимания:
- apps/api/src/routes/packages.ts (структура API)
- packages/db/src/schema/packages.ts (поля)
- packages/db/src/schema/financial.ts (transactionCodes — для выбора кода начисления)
- apps/web/src/app/configuration/rate-plans/page.tsx (образец CRUD)

ШАГ 2 — Страница /configuration/packages:
  Список пакетов:
  - Колонки: code, name, amount (formatCurrency), calculationRule, postingRhythm, isActive
  - Бейдж calculationRule: 'per_night'→серый, 'per_stay'→синий, 'per_person_per_night'→фиолетовый

  Форма создания/редактирования:
  - code (уникальный), name, description
  - transactionCodeId — select из GET /api/transaction-codes?propertyId=...
    (показывать code + description)
  - calculationRule — select: per_night | per_stay | per_person_per_night
  - amount — числовое поле (цена; 0 = включён в тариф, отдельно не начисляется)
  - postingRhythm — select: every_night | arrival_only | departure_only
  - isActive — checkbox

  Привязка к тарифным планам (в форме редактирования):
  - Показать список тарифных планов с чекбоксами
  - Чекбокс "Включён в тариф" рядом с каждым планом
  - При сохранении — обновить rate_plan_packages через API

ШАГ 3 — Добавь ссылку "Пакеты" в навигацию Configuration.

ШАГ 4 — Проверь:
  pnpm typecheck
  cd apps/web && pnpm build

КРИТЕРИИ ПРИЁМКИ:
- [ ] /configuration/packages — список всех пакетов
- [ ] Создание пакета с выбором кода транзакции
- [ ] Редактирование: изменение суммы, rhythma, привязки к тарифам
- [ ] formatCurrency для amount
- [ ] router.replace() после сохранения
- [ ] pnpm typecheck — чисто
- [ ] pnpm build (web) — нет ошибок

ОГРАНИЧЕНИЯ:
- Tailwind 4: только CSS
- "use client" только для интерактивных компонентов
- Не создавать отдельные файлы types.ts — типы в том же файле
```

---

## PROMPT-07 — Web UI: Хаускипинг задания

```
Ты работаешь над open-source PMS (Property Management System) — TypeScript монорепозиторий.
Прежде всего прочитай AGENTS.md в корне проекта — там описаны все паттерны и соглашения.

КОНТЕКСТ:
API для HK-заданий реализован в apps/api/src/routes/housekeeping.ts.
Схема: packages/db/src/schema/housekeeping.ts
Задания генерируются через POST /api/housekeeping/tasks/generate (на бизнес-дату).
Типы задач: checkout_clean, stayover_clean, deep_clean, inspection, turndown
Статусы: pending, in_progress, completed, skipped
Приоритет: 0=normal, 1=rush (VIP)

ЗАДАЧА:
Создать страницу хаускипинга: apps/web/src/app/housekeeping/page.tsx

ШАГ 1 — Прочитай:
- apps/api/src/routes/housekeeping.ts (структура API: generate, list, update)
- packages/db/src/schema/housekeeping.ts (поля hkTasks)
- packages/db/src/schema/rooms.ts (housekeepingStatus)

ШАГ 2 — Страница /housekeeping:
  Заголовок: "Хаускипинг — [бизнес-дата]"

  Кнопка "Сгенерировать задания на сегодня":
  - POST /api/housekeeping/tasks/generate
  - Показать сколько заданий создано

  Список заданий, сгруппированных по этажу:
  - Этаж X → список номеров
  - Каждая карточка номера: номер, тип задачи, assignedTo, статус, приоритет
  - Rush-задания (priority=1) — помечены красным восклицательным знаком
  - Статус-бейджи: pending→серый, in_progress→синий, completed→зелёный, skipped→жёлтый
  - Тип задачи: checkout_clean→"Уборка (выезд)", stayover_clean→"Уборка (проживание)",
    inspection→"Инспекция", deep_clean→"Генеральная уборка", turndown→"Вечерняя уборка"

  Действия на карточке задания:
  - Поле "Назначить горничную" (text input) → PATCH статус+assignedTo
  - Кнопки смены статуса: "Начать" (pending→in_progress), "Готово" (→completed), "Пропустить" (→skipped)

  Фильтры:
  - По статусу (dropdown: все / pending / in_progress / completed)
  - По горничной (text input)

ШАГ 3 — Добавь ссылку "Хаускипинг" в навигацию (apps/web/src/components/navbar.tsx).

ШАГ 4 — Проверь:
  pnpm typecheck
  cd apps/web && pnpm build

КРИТЕРИИ ПРИЁМКИ:
- [ ] /housekeeping — загружается без ошибок
- [ ] Генерация заданий через кнопку
- [ ] Список заданий сгруппирован по этажам
- [ ] Смена статуса через кнопки (PATCH запросы)
- [ ] Rush-задания визуально выделены
- [ ] Ссылка "Хаускипинг" в навбаре
- [ ] pnpm typecheck — чисто
- [ ] pnpm build (web) — нет ошибок

ОГРАНИЧЕНИЯ:
- "use client" для интерактивных частей (смена статуса)
- Не использовать drag-and-drop (слишком сложно для MVP)
- Tailwind 4: только CSS
```

---

## PROMPT-08 — Mass assignment fix (безопасность)

```
Ты работаешь над open-source PMS (Property Management System) — TypeScript монорепозиторий.
Прежде всего прочитай AGENTS.md в корне проекта — там описаны все паттерны и соглашения.

КОНТЕКСТ (из backlog.json):
В 5 route-файлах используется spread оператор request.body при обновлении записей.
Это mass assignment vulnerability — клиент может передать любые поля, включая id, propertyId.
AGENTS.md явно запрещает: "Распространение request.body запрещено — использовать явный перечень полей"

ЗАДАЧА:
Заменить spread request.body на explicit field picks в 5 файлах.

ШАГ 1 — Прочитай каждый файл и найди строки с ...request.body:
- apps/api/src/routes/bookings.ts (PATCH /api/bookings/:id — update booking)
- apps/api/src/routes/guests.ts (PATCH /api/guests/:id)
- apps/api/src/routes/rate-plans.ts (PUT /api/rate-plans/:id)
- apps/api/src/routes/room-types.ts (PUT /api/room-types/:id)
- apps/api/src/routes/properties.ts (PUT /api/properties/:id)

ШАГ 2 — Для каждого файла:
  БЫЛО:
    const body = request.body as any;
    await db.update(table).set({ ...body });

  СТАЛО (пример для bookings):
    const { guestId, roomId, checkInDate, checkOutDate, adults, children,
            rateAmount, notes, paymentMethod, guaranteeCode, marketCode,
            sourceCode, channel, ratePlanId, companyId, travelAgentId } = request.body as any;
    await db.update(bookings).set({
      ...(guestId !== undefined && { guestId }),
      ...(roomId !== undefined && { roomId }),
      // ... только разрешённые поля
      updatedAt: new Date(),
    });

  ПРАВИЛА для explicit picks:
  - Никогда не включать: id, propertyId, confirmationNumber, createdAt
  - Включать только поля, которые клиент имеет право менять
  - Для status — отдельный эндпоинт (не через PATCH, статусы меняются через check-in/out/cancel)
  - actualCheckIn, actualCheckOut — только через специальные эндпоинты

ШАГ 3 — Проверь:
  pnpm typecheck
  cd apps/api && pnpm test
  cd apps/api && pnpm test:integration   (если запущена БД)

КРИТЕРИИ ПРИЁМКИ:
- [ ] Ни одного ...request.body в mutation-операциях (UPDATE/INSERT)
- [ ] Поля id, propertyId, createdAt недоступны для изменения клиентом
- [ ] pnpm typecheck — чисто
- [ ] Все существующие тесты проходят

ОГРАНИЧЕНИЯ:
- Не менять GET-эндпоинты — только мутации (PUT/PATCH/POST с update)
- Не добавлять Zod или другие validation-библиотеки (не в стеке)
- Сохранить все эндпоинты рабочими — не удалять функционал
```

---

## PROMPT-09 — Рефакторинг: вынести getBusinessDate в lib

```
Ты работаешь над open-source PMS (Property Management System) — TypeScript монорепозиторий.
Прежде всего прочитай AGENTS.md в корне проекта — там описаны все паттерны и соглашения.

КОНТЕКСТ (из backlog.json DEBT-001):
Функция getBusinessDate определена в 3 файлах с разной обработкой ошибок:
  - apps/api/src/routes/bookings.ts:8
  - apps/api/src/routes/dashboard.ts (похожая функция)
  - apps/api/src/routes/night-audit.ts (inline логика)
Это code smell — изменение логики только в одном месте создаёт рассинхрон.

ЗАДАЧА:
Вынести getBusinessDate в единый модуль.

ШАГ 1 — Прочитай все 3 файла и сравни реализации:
- apps/api/src/routes/bookings.ts (найди function getBusinessDate)
- apps/api/src/routes/dashboard.ts (найди похожую логику)
- apps/api/src/routes/night-audit.ts (найди inline запрос к businessDates)

ШАГ 2 — Создай файл apps/api/src/lib/business-date.ts:
  import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
  import type * as schema from "@pms/db";
  import { businessDates } from "@pms/db";
  import { eq, and } from "drizzle-orm";

  export async function getBusinessDate(
    db: PostgresJsDatabase<typeof schema>,
    propertyId: string
  ): Promise<{ id: string; date: string }> {
    const [bizDate] = await db
      .select({ id: businessDates.id, date: businessDates.date })
      .from(businessDates)
      .where(and(eq(businessDates.propertyId, propertyId), eq(businessDates.status, "open")))
      .limit(1);
    if (!bizDate) {
      throw { statusCode: 500, code: "NO_OPEN_BUSINESS_DATE",
              message: "Открытая бизнес-дата не найдена. Выполните ночной аудит." };
    }
    return bizDate;
  }

  Важно: возвращать { id, date } — оба нужны (id для FK в folio_transactions, date для сравнений)

ШАГ 3 — Заменить все использования:
  В каждом из 3 файлов:
  - Добавить: import { getBusinessDate } from "../lib/business-date";
  - Удалить локальное определение функции
  - Исправить все вызовы: функция теперь возвращает { id, date } вместо просто строки
    (проверь что везде используется .date для сравнений и .id для FK)

ШАГ 4 — Проверь:
  pnpm typecheck
  cd apps/api && pnpm test
  cd apps/api && pnpm test:integration

КРИТЕРИИ ПРИЁМКИ:
- [ ] Файл apps/api/src/lib/business-date.ts создан
- [ ] Ни одного дублирующего определения getBusinessDate в route-файлах
- [ ] Все маршруты используют импорт из ../lib/business-date
- [ ] pnpm typecheck — чисто
- [ ] Все тесты проходят

ОГРАНИЧЕНИЯ:
- Функция возвращает { id: string, date: string } — оба поля нужны для разных целей
- Не менять бизнес-логику, только структуру кода
- Не удалять inline-запросы к businessDates которые отличаются по назначению
  (например в night-audit select со status + полем closedAt — другой запрос)
```

---

## Итоговый чеклист демо-готовности

После выполнения всех промптов:

| # | Что проверить | Команда |
|---|---------------|---------|
| 1 | SQL миграция применена | `pnpm db:migrate` |
| 2 | Сид работает без ошибок | `pnpm db:seed` |
| 3 | TypeScript чист | `pnpm typecheck` |
| 4 | Unit тесты зелёные | `cd packages/domain && pnpm test` |
| 5 | Integration тесты зелёные | `cd apps/api && pnpm test:integration` |
| 6 | API стартует | `pnpm dev` → curl localhost:3001/health |
| 7 | Прилёт: Due In отображается | Открыть /bookings?view=arrivals |
| 8 | Выезд: Due Out отображается | Открыть /bookings?view=departures |
| 9 | Грязный номер: предупреждение при check-in | Проверить вручную |
| 10 | Checkout с балансом: ошибка по окнам | Проверить вручную |
| 11 | Ночной аудит: пакеты постятся | Запустить аудит, проверить фолио |
| 12 | Компании: CRUD работает | Открыть /configuration/companies |
| 13 | Турагенты: CRUD работает | Открыть /configuration/travel-agents |
| 14 | Пакеты: CRUD работает | Открыть /configuration/packages |
| 15 | Хаускипинг задания | Открыть /housekeeping |

---

## Важные ограничения (для каждого промпта)

Вставляй в начало каждого промпта если Gemini начинает игнорировать паттерны:

```
АБСОЛЮТНЫЕ ЗАПРЕТЫ:
- НЕ использовать new Date() как бизнес-дату — только из таблицы business_dates
- НЕ делать UPDATE или DELETE в folio_transactions — только INSERT
- НЕ раскомментировать authPlugin в app.ts — Auth намеренно отключён
- НЕ использовать Jest, Vitest, Mocha — только node:test + node:assert/strict
- НЕ создавать tailwind.config.js — Tailwind 4 настраивается только в CSS
- НЕ добавлять .js расширения к относительным импортам (moduleResolution: bundler)
- НЕ создавать отдельные types.ts файлы — типы в том же файле
- propertyId ОБЯЗАТЕЛЕН в каждом запросе к БД — никогда не упускать WHERE
```
