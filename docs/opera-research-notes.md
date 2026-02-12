# Исследование Oracle Opera PMS V5 — Заметки

**Дата:** 2026-02-11
**Цель:** Изучить реальную структуру данных Oracle Opera PMS V5.6, чтобы спроектировать нашу PMS на основе проверенных паттернов индустрии.

---

## 1. Настройка доступа

### MCP-сервер для Oracle

Создан Python MCP-сервер в `tools/mcp-server/`, который подключается к Oracle DB через `oracledb` (thin mode, без Oracle Instant Client).

**Стек:**
- Python 3.12, FastMCP, oracledb
- Подключение через `.env` файл (`ORACLE_DSN`, `ORACLE_USER`, `ORACLE_PASSWORD`)

**Доступные инструменты:**
- `list_schemas`, `list_tables`, `describe_table` — метаданные
- `query` — read-only SQL (SELECT)
- `query_view` — SELECT с предварительной инициализацией `pms_p.initialize` (для view типа RESERVATION_GENERAL_VIEW)
- `sample_data`, `distinct_values`, `row_count` — быстрый анализ данных
- `opera_overview`, `opera_mapping` — высокоуровневые сводки

**Конфигурация:** `.mcp.json` в корне проекта, Claude Code подключается автоматически.

---

## 2. Структура БД Opera

### Схемы

| Схема | Описание |
|---|---|
| OPERA1 | Основная рабочая БД с реальными данными |
| OPERA2 | Копия (те же таблицы, аналогичные данные) |
| OPERA | Пустая схема |

### Ключевые таблицы (OPERA1)

| Таблица | Записей | Наш аналог | Описание |
|---|---|---|---|
| RESORT | 3 | properties | Отели. PK = `RESORT` (VARCHAR код: CRO, HA336, ORS) |
| ROOM_CATEGORY_TEMPLATE | 15 | room_types | Категории номеров (шаблон на уровне сети) |
| ROOM_CLASSES_TEMPLATE | 3 | — | Классы номеров (PSE=псевдо, ROOM, ALL) |
| ROOM | 307 | rooms | Физические номера (167 реальных + псевдо) |
| NAME | 61,328 | guests | Профили гостей, компаний, агентов |
| NAME_ADDRESS | 109,078 | — | Адреса (несколько на профиль) |
| NAME_PHONE | 61,836 | — | Телефоны (несколько на профиль) |
| RESERVATION_NAME | 135,492 | bookings | Бронирования |
| RESERVATION_DAILY_ELEMENTS | 335,002 | booking_nights | Поночная разбивка бронирования |
| RATE_HEADER | 498 | rate_plans | Тарифные планы |
| RATE_CATEGORY_TEMPLATE | 27 | — | Шаблоны тарифных категорий |
| FINANCIAL_TRANSACTIONS | 1,646,019 | — (post-MVP) | Финансовые транзакции |

---

## 3. Детальный анализ таблиц

### RESORT (→ properties)

Реальный отель в системе: **HA336** — Mercure Kaliningrad Centre

Ключевые поля:
| Поле Opera | Тип | Пример | Наш аналог |
|---|---|---|---|
| RESORT | VARCHAR(20) | HA336 | code |
| NAME | VARCHAR(80) | Mercure Kaliningrad Centre | name |
| STREET | VARCHAR(2000) | Proyezd Ozernyy, 2 | address |
| CITY | VARCHAR(40) | Kaliningrad | city |
| COUNTRY_CODE | VARCHAR(3) | RU | country |
| CURRENCY_CODE | VARCHAR(20) | RUB | currency |
| CHECK_IN_TIME | DATE | 14:00 | checkInTime |
| CHECK_OUT_TIME | DATE | 12:00 | checkOutTime |
| NUMBER_ROOMS | NUMBER | — | numberOfRooms |
| NUMBER_FLOORS | NUMBER | — | numberOfFloors |
| TIMEZONE_REGION | VARCHAR(80) | Etc/GMT+2 | timezone |
| LATITUDE / LONGITUDE | NUMBER | есть | — (post-MVP) |
| CHAIN_CODE | VARCHAR(20) | CHA | — (post-MVP) |

Другие resorts: CRO (central reservations office), ORS (ORS/OIS демо).

### ROOM_CATEGORY_TEMPLATE (→ room_types)

15 записей, из них реальные категории для HA336:

| ROOM_CATEGORY (ID) | LABEL (код) | SHORT_DESCRIPTION | ROOM_CLASS | PSEUDO_YN |
|---|---|---|---|---|
| 10060 | DBCLV | Standard double | ALL | N |
| 10061 | TWCLV | Standard TWIN | ALL | N |
| 10062 | TWCCI | Standard TWIN City View | ALL | N |
| 10063 | DBBLV | Privilege Like View | ALL | N |
| 10064 | DBBCI | Privilege City View | ALL | N |
| 10065 | SKDLS | Junior Suite Like View | ALL | N |
| 10066 | STJ | Junior Suite City View | ALL | N |
| 10067 | SKBLV | Suite | ALL | N |
| 10560 | DBCCI | Standard double city view | ALL | N |
| -1 | PM | Posting Master | ALL | Y |
| -2 | PZ | Apartments | PSE | Y |
| -3 | PF | Permanent Folios | PSE | Y |
| -4 | PI | Banquet Rooms | PSE | Y |
| -120 | CATERING | Catering Room Type | ALL | Y |

Ключевые поля помимо показанных: `MAX_OCCUPANCY`, `MAX_OCCUPANCY_ADULTS`, `MAX_OCCUPANCY_CHILDREN`, `MIN_OCCUPANCY`, `DEF_OCCUPANCY`, `ORDER_BY`, `SUITE_YN`, `RATE_AMOUNT`.

### ROOM_CLASSES_TEMPLATE

Иерархия классов:
| ROOM_CLASS | DESCRIPTION | SELL_SEQUENCE |
|---|---|---|
| PSE | Pseudo Rooms | 99 |
| ROOM | Default Room Class | 1 |
| ALL | Default Room Class | 1 |

### ROOM (→ rooms)

307 записей, из них 167 реальных (PSEUDO_YN = 'N').

**Распределение по типам (HA336, реальные):**
| Тип | Кол-во |
|---|---|
| DBCLV (Standard double) | 57 |
| DBCCI (Standard double city view) | 50 |
| DBBLV (Privilege Like View) | 22 |
| TWCCI (Standard TWIN City View) | 21 |
| TWCLV (Standard TWIN) | 8 |
| SKBLV (Suite) | 4 |

**Нумерация:** 203-216, 301-319, 401-419, 501-519, 601-616, 701-704. Этаж определяется первой цифрой номера (поле FLOOR не заполнено).

Ключевые поля:
| Поле Opera | Тип | Наш аналог |
|---|---|---|
| RESORT | VARCHAR(20) | propertyId (FK) |
| ROOM | VARCHAR(20) | roomNumber |
| ROOM_CATEGORY | VARCHAR(20) | roomTypeId (FK) |
| ROOM_STATUS | VARCHAR(20) | housekeepingStatus |
| HK_STATUS | VARCHAR(20) | occupancyStatus |
| FO_STATUS | VARCHAR(20) | occupancyStatus |
| FLOOR | VARCHAR(20) | floor |
| BUILDING | VARCHAR(20) | — |
| MAX_OCCUPANCY | NUMBER | — (наследуется от room type) |
| NO_OF_BEDS | NUMBER | — |
| PSEUDO_YN | VARCHAR(1) | — |

---

## 4. Критическое открытие: 2D модель статусов комнат

### Opera использует две независимые оси статуса:

**Ось 1: Состояние уборки (ROOM_STATUS)**
| Код | Значение | Кол-во в HA336 |
|---|---|---|
| CL | Clean (чисто) | 146 |
| DI | Dirty (грязно) | 134 |
| IP | In Progress (убирается) | 24 |
| OO | Out of Order (неисправен) | 2 |
| OS | Out of Service (выведен) | 1 |

**Ось 2: Занятость (FO_STATUS / HK_STATUS)**
| Код | Значение | Кол-во в HA336 |
|---|---|---|
| VAC | Vacant (свободен) | 157 |
| OCC | Occupied (занят) | 150 |

**Ключевой вывод:** Комната может быть одновременно DI (dirty) + OCC (occupied) — гость ещё живёт, но уборка не делалась. Или CL (clean) + VAC (vacant) — номер готов к заселению. Это две независимые характеристики.

**Наша исходная ошибка:** В Phase 0 мы использовали одномерный статус `clean | dirty | inspected | out_of_order | occupied`, где `occupied` смешан с состоянием уборки. Это архитектурно неверно.

**Решение:** Разделили на два поля:
- `housekeepingStatus`: clean, dirty, pickup, inspected, out_of_order, out_of_service
- `occupancyStatus`: vacant, occupied

---

## 5. Анализ NAME (→ guests, для Phase 2)

**NAME_TYPE — типы профилей:**
| Тип | Описание |
|---|---|
| D | Reservation guest (гость привязан к бронированию) |
| G | Guest profile (независимый профиль гостя) |
| COMPANY | Компания |
| TRAVEL_AGENT | Турагент |
| E, S, H | Другие типы |

Для миграции нам нужны типы G и D.

---

## 6. Анализ бронирований (для Phase 3)

### Источники данных

Два ключевых источника:
- **RESERVATION_NAME** — базовая таблица, 135,492 записи. Прямой SELECT без инициализации.
- **RESERVATION_GENERAL_VIEW** — денормализованный view (200+ колонок), включает имя гостя, название комнатной категории, суммы. Требует `pms_p.initialize('NA_REPORTS','NA_REPORTS','HA336')` перед запросом. В MCP-сервере тул `query_view`.

### Статусы бронирований (RESV_STATUS)

| Статус Opera | Кол-во | Наш аналог |
|---|---|---|
| CHECKED OUT | 109,629 | checked_out |
| CANCELLED | 15,256 | cancelled |
| RESERVED | 1,542 | confirmed |
| NO SHOW | 327 | no_show |
| CHECKED IN | 221 | checked_in |

> PROSPECT (2,618 в RESERVATION_NAME) — виден только через таблицу, не через view.

### Диапазон данных

- Даты заездов: 2018-06-06 — 2022-09-21
- Средняя длительность: 2.6 ночей
- Средний тариф: 4,761 RUB
- Walk-in: всего 8 из 89,709 (реальных)
- Валюта: RUB

### Способы оплаты (PAYMENT_METHOD)

| Код | Описание | Кол-во |
|---|---|---|
| CA | Cash/Наличные | 86,372 |
| MC | Mastercard | 14,133 |
| VA | Visa | 10,432 |
| AX | American Express | 248 |
| MI | Mir | 107 |

### Гарантии (GUARANTEE_CODE)

| Код | Кол-во |
|---|---|
| CHECKED IN | 109,850 (default) |
| GCO | 983 |
| NON | 291 |
| GCC | 133 |
| GRD | 98 |
| DEP | 37 |

### Сегменты рынка (MARKET_CODE) — top 10

| Код | Кол-во | Вероятное значение |
|---|---|---|
| TE | 22,457 | Travel (ecommerce/OTA) |
| TA | 22,378 | Travel Agent |
| TZ | 16,292 | — |
| CS | 7,846 | Corporate segment |
| CR | 5,703 | Corporate rate |
| TG | 4,995 | — |
| TF | 4,728 | — |
| CJ | 4,048 | — |
| CK | 3,351 | — |
| TD | 2,829 | — |

### Тарифные коды (RATE_CODE) — top 10

| Код | Кол-во |
|---|---|
| PM | 16,154 (posting master) |
| RA1 | 11,130 |
| FLRA1 | 9,905 |
| RB1 | 8,957 |
| FLRB1 | 6,452 |
| T03 | 3,155 |
| MODIF | 2,347 |
| FLRAFB | 2,093 |
| FLRA3 | 2,066 |
| GR41 | 1,813 |

### Ключевые поля RESERVATION_GENERAL_VIEW для нашей модели

| Поле view | Описание | Наш аналог |
|---|---|---|
| RESV_NAME_ID | PK бронирования | id |
| GUEST_NAME_ID | FK на NAME | guestId |
| CONFIRMATION_NO | Номер подтверждения | confirmationNumber |
| TRUNC_ARRIVAL | Дата заезда | checkInDate |
| TRUNC_DEPARTURE | Дата выезда | checkOutDate |
| NIGHTS | Кол-во ночей | (вычисляемое) |
| ADULTS | Взрослых | adults |
| CHILDREN | Детей | children |
| ROOM | Номер комнаты | roomId (FK) |
| ROOM_CATEGORY_LABEL | Код категории (DBCLV...) | roomTypeId (FK) |
| RESV_STATUS | Статус | status |
| RATE_CODE | Тарифный код | ratePlanId (FK) |
| BASE_RATE_AMOUNT | Базовая цена за ночь | rateAmount |
| TOTAL_REVENUE | Общий доход | totalAmount |
| PAYMENT_METHOD | Способ оплаты | paymentMethod |
| MARKET_CODE | Сегмент рынка | — (post-MVP) |
| WALKIN_YN | Walk-in? | — (post-MVP) |
| COMPANY_NAME | Название компании | — (post-MVP) |
| ACTUAL_CHECK_IN_DATE | Фактический check-in | actualCheckIn |
| ACTUAL_CHECK_OUT_DATE | Фактический check-out | actualCheckOut |
| CURRENCY_CODE | Валюта | — (на уровне property) |
| VIP | VIP-статус гостя | — (на уровне guest) |

### Пример реального бронирования (2022-09-20)

```
RESV_NAME_ID: 440921
GUEST_NAME: LN54205 (анонимизировано)
CONFIRMATION_NO: 428426
ARRIVAL: 2022-09-20
DEPARTURE: 2022-09-21
NIGHTS: 1, ADULTS: 1, CHILDREN: 0
ROOM: 430, ROOM_CATEGORY: DBBLV (Privilege)
RATE_CODE: RB1, BASE_RATE: 12,400 RUB
TOTAL_REVENUE: 11,200 RUB
PAYMENT: CA (cash), MARKET: TA
ACTUAL CHECK-IN: 2022-09-20 00:00
ACTUAL CHECK-OUT: 2022-09-21 12:43
```

---

## 7. Маппинг для миграции данных

| Данные | Таблица Opera | Записей | Фаза миграции |
|---|---|---|---|
| Отель | RESORT (HA336) | 1 | Phase 1 (seed) |
| Типы номеров | ROOM_CATEGORY_TEMPLATE | 9 реальных | Phase 1 (seed) |
| Номера | ROOM (PSEUDO_YN='N') | 167 | Phase 1 (seed → потом реальная миграция) |
| Гости | NAME (TYPE in G,D) | ~61K | Phase 2 |
| Бронирования | RESERVATION_NAME | ~135K | Phase 3 |
| Поночная разбивка | RESERVATION_DAILY_ELEMENTS | ~335K | Phase 3 |
| Финансы | FINANCIAL_TRANSACTIONS | ~1.6M | Post-MVP |

---

## 8. Выводы и решения

### Что мы взяли из анализа Opera:

1. **2D статус-модель** — обязательное исправление нашей схемы
2. **checkInTime/checkOutTime** на property — критично для фронт-деска
3. **Реалистичная структура комнат** — 6 реальных категорий, этажность, нумерация
4. **Статусы бронирований** — наши совпадают 1:1 (кроме PROSPECT)
5. **Типы профилей NAME** — понимание что мигрировать в Phase 2

### Что мы сознательно НЕ копируем:

- Коды категорий Opera (DBCLV, SKBLV...) — используем свои (STD, SUP, PRM...)
- Структуру таблиц Oracle — у нас PostgreSQL + Drizzle ORM
- Иерархию Room Class → Room Category — избыточна для MVP
- Псевдо-комнаты (PM, PZ, PF) — не нужны в MVP
- Разделение NAME_ADDRESS / NAME_PHONE в отдельные таблицы — у нас плоская структура guests

### Инструменты:

MCP-сервер остаётся в `tools/mcp-server/` для будущих миграций. Он подключается к Oracle и предоставляет read-only доступ через Claude Code.
