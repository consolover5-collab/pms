# UI Audit Plan — PMS

**Создан:** 2026-04-21
**Цель:** провести полный UI-аудит каждой секции PMS в headless Playwright, собрать структурированный отчёт (YAML + скриншоты), на основе которого будет переписан Help.

Этот документ — инструкция для новой сессии. Отчёт пишется НЕ в MD, а в `docs/ui-audit/` (YAML-файлы + PNG-скриншоты).

---

## 0. Пре-чеклист (один раз перед началом)

1. Поднять стек:
   ```bash
   curl -s http://localhost:3001/health  # API должен отвечать {"status":"ok"}
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/  # Web → 200
   ```
   Если не работает — см. `memory/deploy_procedure.md`.

2. Установить Playwright в apps/web (если не стоит):
   ```bash
   cd /home/oci/pms/apps/web
   pnpm add -D @playwright/test
   pnpm exec playwright install chromium
   ```
   Альтернатива: создать отдельный пакет `tools/ui-audit/` с собственным `package.json`, чтобы не мешать основному web. Выбрать по ситуации.

3. Узнать параметры тестовой property:
   ```bash
   curl -s http://localhost:3001/api/properties | jq '.[0] | {id, name, code}'
   ```
   Текущая: Grand Baltic Hotel (GBH), id `ff1d9135-dfb9-4baa-be46-0e739cd26dad`.

4. Узнать текущую business date (всё дальнейшее привязано к ней):
   ```bash
   curl -s "http://localhost:3001/api/business-dates?propertyId=<id>&status=open" | jq
   ```

5. Зафиксировать seed-данные, с которыми работаем: перечислить 2–3 брони в разных статусах, 2–3 комнаты с разными HK, 1 VIP-профиль. Если данных нет — создать через API curl **до** начала UI-аудита, чтобы было что тестировать.

6. Перед первым тестом сделать snapshot БД (`pg_dump`) чтобы можно было откатиться, если тесты наследят.

---

## 1. Технический стек

- **Playwright** headless Chromium
- Браузерный контекст: одна persistent page на секцию (cookie-аутентификация сохраняется)
- **Сбор артефактов:**
  - `page.on('console', ...)` — ошибки и warning в лог секции
  - `page.on('pageerror', ...)` — JS-исключения
  - `page.on('response', ...)` — все 4xx/5xx ответы API
  - скриншоты ключевых экранов (`fullPage: true`)
- **Локаль:** каждый флоу прогнать в `locale=ru` **и** `locale=en` (для мэппинга лейблов)
- **Тема:** по умолчанию light; проверять dark отдельно только где это меняет UI существенно

---

## 2. Артефакты — куда писать

```
docs/ui-audit/
  README.md           # короткое резюме: когда, что, ссылки
  index.yml           # карта фич → статус
  bugs.yml            # плоский список найденных багов (id, severity, feature, repro, evidence)
  features/
    01-dashboard.yml
    02-bookings-list.yml
    03-booking-create.yml
    04-booking-detail.yml
    05-booking-edit.yml
    06-checkin-checkout.yml
    07-rooms-list.yml
    08-room-detail.yml
    09-housekeeping.yml
    10-folio.yml
    11-profiles.yml
    12-night-audit.yml
    13-cashier.yml
    14-tape-chart.yml
    15-configuration-property.yml
    16-configuration-room-types.yml
    17-configuration-rate-plans.yml
    18-configuration-transaction-codes.yml
    19-configuration-packages.yml
    20-configuration-guarantee-codes.yml
    21-configuration-profiles.yml
    22-help.yml
    23-login.yml
    24-i18n-theme.yml
  screenshots/
    <section-slug>-<step>-<short-desc>.png
  scripts/
    shared.ts           # общий setup, helpers
    01-dashboard.spec.ts
    02-bookings-list.spec.ts
    ...
```

---

## 3. Схема `features/<n>-<slug>.yml`

```yaml
id: booking.create
title: "Создание бронирования"
route: /bookings/new
depends_on: [profile.exists, room-type.exists, rate-plan.exists]
locales_tested: [ru, en]

ui:
  header:
    ru: "Новая бронь"
    en: "New Booking"
  required_fields:
    - { key: guestProfileId, label_ru: "Гость", label_en: "Guest" }
    - { key: roomTypeId,     label_ru: "Тип номера", label_en: "Room type" }
    - { key: checkInDate,    label_ru: "Дата заезда", label_en: "Check-in date" }
    - { key: checkOutDate,   label_ru: "Дата выезда", label_en: "Check-out date" }
    - { key: adults,         label_ru: "Взрослые", label_en: "Adults" }
  optional_fields: [ratePlanId, rateAmount, roomId, guaranteeCode, paymentMethod, notes, children]
  buttons:
    submit:  { ru: "Создать бронь", en: "Create Booking" }
    cancel:  { ru: "Отмена",        en: "Cancel" }
    newGuest:{ ru: "Новый гость",   en: "New Guest" }

steps:
  - n: 1
    action: "открыть /bookings/new в locale=ru"
    expected: "форма отображена, hint про required виден"
    screenshot: 03-booking-create-01-empty-form-ru.png
    actual: ok
  - n: 2
    action: "попытаться submit с пустыми полями"
    expected: "inline validation — 4 required поля подсвечены"
    screenshot: 03-booking-create-02-validation-ru.png
    actual: ok
  - n: 3
    action: "выбрать гостя, daty, room type, submit"
    expected: "редирект на /bookings/<id>, статус confirmed"
    screenshot: 03-booking-create-03-success.png
    actual: ok

edge_cases:
  - name: "checkOut <= checkIn"
    steps: "выбрать даты задом наперёд, submit"
    expected: "ошибка с текстом про даты"
    actual: "подсвечено, но текст по-английски в ru-локали"
    bug: BUG-042
  - name: "занятая комната"
    steps: "выбрать roomId, который уже забронирован на те же даты"
    expected: "ошибка ROOM_UNAVAILABLE / сообщение в UI"
    actual: ...

api_calls_observed:
  - { method: POST, path: /api/bookings, status: 201 }
  - { method: GET,  path: /api/profiles?..., status: 200 }

console_errors: []
network_errors: []

bugs: [BUG-042]
help_rewrite_hints: |
  Сейчас в help (help.topic.bookings) пишется:
    > "Нажмите + New Booking"
  Реальная кнопка: "+ Новая бронь" (ru) / "+ New Booking" (en).
  Добавить:
    - обязательные поля: 4 штуки (список выше)
    - поведение ratePlanId → подставляет rate из rate matrix
    - edge case про даты и про занятую комнату

status: ok  # ok | partial | broken | missing
last_audited: 2026-04-21
screenshots_dir: docs/ui-audit/screenshots/
```

Поля важные для переписывания help:
- `ui.buttons.*` и `ui.required_fields.*` — чтобы help говорил реальными лейблами
- `edge_cases[].expected/actual` — чтобы help описывал ограничения
- `help_rewrite_hints` — явные подсказки "что править в help-топике"

---

## 4. Схема `bugs.yml`

```yaml
- id: BUG-042
  severity: medium        # critical | high | medium | low
  feature: booking.create
  route: /bookings/new
  repro: |
    1. Переключить локаль на ru
    2. В форме создания брони поставить checkOutDate < checkInDate
    3. Нажать Submit
  expected: "ошибка на русском"
  actual: "ошибка 'End date must be after start' — английский в ru-локали"
  evidence:
    - screenshots/03-booking-create-02-validation-ru.png
    - console_log_line: 123
  suggested_fix: "добавить errors.dateRange в ru.ts или использовать общий ключ"
  discovered: 2026-04-21
  status: open
```

---

## 5. Схема `index.yml`

```yaml
generated: 2026-04-21
app_commit: <sha>
sections:
  - { id: 01, file: features/01-dashboard.yml,        status: ok,      bugs: 0 }
  - { id: 02, file: features/02-bookings-list.yml,    status: partial, bugs: 2 }
  - { id: 03, file: features/03-booking-create.yml,   status: ok,      bugs: 1 }
  - ...
totals:
  sections: 24
  ok: 18
  partial: 4
  broken: 1
  missing: 1
  bugs: 12
```

---

## 6. Секции по порядку

Нумерация = порядок выполнения. Каждая — отдельный коммит в конце (`feat(audit): section 03 booking-create`).

### 01. Dashboard (`/`)
- KPI-карточки (occupied, vacant, dirty, clean, inspected) — значения соответствуют БД
- Список Arrivals Today / Departures Today / In-House
- Click-through: карточка dirty → /rooms?hk=dirty, arrivals → /bookings
- Business date отображается в topbar
- **Edge case:** что показывает dashboard, если нет открытого business date

### 02. Bookings list (`/bookings`)
- Вкладки: All, Arrivals, Departures, In-House (счётчики, фильтрация)
- Фильтры статуса
- Поиск по guest name / confirmation number
- Сортировка
- Пагинация (если есть)
- Click на строку → /bookings/[id]

### 03. Booking create (`/bookings/new`)
- Inline создание нового гостя
- Rate matrix: смена ratePlan+roomType → rateAmount подставляется
- Валидации: даты, обязательные поля
- Notes
- Submit → редирект на detail

### 04. Booking detail (`/bookings/[id]`)
- Вкладки: Summary, Folio, History (если есть)
- BookingActions: check-in, cancel, reinstate, check-out
- Reinstate после cancel — проверить, куда девается причина отмены (⚠️ FEAT-011)
- Folio section (post charge, post payment) — см. секцию 10 подробнее

### 05. Booking edit (`/bookings/[id]/edit`)
- Какие поля можно менять
- Нельзя менять после check-in
- Валидации

### 06. Check-in / Check-out flow
- Check-in: через /bookings/[id] → action
- Проверка dirty room → диалог подтверждения (force=true)
- OOO/OOS → жёсткий блок
- Check-out: баланс по окнам, предупреждение если баланс != 0
- No-show: через night audit

### 07. Rooms list (`/rooms`)
- Фильтры: HK status, occupancy, floor, room type
- Матрица / таблица — какая
- Click на комнату → /rooms/[id]
- Поиск по room number

### 08. Room detail (`/rooms/[id]`)
- Смена HK status (dirty → clean → inspected)
- Перевод в OOO / OOS с датами и причиной
- Текущее бронирование, если занята
- History блок

### 09. Housekeeping (`/housekeeping`)
- Генерация задач на день
- Kanban / list
- Смена статуса задачи (assign, start, complete)
- Фильтр по assignee, статусу
- Проверить, что после completed у комнаты обновляется HK-статус

### 10. Folio
- Где: `/bookings/[id]` → FolioSection
- Окна фолио (все видны стеком, не табами)
- Post charge в конкретное окно
- Post payment в конкретное окно
- Transaction codes (выбор из config)
- Баланс по окну, общий баланс
- **Edge case:** окно без транзакций, окно с + балансом, окно с 0 балансом

### 11. Profiles (`/guests` + unified)
- Список гостей
- Фильтр по typeам (guest/company/travel-agent) — unified
- Создание гостя: базовые поля + VIP + паспорт
- Детальная страница: история броней, preferences
- Редактирование
- Удаление / soft-delete

### 12. Night Audit (`/night-audit`)
- Пре-чеклист: что должно быть сделано до запуска
- Post room charges (авто)
- Post package components
- No-show processing
- Daily details
- Закрытие бизнес-даты → открытие следующей
- **Edge case:** что блокирует audit (неоплаченные check-out, неназначенные arrivals?)

### 13. Cashier (`/cashier`)
- Что это за страница, что показывает
- Операции

### 14. Tape chart (`/tape-chart`)
- Отображение брони на timeline по комнатам
- Переключение периода
- Click на бар → detail
- Drag (если есть) — перемещение брони между комнатами

### 15. Configuration: Property (`/configuration/property`)
- Поля: name, code, address, timezone, currency, check-in/out times, rooms/floors count, tax rate
- Валидация: numberOfRooms нельзя уменьшить ниже фактического

### 16. Configuration: Room Types
- List, create, edit, detail
- Associated rooms (CRUD для rooms?)
- Нельзя удалить type с комнатами/бронями

### 17. Configuration: Rate Plans
- List, create, edit
- **Base Rate** флаг — один может быть active
- Rate matrix: цены по room types
- Packages attached (FEAT-006)
- Нельзя удалить план с бронями

### 18. Configuration: Transaction Codes
- List, create, edit
- Type: charge / payment
- Manual post allowed флаг
- Нельзя удалить с транзакциями

### 19. Configuration: Packages
- List, create, edit
- Attach to rate plans
- Components

### 20. Configuration: Guarantee Codes
- List, CRUD

### 21. Configuration: Profiles (`/configuration/profiles`)
- Если отличается от /guests

### 22. Help (`/help` + 9 topics)
- Hub отображается
- Click по каждой карточке → topic открывается
- Контент рендерится (не пусто) — после фикса 2026-04-21
- Статусы и цветовая легенда на хабе

### 23. Login (`/login`)
- Работает ли вообще
- Auth отключён (см. BUG-001) — на что это влияет

### 24. i18n + theme
- Переключатель локали — где, работает ли
- Переключатель темы (если есть)
- Перевод на всех страницах присутствует (нет хардкода)

---

## 7. Протокол для каждой секции

1. **Прочитать исходник страницы** (`apps/web/src/app/<route>/page.tsx` + сопутствующие файлы)
2. **Составить список сценариев** (happy path + 2–3 edge cases)
3. **Написать Playwright spec** (`docs/ui-audit/scripts/<n>-<slug>.spec.ts`)
4. **Запустить headless, собрать:**
   - скриншоты → `screenshots/`
   - console/network errors → переменная в spec → YAML
5. **Заполнить `features/<n>-<slug>.yml`** по схеме выше
6. **Найденные баги** → новая запись в `bugs.yml` **и** запись в `docs/backlog.json` (по формату BUG-xxx)
7. **Обновить `index.yml`**: проставить статус секции, количество багов
8. **Коммит:** `feat(audit): section <n> <slug>`

---

## 8. Критерии статусов

- **ok** — все сценарии прошли, ни одной ошибки в консоли/сети
- **partial** — happy path работает, но есть баги в edge cases или проблемы с локализацией
- **broken** — happy path не работает (500, JS error, UI не отображается)
- **missing** — страница/функция, указанная в help, не существует в коде

---

## 9. Что писать в `help_rewrite_hints`

Сейчас help-контент в `apps/web/src/app/help/[topic]/help-content.tsx` — 9 топиков: quick-start, dashboard, bookings, check-in-out, rooms, guests, folio, night-audit, configuration.

Для **каждого** help-топика в соответствующей секции аудита дать 3 блока:
- **что в help сейчас написано** (цитата)
- **что по факту** (из наблюдения)
- **что переписать** (конкретный текст или структура)

Пример:
```yaml
help_rewrite_hints:
  topic: bookings
  current: "Нажмите + New Booking"
  actual: "Кнопка на /bookings в правом верхнем углу, лейбл '+ Новая бронь' (ru) / '+ New Booking' (en)"
  rewrite: |
    В разделе "Создание" заменить на:
    1. На странице Bookings нажмите **+ Новая бронь** (в правом верхнем углу).
    2. Откроется форма /bookings/new с обязательными полями: Гость, Тип номера, Дата заезда, Дата выезда, Взрослые.
    ...
```

---

## 10. Приоритеты

Если времени на всё не хватает — такой порядок важности для переписывания help:

**Критично (P0):** 01, 02, 03, 04, 06, 09, 10, 12, 17
**Важно (P1):** 05, 07, 08, 11, 15, 16, 18, 19, 22
**Желательно (P2):** 13, 14, 20, 21, 23, 24

---

## 11. Итоговый артефакт

После прохождения всех секций — сгенерировать `docs/ui-audit/README.md`:
- краткое резюме: когда, сколько секций, сколько багов
- ссылки на `index.yml`, `bugs.yml`
- топ-5 багов
- рекомендации "с чего начать переписывать help"
