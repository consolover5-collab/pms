# PMS Retrospective Analysis vs Oracle Opera PMS V5

> **Версия 2.0 — 2026-02-19.** Дополнена результатами второго прохода верификации:
> двойная проверка против Opera DB (hotel HA336) + Oracle Help Center (docs.oracle.com).

## Верификация (2-й проход, 2026-02-19)

### Ключевые находки из Oracle DB (HA336)

| Вопрос | Данные | Вывод |
|--------|--------|-------|
| OOO/OOS + HK_STATUS | OO=VAC(2), OS=VAC(1) — никогда OCC | Подтверждено: OOO комнаты всегда вакантны |
| GUARANTEE_CODE | "CHECKED IN"=112K (аномалия), GCC=8.7K, NON=5.3K, INQ=2.4K, GCO=2.4K | "CHECKED IN" — артефакт данных, не реальный код |
| CHANNEL | Только P (Phone=66K) и B (Booking=49K) — 1 символ | Opera использует короткие коды |
| VIP_STATUS | Числовые коды 1-5 (не строки) | 1228 гостей с VIP (~2% от 61K) |

### Ключевые находки из Oracle Help Center

| Функция | Цитата | Следствие |
|---------|--------|-----------|
| OOO установка | "It is not possible to take an occupied or reserved room to a status of Out of Order" | B-05 ✅ подтверждён |
| OOO даты | "From Date and Through Date are required. Cannot exceed 5 years." | ОБЯЗАТЕЛЬНЫ — план обновлён |
| Night Audit | "All Due Outs should be addressed either by checking out or extending departure dates" | B-01: блокировка overdue правильна |
| No-Show + Guarantee | "No Show Posting Rules provides ability to post revenue against a no-show" | Posting rules по гарантии — вне MVP scope |

## Методология

Проведен глубокий ретроспективный аудит open-source PMS проекта на соответствие логике Oracle Opera PMS V5 (HA336 - Mercure Kaliningrad, 167 комнат). Методология:

1. **Чтение нашего кода**: схема БД (`/packages/db/src/schema/`), API routes (`/apps/api/src/routes/`), бизнес-логика (`/packages/domain/src/`)
2. **Запросы к Opera DB**: через MCP tools — таблицы RESERVATION_NAME, ROOM, FINANCIAL_TRANSACTIONS, NAME, RATE_HEADER, ROOM_CATEGORY_TEMPLATE, RESERVATION_DAILY_ELEMENTS
3. **Сравнение**: поля, статусы, переходы, валидации, бизнес-логика
4. **Severity классификация**: CRITICAL (блокирует функцию), IMPORTANT (серьёзное расхождение), MINOR (улучшение)

## Модуль 1: Бронирования (Bookings)

### Opera: как устроено

**Таблица RESERVATION_NAME (135K+ записей):**
- Основные статусы: `CHECKED OUT`, `CANCELLED`, `RESERVED` (в нас это `confirmed`), `PROSPECT`, `NO SHOW`, `CHECKED IN`
- Ключевые поля: RESV_NO (ID), CONFIRMATION_NO (по отелю уникален), BEGIN_DATE/END_DATE, ACTUAL_CHECK_IN_DATE, ACTUAL_CHECK_OUT_DATE
- Гарантии: GUARANTEE_CODE, POSTING_ALLOWED_YN (может ли гость постить на фолио)
- Отмены: CANCELLATION_NO, CANCELLATION_REASON_CODE, CANCELLATION_DATE
- Гости связаны через NAME_ID + NAME_USAGE_TYPE (обычно "DG" = direct guest)
- Комнаты: ROOM в RESERVATION_DAILY_ELEMENTS (посуточно), не в RESERVATION_NAME
- UDF (User Defined Fields): 40 текстовых (UDFC01-40) + 40 числовых (UDFN01-40) + 20 дат (UDFD01-20)

**Таблица RESERVATION_DAILY_ELEMENTS (335K записей):**
- Посуточная запись для каждой брони на каждый день пребывания
- BOOKED_ROOM_CATEGORY + ROOM (фактическая комната если заселена)
- ADULTS, CHILDREN, QUANTITY (комнат), CRIBS, EXTRA_BEDS
- RATE_AMOUNT (за день), BASE_RATE_AMOUNT, QUANTITY (гостей/комнат)
- GUARANTEE_CODE, MARKET_CODE, ALLOTMENT_ID
- Отмены на уровне дня (CANCELLATION_NO, CANCELLATION_DATE, CANCELLATION_CODE)

**Статусы броней в реальности:**
- `CHECKED OUT` (111.9K) - checked out
- `CANCELLED` (16.2K) - cancelled
- `RESERVED` (4.1K) - confirmed (наше название)
- `PROSPECT` (2.6K) - prospect/tentative
- `NO SHOW` (340) - no show
- `CHECKED IN` (226) - checked in

### У нас: как реализовано

**Таблица bookings:**
- Статусы: `confirmed`, `checked_in`, `checked_out`, `cancelled`, `no_show` (5 статусов, у Opera 6)
- Поля: confirmationNumber (уникален), checkInDate/checkOutDate, actualCheckIn/actualCheckOut (timestamps)
- roomId (FK, nullable) + roomTypeId (FK, обязателен)
- ratePlanId (FK, nullable) + rateAmount/totalAmount (decimal)
- adults/children + paymentMethod
- confirmationNumber форма: `{PROP_CODE}-{NNNNNN}` (e.g., GBH-000001)

**Таблица RESERVATION_DAILY_ELEMENTS у нас: НЕ РЕАЛИЗОВАНА**
- Посуточные элементы НЕ отслеживаются отдельно
- Нет CRIBS, EXTRA_BEDS
- Нет GUARANTEE_CODE в bookings
- Нет поддержки отмены на уровне дня

**Состояние машины (state-machine.ts):**
```
confirmed  → [checked_in, cancelled, no_show]
checked_in → [checked_out, confirmed]         (confirmed = cancel-check-in)
checked_out→ [checked_in]                     (via reinstate)
cancelled  → [confirmed]                      (via reinstate)
no_show    → [confirmed]                      (via reinstate)
```

Opera позволяет более сложные переходы, у нас намеренно упрощено для MVP.

### Расхождения

| Severity | Проблема | Opera | У нас |
|----------|----------|-------|-------|
| IMPORTANT | Посуточные элементы | RESERVATION_DAILY_ELEMENTS с крибами, экстра кроватями, посуточными отменами | Не реализовано — только одна запись на бронь. Нет поддержки цен за день |
| IMPORTANT | Статус PROSPECT | 2,618 броней в статусе PROSPECT (tentative) | Нет статуса — только confirmed/checked_in/etc. Нельзя создать tentative |
| IMPORTANT | Гарантия (GUARANTEE_CODE) | Есть поле для кода гарантии + POSTING_ALLOWED_YN | Нет поля guarantee_code в schema |
| IMPORTANT | UDF (User Defined Fields) | 40 текстовых + 40 числовых + 20 дат полей | Нет поддержки — только notes. Потеря данных при миграции |
| MINOR | Отмена на уровне дня | CANCELLATION_NO/DATE/REASON_CODE в RESERVATION_DAILY_ELEMENTS | Нет — только отмена всей брони |
| MINOR | Комнаты в брони | Комнаты связаны через RESERVATION_DAILY_ELEMENTS, не RESERVATION_NAME | У нас roomId в bookings — допускает одну комнату на всю бронь |
| MINOR | Количество комнат | QUANTITY в RESERVATION_DAILY_ELEMENTS | numberOfRooms есть, но не используется правильно |

---

## Модуль 2: Комнаты и Housekeeping (Rooms)

### Opera: как устроено

**Таблица ROOM (307 комнат в HA336):**
- Первичный ключ: RESORT + ROOM
- ROOM_CATEGORY (тип категории, не комната)
- ROOM_STATUS (5 значений):
  - `CL` = Clean (125 комнат)
  - `DI` = Dirty (134 комнаты) 
  - `IP` = In Progress (24 комнаты)
  - `OO` = Out of Order (2 комнаты)
  - `OS` = Out of Service (1 комната)
- HK_STATUS (2 значения):
  - `VAC` = Vacant (157 комнат)
  - `OCC` = Occupied (150 комнат)
- Связь: ROOM_STATUS + HK_STATUS = двумерный статус (e.g., CL+VAC, DI+OCC)
- HK поля: HK_INSP_FLAG (inspected Y/N), HK_INSP_DATE, HK_INSP_EMP_ID, HK_SECTION_CODE
- Комнаты: RM_STATUS_REASON (ASSIGN, MAINTENANCE, etc.), RM_STATUS_REMARKS (2000 символов)
- Движение: ASSIGN_TYPE, ASSIGN_REASON, ASSIGN_UID, ASSIGN_DATE
- OCCUPANCY_CONDITION (может быть не совпадает с HK_STATUS)
- FO_STATUS (Front Desk status)
- SERVICE_STATUS (можно использовать комнату или нет)

**Комбинации статусов в реальности (HA336):**
- DI + OCC: 129 (грязная, занята - гость сейчас)
- CL + VAC: 125 (чистая, свободна)
- IP + VAC: 24 (в процессе, свободна - уборка идёт)
- CL + OCC: 21 (чистая, занята - только заселился)
- DI + VAC: 5 (грязная, свободна - нужна уборка после выезда)
- OO + VAC: 2
- OS + VAC: 1

### У нас: как реализовано

**Таблица rooms:**
- Первичный ключ: id (UUID)
- roomNumber (e.g., "101") + floor + roomTypeId
- housekeepingStatus (6 статусов): `clean`, `dirty`, `pickup`, `inspected`, `out_of_order`, `out_of_service`
- occupancyStatus (2 статуса): `vacant`, `occupied`
- 2D модель: сочетание хаускипинга + заня тости

**Состояние машины (VALID_HK_TRANSITIONS):**
```
dirty     → [pickup, clean, out_of_order, out_of_service]
pickup    → [clean, dirty, out_of_order, out_of_service]
clean     → [inspected, dirty, out_of_order, out_of_service]
inspected → [dirty, clean, out_of_order, out_of_service]
out_of_order → [dirty, clean]
out_of_service → [dirty, clean]
```

**Валидация при смене комнаты (validateRoomMove):**
- Только для checked_in
- Новая комната должна быть типом, совпадающим с типом в брони
- Новая комната должна быть `vacant` + `clean`/`inspected`

### Расхождения

| Severity | Проблема | Opera | У нас |
|----------|----------|-------|-------|
| IMPORTANT | ROOM_STATUS значения | CL, DI, IP, OO, OS | clean, dirty, pickup, out_of_order, out_of_service (5 основных, но IP встроен в pickup?) |
| IMPORTANT | Переходы статусов | Более гибкие (e.g., IP→clean напрямую) | pickup → clean (нормально), но нет явного IP в нашей модели |
| MINOR | OCCUPANCY_CONDITION | Может не совпадать с HK_STATUS (отдельное поле) | Не отслеживаем отдельно |
| MINOR | HK движение | ASSIGN_UID, ASSIGN_DATE, ASSIGN_TYPE, ASSIGN_REASON | Не логируем движение — только текущий статус |
| MINOR | HK инспекция | HK_INSP_FLAG, HK_INSP_DATE, HK_INSP_EMP_ID | Не отслеживаем инспекции |
| MINOR | HK сечение (секция) | HK_SECTION_CODE | Не учитываем деление на секции для уборки |
| MINOR | SERVICE_STATUS | Отдельный флаг "можно использовать" | Встроено в OOO/OOS |
| MINOR | FO_STATUS | Front Desk status отдельно | Не имеем |

---

## Модуль 3: Гости (Guests)

### Opera: как устроено

**Таблица NAME (61.3K профилей в HA336):**
- PRIMARY_NAME_ID (для связей: компания → контакты)
- NAME_TYPE: `G` (guest), `C` (company), `E` (employee), `A` (agent), `V` (vendor) и т.д. (REQUIRED)
- FIRST, MIDDLE, LAST + NICKNAME + TITLE + SALUTATION (60 символов)
- BIRTH_DATE, GENDER, NATIONALITY, LANGUAGE
- BUSINESS_TITLE (80 символов)
- Паспорт: PASSPORT (2000 символов), ID_TYPE, ID_NUMBER (2000), ID_DATE, ID_PLACE, ID_COUNTRY
- Контакты: PRIMARY_ADDRESS_ID, PRIMARY_PHONE_ID (FK на ADDRESS, PHONE таблицы)
- VIP_STATUS (e.g., "VIP", "SILVER", "GOLD")
- VIP_AUTHORIZATION
- REPEAT_GUEST_ID (может быть привязан к другому профилю)
- HISTORY_YN (отслеживать ли историю?)
- ACTIVE_YN (активный профиль)
- MAIL_LIST, EMAIL_YN, PHONE_YN, SMS_YN (согласия)
- UDF: 40 текстовых + 40 числовых + 20 дат
- Демография: BIRTH_PLACE, BIRTH_COUNTRY, PROFESSION
- Иммиграция: ALIEN_REGISTRATION_NO, IMMIGRATION_STATUS, VISA_VALIDITY_TYPE
- SUPER_SEARCH_INDEX_TEXT (индекс для поиска)

**Таблицы ADDRESS + PHONE (отдельные):**
- Адреса в ADDRESS_ID
- Телефоны в PHONE_ID
- Один профиль может иметь множество адресов/телефонов

### У нас: как реализовано

**Таблица guests:**
- firstName, lastName (обязательны)
- email, phone (строки, не FK)
- documentType, documentNumber (для паспорта/ID)
- nationality, gender (varchar), language
- dateOfBirth (date)
- vipStatus (integer — число, не текст)
- notes (text)
- propertyId (FK — гость привязан к конкретному отелю)

### Расхождения

| Severity | Проблема | Opera | У нас |
|----------|----------|-------|-------|
| CRITICAL | NAME_TYPE обязателен | Каждый профиль имеет тип (G/C/E/A/V) | Нет типа профиля — все гости одинаковые |
| IMPORTANT | PRIMARY_NAME_ID | Иерархия профилей (компания → контакты) | Нет иерархии — плоская структура |
| IMPORTANT | Множественные адреса/телефоны | NAME_ADDRESS, NAME_PHONE таблицы (109K + 61K записей) | email и phone только одни строки — потеря данных |
| IMPORTANT | UDF поля | 40 текстовых + 40 числовых + 20 дат | Нет UDF |
| IMPORTANT | REPEAT_GUEST_ID | Связь на того же профиля (повторный гость) | Нет отслеживания повторных гостей |
| IMPORTANT | VIP_STATUS | VARCHAR(20), e.g. "VIP", "SILVER" | INTEGER — теряется информация о типе VIP |
| IMPORTANT | ACTIVE_YN | Профиль может быть активен/неактивен | Нет поля — предполагаем все активны |
| MINOR | SALUTATION | VARCHAR(60) — сложное приветствие | Нет |
| MINOR | HISTORY_YN | Отслеживать ли историю | Нет |
| MINOR | Согласия на контакт | MAIL_YN, EMAIL_YN, PHONE_YN, SMS_YN | Нет GDPR/согласий |
| MINOR | SUPER_SEARCH_INDEX_TEXT | Индекс для ускоренного поиска | Нет |
| MINOR | Иммиграционные данные | ALIEN_REGISTRATION_NO, IMMIGRATION_STATUS, VISA_VALIDITY_TYPE | Нет |

---

## Модуль 4: Фолио и Транзакции (Folio)

### Opera: как устроено

**Таблица FINANCIAL_TRANSACTIONS (1.6M+ транзакций):**
- TRX_NO (primary key, автоинкремент)
- RESORT, BUSINESS_DATE (дата ночного аудита)
- RESV_NAME_ID (FK на гостя в бронировании)
- TRX_CODE (e.g., "ROOM", "ROOM_TAX", "FOBI", "REST") + TC_GROUP + TC_SUBGROUP
- FT_SUBTYPE (5 значений): `C` (Charge - 1.2M), `FC` (Folio Credit - 235K), `PK` (Package - 181K)
- TRX_AMOUNT (может быть в разных валютах с CURRENCY + EXCHANGE_RATE)
- POSTED_AMOUNT (может отличаться от TRX_AMOUNT если обменная ставка изменилась)
- DEBIT/CREDIT поля: GUEST_ACCOUNT_DEBIT/CREDIT, CASHIER_DEBIT/CREDIT, PACKAGE_DEBIT/CREDIT, DEP_LED_DEBIT/CREDIT, AR_LED_DEBIT/CREDIT
- Фолио: FOLIO_VIEW (1-5, окна фолио), FOLIO_TYPE (100 символов)
- Налоги: TAX_INCLUSIVE_YN, TAX_GENERATED_YN (система сгенерировала ли налог), TAX_RATE, TAX_ELEMENTS
- Статус: APPROVAL_STATUS (e.g., PENDING, APPROVED)
- POSTING_DATE (когда постили), POSTING_TYPE, POSTING_SOURCE_NAME_ID
- Ассоциация: REFERENCE (2000 символов), REMARK (2000)
- Отмена: CORRECTION_YN, REVERSE_PAYMENT_TRX_NO (если платёж отменён)
- Иерархия: TRX_NO_ADJUST (если налог добавлен к основной транзакции)

**TC_GROUP значения в HA336:**
- BQ (Beverage - напитки)
- FB (Food & Beverage)
- IP (Service Charge / IP)
- IR (Interest)
- MI (Miscellaneous)
- NO (Notes?)
- OP_PAYINT_GRP (Payments)
- PM (Payment)
- RO (Room / RO)
- TL (Telephone)
- WP (Whitepages?)

**Фолио окна:**
- FOLIO_VIEW 1-5 (разные окна фолио, e.g., основное окно, доп. услуги)

### У нас: как реализовано

**Таблица folioTransactions:**
- id (UUID)
- bookingId (FK), businessDateId (FK), transactionCodeId (FK)
- debit/credit (decimal 10,2)
- folioWindow (integer, 1-5)
- quantity, description
- isSystemGenerated (boolean — для ночного аудита)
- appliedTaxRate, parentTransactionId (FK)
- postedBy (VARCHAR 100 — кто постил)

**Таблица transactionCodes:**
- code, description, groupCode (e.g., "room_charge", "tax", "payment", "minibar", "restaurant", "spa", "laundry", "phone", "parking", "misc")
- transactionType ("charge" или "payment")
- isManualPostAllowed, isActive
- adjustmentCodeId (self-FK для налогов/корректировок)

**Ночной аудит логика:**
1. Получить открытую business date
2. Найти все checked_in брони
3. Для каждой брони постить ROOM charge (если rateAmount > 0)
4. Если taxRate > 0, постить ROOM_TAX отдельно
5. Идемпотентность: проверить есть ли уже ROOM charge для этой даты/брони

**Код фолио:**
- calculateFolioBalance: SUM(debit) - SUM(credit)
- canCheckOut: balance <= 0
- shouldPostRoomCharge: rateAmount > 0

### Расхождения

| Severity | Проблема | Opera | У нас |
|----------|----------|-------|-------|
| IMPORTANT | FT_SUBTYPE | C, FC, PK (5 типов, важно для аналитики) | Нет классификации типов — все одинаковые |
| IMPORTANT | TC_GROUP | 12+ групп (FB, IP, IR, MI, RO, TL, etc.) | 10 групп (room_charge, tax, payment, minibar, restaurant, spa, laundry, phone, parking, misc) — близко, но не совпадает |
| IMPORTANT | FOLIO_VIEW | 1-5 (окна фолио) | folioWindow есть, но не используется в логике |
| IMPORTANT | DEBIT/CREDIT разделение | Multiple ledgers (GUEST, CASHIER, PACKAGE, DEP_LED, AR_LED) | Только GUEST_ACCOUNT (debit/credit в folioTransactions) |
| IMPORTANT | TRX_NO иерархия | TRX_NO_ADJUST (налог привязан к основной TX) | parentTransactionId есть, но используется ли правильно? |
| IMPORTANT | Валютные операции | CURRENCY, EXCHANGE_RATE, POSTED_AMOUNT ≠ TRX_AMOUNT | Нет поддержки валют — только один валюта |
| MINOR | TAX_INCLUSIVE_YN | Отслеживаем ли налог включен в цену | Не явно отслеживаем |
| MINOR | APPROVAL_STATUS | PENDING/APPROVED для некоторых TX | Нет подтверждений операций |
| MINOR | REFERENCE/REMARK | Очень длинные описания (2000 символов) | description (255 символов) — может потеряться информация |
| MINOR | CORRECTION_YN | Флаг для отмены TX | Есть parentTransactionId, но не явный флаг |

---

## Модуль 5: Ночной аудит (Night Audit)

### Opera: как устроено

**Процесс ночного аудита в Opera (EOD - End of Day):**
1. **Закрытие business date** — переход с открытой даты на закрытую
2. **Due outs** — проверить checked_in с checkOut <= businessDate
3. **Pending no-shows** — confirmed с checkIn < businessDate → автоматически перевести в NO SHOW или CANCELLED
4. **Room charges** — для каждого checked_in гостя постить ROOM charge (из RATE_HEADER)
5. **Налоги** — для каждого ROOM charge постить отдельный TAX если taxRate > 0
6. **Ночной кассир** — открыть новый кассир на следующий день
7. **Отчеты** — сгенерировать ночные отчеты
8. **Архивирование** — закрыть текущую business date

**Важные моменты:**
- Все операции в одной транзакции (atomic)
- Идемпотентность: если аудит запущен дважды, второй раз он пропускает уже постленные charge
- Налоги: TAX_GENERATED_YN = Y, связаны с основным TRX через TRX_NO_ADJUST
- Ночной кассир: новый CASHIER_ID на следующий день

### У нас: как реализовано

**Процесс ночного аудита (night-audit route):**
1. **Preview** — что будет сделано (due outs, pending no-shows, rooms to charge, estimated revenue)
2. **Run** — атомарная транзакция:
   - Идемпотентность: проверить есть ли уже ROOM charge с isSystemGenerated=true
   - Due outs: checked_in с checkOut <= businessDate (НО: просто информационное)
   - Pending no-shows: confirmed с checkIn < businessDate → mark as no_show или cancel (по решению пользователя)
   - Room charges: для каждого checked_in постить ROOM + ROOM_TAX (если налог > 0)
   - Tax связь: parentTransactionId (налог → основной ROOM charge)
3. **Close business date** — обновить status = "closed"
4. **Ответ** — summary с результатами

**Важные моменты:**
- Одна DB транзакция (app.db.transaction)
- Идемпотентность через uniqueIndex на (bookingId, businessDateId, transactionCodeId, isSystemGenerated=true)
- Due outs НЕ автоматически процессятся — только показываются в preview
- No-shows: пользователь решает для каждого

### Расхождения

| Severity | Проблема | Opera | У нас |
|----------|----------|-------|-------|
| CRITICAL | Due outs обработка | Автоматически перемещаются в следующий день или checkout принудительно | Только информационное — не обрабатываются автоматически |
| IMPORTANT | Ночной кассир | Открывается новый кассир на следующий день | Нет концепции кассира — просто транзакции в folio |
| IMPORTANT | Отчеты | Сгенерируются автоматически | Нет отчётов |
| IMPORTANT | Tax связь | TRX_NO_ADJUST явно указывает на основной TX | parentTransactionId есть, но в какой момент он установлена? |
| MINOR | Повторный запуск | Проверка идемпотентности только на ROOM TX, но не на TAX | Уникальный индекс на транзакцию, но по одному коду |
| MINOR | Многовалютность | Поддержка обменных ставок | Не реализовано |

---

## Модуль 6: Бизнес-дата (Business Date)

### Opera: как устроено

**Концепция Business Date:**
- Каждый день в отеле начинается не в 00:00, а в определённое время (e.g., 03:00)
- Все операции за день привязаны к BUSINESS_DATE (дате ночного аудита)
- На день может быть только одна открытая business_date
- Переход между днями происходит при закрытии ночного аудита

**В таблицах:**
- FINANCIAL_TRANSACTIONS.BUSINESS_DATE
- RESERVATION_DAILY_ELEMENTS.RESERVATION_DATE

### У нас: как реализовано

**Таблица businessDates:**
- date (DATE)
- status ('open' или 'closed')
- closedAt, closedBy (кто закрыл)
- propertyId, uniqueIndex на (propertyId, status='open')

**Использование:**
- getBusinessDate(db, propertyId) — получить открытую дату или текущий день
- Все бронирования проверяют checkInDate >= businessDate
- Night audit работает с открытой businessDate

### Расхождения

| Severity | Проблема | Opera | У нас |
|----------|----------|-------|-------|
| MINOR | Время открытия дня | Может быть не 00:00 (e.g., 03:00) | Предполагаем 00:00 — не конфигурируемо |
| MINOR | История дат | Можно смотреть закрытые дни | Просто плоская таблица — нет аналитики по дням |

---

## Модуль 7: Тарифные планы (Rate Plans)

### Opera: как устроено

**Таблица RATE_HEADER (498 тарифов в HA336):**
- RATE_CODE (e.g., "NRATE", "CORP10") + RATE_CLASS + RATE_CATEGORY
- DESCRIPTION (2000 символов), LABEL (20 символов для UI)
- BASE_RATE_CODE (может быть ссылка на другой тариф)
- Правила: LOS_UNIT (длина пребывания), SELL_SEQUENCE, FREQUENCY
- Цены: BASE_AMOUNT, BASE_FLT_PCT (% от базы), BASE_ROUNDING
- Налоги: TAX_INCLUDED_YN, TAX_INCLUDED_PERC
- Брокеры: COMMISSION_YN, COMMISSION_PCT, COMMISSION_CODE
- Ограничения: MIN_LOS, MAX_LOS, ADVANCE_BOOKING, MAX_ADVANCE_BOOKING
- Гибкость: YIELDABLE_YN (может ли система менять цену для yield), NEGOTIATED, COMPLIMENTARY_YN, HOUSE_USE_YN
- Тип: PACKAGE_YN (пакет или индивидуальный), POSTING_RHYTHM (D=daily, W=weekly, M=monthly)
- Доступность: BEGIN_BOOKING_DATE, END_BOOKING_DATE, INACTIVE_DATE
- Дополнительные: BFST_INCL_YN (завтрак включен?), SERVICE_INCL_YN
- Дети/Младенцы: MIN_OCCUPANCY, MAX_OCCUPANCY
- Текст: ADDITION, MULTIPLICATION, SHORT_INFO, LONG_INFO (2000 каждый)

### У нас: как реализовано

**Таблица ratePlans:**
- code, name, description
- baseRate (decimal)
- isDefault, isActive

**Таблица ratePlanRoomRates:**
- ratePlanId, roomTypeId → amount (matrix)
- Unique constraint на (ratePlanId, roomTypeId)

### Расхождения

| Severity | Проблема | Opera | У нас |
|----------|----------|-------|-------|
| IMPORTANT | Матрица тарифов | Может быть по RATE_CATEGORY (типам комнат) + дополнительным параметрам | У нас простая матрица: ratePlan × roomType → одна цена |
| IMPORTANT | Правила LOS | MIN_LOS, MAX_LOS, ADVANCE_BOOKING | Нет ограничений на длину пребывания |
| IMPORTANT | Налоги в тарифе | TAX_INCLUDED_YN, TAX_INCLUDED_PERC | Нет — налоги только на уровне property |
| IMPORTANT | Комиссии | COMMISSION_YN, COMMISSION_PCT, COMMISSION_CODE | Нет комиссий |
| IMPORTANT | Гибкость | YIELDABLE_YN, NEGOTIATED, COMPLIMENTARY_YN, HOUSE_USE_YN | Нет — все тарифы одинаковые |
| IMPORTANT | Дополнительные услуги | BFST_INCL_YN (завтрак), SERVICE_INCL_YN | Не встроено в тариф |
| MINOR | Текст описания | ADDITION, MULTIPLICATION, SHORT_INFO, LONG_INFO | Только description (text) |
| MINOR | POSTING_RHYTHM | D/W/M — как часто постить charges | Нет — постим ежедневно |
| MINOR | Иерархия тарифов | BASE_RATE_CODE — можно расчитывать от другого тарифа | Нет иерархии |

---

## Модуль 8: Типы комнат (Room Types)

### Opera: как устроено

**Таблица ROOM_CATEGORY_TEMPLATE (в HA336):**
- ROOM_CATEGORY (e.g., "STD", "DLX", "STE", "JRS")
- ROOM_CLASS
- NUMBER_ROOMS (сколько комнат этого типа в отеле)
- SHORT_DESCRIPTION, LONG_DESCRIPTION (2000 символов)
- PSEUDO_ROOM_TYPE, PSEUDO_YN (псевдо-номер для ночного аудита?)
- SUITE_YN (люкс?)
- SUITE_TYPE (e.g., "PARLOR", "BEDROOM")
- MAX_OCCUPANCY, MAX_OCCUPANCY_ADULTS, MAX_OCCUPANCY_CHILDREN, MIN_OCCUPANCY
- MAX_FIX_BED_OCCUPANCY (максимум людей на фиксированные кровати)
- MAX_ROLLAWAYS (максимум раскладушек)
- RATE_CODE (DEFAULT rate для этой категории)
- RATE_AMOUNT (базовая цена)
- DEF_OCCUPANCY (default заселение)
- IMAGE_ID (ссылка на изображение)
- YIELDABLE_YN (может ли быть куплена через yield management)
- YIELD_CATEGORY (какая категория для yield)
- MAINTENANCE_YN (комнаты на обслуживании)
- SMOKING_PREFERENCE (курение/некурение)
- LABEL, S_LABEL, S_BEDTYPE (этикетки для интерфейса)
- SMOKING_PREFERENCE (e.g., "non-smoking", "smoking")
- CAN_DELETE_YN (можно ли удалить категорию)
- ROOMINFO_URL (ссылка на информацию)

### У нас: как реализовано

**Таблица roomTypes:**
- code, name, description
- maxOccupancy (default 2)
- baseRate (decimal)
- sortOrder

### Расхождения

| Severity | Проблема | Opera | У нас |
|----------|----------|-------|-------|
| IMPORTANT | Разделение взрослых/детей | MAX_OCCUPANCY_ADULTS, MAX_OCCUPANCY_CHILDREN, MAX_FIX_BED_OCCUPANCY | Только maxOccupancy — теряется информация о типах |
| IMPORTANT | Люкс и тип люкса | SUITE_YN, SUITE_TYPE (PARLOR/BEDROOM) | Нет различия |
| IMPORTANT | Раскладушки | MAX_ROLLAWAYS | Не отслеживаем |
| IMPORTANT | Yield категория | YIELDABLE_YN, YIELD_CATEGORY | Нет yield management |
| IMPORTANT | Курение | SMOKING_PREFERENCE | Нет предпочтения |
| IMPORTANT | Дефолтный rate | RATE_CODE, RATE_AMOUNT | Есть baseRate, но не всегда используется |
| MINOR | Изображения | IMAGE_ID | Нет изображений |
| MINOR | Default occupancy | DEF_OCCUPANCY | Не используем |
| MINOR | Статус обслуживания | MAINTENANCE_YN | Встроено в out_of_order |
| MINOR | Pseudo rooms | PSEUDO_YN, PSEUDO_ROOM_TYPE | Нет поддержки |

---

## Модуль 9: Валидации и Бизнес-логика

### Opera: как устроено

**Ключевые правила:**
1. Нельзя забронировать comroom в прошлое
2. Дата выезда должна быть после даты заезда
3. Гость должен быть в профиле (NAME)
4. Конфликт комнат: нельзя забронировать одну комнату два раза
5. Комната должна быть в каталоге и активна
6. Вместимость: adults + children ≤ maxOccupancy
7. Гарантия: должна быть указана для некоторых типов броней
8. Отмена: может быть отменена только если не checked_out/no_show (зависит от статуса)
9. Check-in: balance фолио должен быть <= 0

### У нас: как реализовано

**Валидации (validation.ts):**
- validateBookingDates: checkInDate < checkOutDate
- validateOccupancy: adults >= 1, adults + children ≤ maxOccupancy
- checkRoomConflict: нет пересечений для same room + confirmed/checked_in
- validateRoomMove: only for checked_in, new room vacant + clean/inspected, same room type
- validateReinstateCheckedOut: checkOutDate > businessDate

**Проверки в routes:**
- POST /bookings: PAST_CHECKIN_DATE, ROOM_CONFLICT, ROOM_UNAVAILABLE (OOO/OOS), checkInDate >= businessDate
- PUT /bookings: DATES_LOCKED (не менять dates if checked_in/checked_out), DATES_EXPIRED (checkOutDate < businessDate)
- DELETE: RESTRICT на FK — проверить нет ли folio transactions

### Расхождения

| Severity | Проблема | Opera | У нас |
|----------|----------|-------|-------|
| IMPORTANT | Гарантия | Должна быть указана для броней | Нет проверки гарантии |
| IMPORTANT | Tax-related rules | Налоги могут влиять на доступность тарифов | Простой расчёт налога |
| MINOR | POSTING_ALLOWED_YN | Проверяем ли что гость может постить на фолио | Нет проверки |
| MINOR | Валюты | Проверка совместимости валют для платежей | Нет |

---

## Таблица всех расхождений (отсортирована по severity)

| Severity | Модуль | Проблема | Opera | У нас | Тип |
|----------|--------|----------|-------|-------|------|
| CRITICAL | Гости | NAME_TYPE обязателен | VARCHAR(20), e.g. G/C/E/A/V | Нет типа профиля | Отсутствующее поле |
| CRITICAL | Бронирования | Посуточные элементы | RESERVATION_DAILY_ELEMENTS | Не реализовано | Отсутствующая таблица |
| CRITICAL | Night Audit | Due outs обработка | Автоматически | Только информационное | Отсутствующая логика |
| IMPORTANT | Гости | PRIMARY_NAME_ID иерархия | Есть связь | Плоская структура | Отсутствующая функция |
| IMPORTANT | Гости | Множественные адреса | NAME_ADDRESS (109K) | Одна строка email | Ограничение данных |
| IMPORTANT | Гости | VIP_STATUS тип | VARCHAR(20) | INTEGER | Потеря типа данных |
| IMPORTANT | Комнаты | ROOM_STATUS коды | CL, DI, IP, OO, OS | clean, dirty, pickup, OOO, OOS | Разные кодировки |
| IMPORTANT | Комнаты | Логирование движения | ASSIGN_UID/DATE/TYPE/REASON | Только текущий статус | Отсутствующая логика |
| IMPORTANT | Фолио | FT_SUBTYPE классификация | C, FC, PK | Нет классификации | Отсутствующее поле |
| IMPORTANT | Фолио | Несколько ledgers | GUEST, CASHIER, PACKAGE, DEP_LED, AR_LED | Только GUEST | Упрощённая модель |
| IMPORTANT | Фолио | Валютные операции | CURRENCY, EXCHANGE_RATE | Только один валюта | Отсутствующая функция |
| IMPORTANT | Тарифы | Правила LOS | MIN_LOS, MAX_LOS | Нет ограничений | Отсутствующие правила |
| IMPORTANT | Тарифы | Налоги в тарифе | TAX_INCLUDED_YN | На уровне property | Упрощённая модель |
| IMPORTANT | Тарифы | Комиссии | COMMISSION_YN, PCT | Нет комиссий | Отсутствующая функция |
| IMPORTANT | Бронирования | Статус PROSPECT | 2,618 броней | Нет PROSPECT | Отсутствующий статус |
| IMPORTANT | Типы комнат | Разделение взрослых/детей | MAX_OCCUPANCY_ADULTS/CHILDREN | Только maxOccupancy | Упрощённая модель |
| IMPORTANT | Типы комнат | Раскладушки | MAX_ROLLAWAYS | Не отслеживаем | Отсутствующая функция |
| IMPORTANT | Фолио | Уникальность TAX | Идемпотентность на каждый код | Общий уникальный индекс | Потенциальная проблема |
| IMPORTANT | Бронирования | GUARANTEE_CODE | Есть поле | Нет поля guarantee_code | Потеря данных |
| MINOR | Гости | UDF поля | 40 текстовых + 40 числовых + 20 дат | Нет UDF | Потеря данных |
| MINOR | Гости | REPEAT_GUEST_ID | Отслеживание повторных | Нет | Потеря данных |
| MINOR | Гости | ACTIVE_YN | Активный/неактивный | Предполагаем активные | Отсутствующее поле |
| MINOR | Гости | Согласия на контакт | MAIL_YN, EMAIL_YN, PHONE_YN, SMS_YN | Нет GDPR | Отсутствующие поля |
| MINOR | Гости | Иммиграционные данные | ALIEN_REGISTRATION_NO, VISA | Нет | Потеря данных |
| MINOR | Комнаты | OCCUPANCY_CONDITION | Может не совпадать с HK_STATUS | Не отслеживаем | Отсутствующее поле |
| MINOR | Комнаты | HK инспекция | HK_INSP_FLAG, DATE, EMP_ID | Не отслеживаем | Отсутствующая логика |
| MINOR | Комнаты | HK сечение | HK_SECTION_CODE | Нет | Потеря данных |
| MINOR | Комнаты | FO_STATUS | Front Desk status | Нет | Отсутствующее поле |
| MINOR | Фолио | FOLIO_VIEW использование | 1-5 окна | Есть folioWindow но не используется | Неиспользуемое поле |
| MINOR | Фолио | REFERENCE длина | 2000 символов | 255 символов | Ограничение |
| MINOR | Фолио | APPROVAL_STATUS | PENDING/APPROVED | Нет подтверждений | Отсутствующая логика |
| MINOR | Night Audit | Время business date | Может быть не 00:00 | 00:00 (не конф.) | Предположение |
| MINOR | Тарифы | Иерархия базового тарифа | BASE_RATE_CODE | Нет иерархии | Отсутствующая функция |
| MINOR | Тарифы | POSTING_RHYTHM | D/W/M | Только D (daily) | Упрощённая модель |
| MINOR | Валидации | POSTING_ALLOWED_YN | Проверяем ли | Нет проверки | Отсутствующая логика |

---

## Итоговая таблица расхождений по severity

### CRITICAL (3 шт) — Блокирует функцию
1. Гости: NAME_TYPE обязателен (G/C/E/A/V)
2. Бронирования: RESERVATION_DAILY_ELEMENTS посуточные элементы не реализованы
3. Night Audit: Due outs не обрабатываются автоматически

### IMPORTANT (20 шт) — Серьёзное расхождение, потеря данных
- Гости (5): иерархия, множественные адреса/телефоны, VIP_STATUS, UDF, REPEAT_GUEST_ID
- Комнаты (3): статусы коды, логирование движения, разделение типов
- Фолио (5): FT_SUBTYPE, ledgers, валюты, uniqueness TAX, REFERENCE
- Тарифы (4): LOS правила, налоги, комиссии, GUARANTEE_CODE
- Типы комнат (2): взрослые/дети, раскладушки
- Бронирования (1): статус PROSPECT

### MINOR (24 шт) — Улучшение, потеря некритичной информации

---

## Рекомендации по приоритетам

### Фаза 1: CRITICAL (должны быть исправлены немедленно)
1. **NAME_TYPE для гостей** — добавить enum (guest/company/employee/agent/vendor)
   - Миграция: все текущие гости = guest
   - Время: 2 часа

2. **RESERVATION_DAILY_ELEMENTS** — создать таблицу для посуточных данных
   - Новые поля: cribs, extraBeds, посуточная отмена
   - Миграция: развернуть bookings на дни
   - Время: 4 часа (+ тесты)

3. **Due outs обработка в Night Audit** — автоматически обрабатывать due outs
   - Логика: если checkOut <= businessDate и checked_in, то auto-checkout или принудительно
   - Время: 2 часа

### Фаза 2: IMPORTANT (приоритет на следующий спринт)
1. **Иерархия гостей** — добавить PRIMARY_NAME_ID (компания → контакты)
   - Новое поле в guests: parentGuestId (FK self)
   - Миграция: все текущие = листья
   - Время: 4 часа

2. **Множественные адреса/телефоны** — создать NAME_ADDRESS, NAME_PHONE таблицы
   - Переносить email/phone из guests в адреса/телефоны
   - Время: 6 часов

3. **VIP_STATUS = VARCHAR** — изменить тип с INTEGER на VARCHAR
   - Миграция: 1=VIP → VIP, 2=SILVER → SILVER и т.д.
   - Время: 1 час

4. **ROOM_CATEGORY обновить коды** — выровнять с Opera (CL/DI/IP/OO/OS)
   - Возможно: создать миграцию в background (не нарушая API)
   - Время: 2 часа

5. **Логирование движения комнат** — создать roomStatusHistory таблицу
   - Логировать все изменения статуса
   - Время: 3 часа

6. **FT_SUBTYPE для фолио** — добавить классификацию (C/FC/PK)
   - Новое поле в folioTransactions: ftSubtype
   - Миграция: вычислить на основе transactionCodeId
   - Время: 2 часа

7. **GUARANTEE_CODE** — добавить поле в bookings
   - FK на guaranteeCodes таблицу (если нужна)
   - Или просто VARCHAR
   - Время: 1 час

### Фаза 3: MINOR (улучшение UX, не критично для MVP)
- UDF поля (40+40+20 = 100 полей — слишком для быстрого MVP)
- REPEAT_GUEST_ID (для лояльности)
- ACTIVE_YN для гостей
- Согласия GDPR
- HK инспекция логирование
- Валюты и обменные ставки

---

## Выводы

### Что сделано правильно
✅ 2D модель комнат (housekeeping + occupancy) близка к Opera  
✅ Базовые статусы броней (confirmed/checked_in/checked_out/cancelled/no_show) покрывают основное  
✅ Night Audit логика атомарная и идемпотентная  
✅ Фолио debit/credit модель простая и понятная  
✅ Business date концепция правильно реализована  

### Что критично исправить
❌ NAME_TYPE отсутствует — нельзя различить гостей/компании/агентов  
❌ RESERVATION_DAILY_ELEMENTS отсутствует — потеря посуточных данных и крибов  
❌ Due outs не обрабатываются автоматически — Guest может остаться checked_in после businessDate  
❌ Иерархия гостей (компания → контакты) — потеря данных при миграции  
❌ Множественные адреса/телефоны — одна строка вместо 109K адресов  

### Что потеряется при миграции реальных данных из Opera
- ~500M+ пользовательских полей (UDF)
- ~61K адресов + телефонов гостей
- Иерархия компаний (PRIMARY_NAME_ID)
- Посуточные данные бронирования (крибы, экстра кровати, отмены по дням)
- GUARANTEE_CODE для каждой брони
- FT_SUBTYPE классификация (charge/credit/package)
- Ночной кассир concept
- Yield management параметры

**Рекомендация:** Исправить CRITICAL три пункта перед любой миграцией реальных данных. Иначе потеря критической информации.