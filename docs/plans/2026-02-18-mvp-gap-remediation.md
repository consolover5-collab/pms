# MVP Gap Remediation Plan
**Дата:** 2026-02-18
**Статус:** Approved
**Источник:** Gap-анализ на основе исследования кода + Opera PMS паттернов

---

## Scope — что делаем

| # | Задача | Описание | Приоритет |
|---|---|---|---|
| B1-B4 | **Баги** | 4 подтверждённых бага в текущем коде | 🔴 P0 |
| T1 | **Детали тарифа** | validFrom/validTo + roomType на матрице цен | 🔴 P0 |
| I1 | **Инвойс/Счёт** | HTML/JSON счёт (не PDF), позиции folio + итог + реквизиты | 🔴 P0 |
| F1 | **Folio Windows** | Логика нескольких окон фолио (поле есть, логика нет) | 🟡 P1 |
| D1 | **Депозит** | Pre-payment с конвертацией при check-in | 🟡 P1 |
| R1 | **Room Move** | Смена комнаты во время проживания | 🟡 P1 |
| O1 | **OTA Stubs** | Заглушки для входящего webhook + исходящего channel manager | 🟡 P1 |

## Scope — что НЕ делаем сейчас

- Налоги (НДС, курортный сбор) — сильно позже
- Walk-in fast path — не в MVP
- Аудит-трейл — позже
- HK assignment — позже
- Политика отмены / штраф — позже
- Пакеты в тарифе — только концептуально продумать, не реализовывать
- Предпочтения гостя — позже
- Группы / блоки комнат — отдельный модуль, позже
- Late checkout charge — решается стандартным POST /folio/post
- City ledger / Corporate AR — позже
- Loyalty — сильно позже
- OTA реализация — только заглушки

---

## Epic 1: Исправление багов (B1-B4)

### B1 — cancel-check-in не очищает roomId
**Файл:** `apps/api/src/routes/bookings.ts`
**Проблема:** При cancel-check-in `roomId` остаётся в брони, комната остаётся заблокированной
**Исправление:** Добавить `roomId: null` в updates при cancel-check-in
**Тест:** После cancel-check-in `booking.roomId === null`

### B2 — Night audit постит нулевые charges
**Файл:** `apps/api/src/routes/night-audit.ts`
**Проблема:** Если `rateAmount = null`, постится ROOM charge на 0 руб
**Исправление:** Проверка `if (rate <= 0) { skippedDuplicates++; continue; }` + предупреждение в результате
**Тест:** Бронь без rateAmount → ночной аудит пропускает + warnings содержит сообщение

### B3 — reinstate checked_out не проверяет checkInDate vs businessDate
**Файл:** `apps/api/src/routes/bookings.ts`
**Проблема:** При reinstate из `checked_out` нет проверки что даты ещё актуальны
**Исправление:** Добавить проверку checkInDate/checkOutDate для checked_out так же как для cancelled/no_show
**Тест:** Reinstate брони у которой checkOutDate <= businessDate → 400 DATES_EXPIRED

### B4 — folio/post некорректно обрабатывает payment-код
**Файл:** `apps/api/src/routes/folio.ts`
**Проблема:** `POST /folio/post` автоматически определяет debit/credit по типу кода — это скрытое поведение
**Исправление:** Явная документация в ответе + тест покрытие
**Тест:** POST charge с payment-кодом → идёт в credit (не debit)

---

## Epic 2: Детали тарифа (T1)

### Цель
Тарифная матрица с датами действия и привязкой к типу номера.

### Изменения схемы БД
```sql
-- Добавить в rate_plan_room_rates:
ALTER TABLE rate_plan_room_rates
  ADD COLUMN valid_from DATE,
  ADD COLUMN valid_to DATE;

-- Уникальный constraint: (ratePlanId, roomTypeId, validFrom)
```

### Логика выбора ставки
При создании/обновлении бронирования:
1. Ищем запись в `rate_plan_room_rates` где `ratePlanId` + `roomTypeId` совпадают И `checkInDate BETWEEN valid_from AND valid_to`
2. Если найдена → используем её `amount`
3. Если не найдена (нет validFrom/validTo) → используем запись без дат (old behavior)
4. Если несколько подходят → берём наиболее специфичную (с датами приоритетнее без дат)

### API
- `GET /api/rate-plans/:id/rates` — матрица цен (с датами)
- `PUT /api/rate-plans/:id/rates` — обновить матрицу (принимает validFrom/validTo)

### UI
- Страница тарифного плана: таблица с периодами и ценами по типам номеров
- Кнопка "Добавить период"

---

## Epic 3: Инвойс/Счёт (I1)

### Цель
Сформировать счёт гостя по бронированию — HTML-страница (не PDF).

### API
```
GET /api/bookings/:id/invoice
Response: JSON {
  booking: { confirmationNumber, checkIn, checkOut, nights },
  guest: { name, email, documentNumber },
  property: { name, address, taxId },
  lineItems: [ { date, description, amount } ],
  summary: { totalCharges, totalPayments, balance },
  generatedAt: ISO timestamp
}
```

### UI
- Страница `/bookings/:id/invoice` — печатная форма
- Кнопка "Счёт" на карточке бронирования (только для checked_in/checked_out)
- `window.print()` для печати

---

## Epic 4: Folio Windows (F1)

### Цель
Несколько окон фолио для одной брони. Поле `folioWindow` уже есть в схеме.

### Бизнес-логика
- **Окно 1** (по умолчанию) — все charges и payments
- **Окно 2** — например, корпоративные расходы (room charge маршрутизируется сюда)
- **Окно N** — произвольное разделение

### Изменения API
```
GET /api/bookings/:id/folio?window=1      → только окно 1
GET /api/bookings/:id/folio               → все окна, сгруппированные
GET /api/bookings/:id/folio/summary       → баланс по каждому окну

POST /api/bookings/:id/folio/post
Body: { transactionCodeId, amount, description, folioWindow?: number }
(folioWindow default = 1)
```

### Check-out изменение
При check-out проверяем баланс **всех окон** (сумма по всем window).

### UI
- Вкладки окон в компоненте фолио
- При постинге: dropdown выбора окна

---

## Epic 5: Депозит (D1)

### Цель
Pre-payment с автоматической конвертацией в платёж при check-in.

### Новые transaction codes (seed)
```
DEPOSIT        — тип: deposit, groupCode: deposit, isManualPostAllowed: true
DEPOSIT_APPLIED — тип: deposit_offset, system-only (закрывает депозит)
PAYMENT_DEPOSIT — тип: payment, groupCode: payment (применяет депозит как оплату)
```

### API
```
POST /api/bookings/:id/folio/deposit
Body: { amount: number, description?: string }
→ Создаёт folioTransaction: credit=amount, transactionCodeId=DEPOSIT
→ Только для статусов: confirmed (до заезда)
```

### Логика при check-in
В транзакции check-in:
1. Найти все DEPOSIT транзакции по booking (credit без parent)
2. Для каждой:
   - Создать DEPOSIT_APPLIED: debit=amount, parentTransactionId=deposit.id
   - Создать PAYMENT_DEPOSIT: credit=amount
3. Итог: депозит закрыт, оплата применена

### UI
- Кнопка "Принять депозит" на подтверждённой брони (синяя, как Post Charge)
- В фолио: строки депозита выделены цветом до заезда
- После заезда: строки DEPOSIT_APPLIED + PAYMENT_DEPOSIT с пометкой "Конвертирован при заезде"

---

## Epic 6: Room Move (R1)

### Цель
Сменить комнату гостю во время проживания без потери данных.

### API
```
POST /api/bookings/:id/room-move
Body: { newRoomId: string }

Валидация:
1. Статус = checked_in
2. Новая комната существует
3. Новая комната = vacant
4. Новая комната = clean или inspected
5. Тип новой комнаты = тип бронирования (или manager override?)
6. Нет конфликтов по датам на новой комнате

Транзакция:
1. SELECT ... FOR UPDATE на обеих комнатах
2. Старая комната → occupancyStatus=vacant, housekeepingStatus=dirty
3. Новая комната → occupancyStatus=occupied
4. booking.roomId = newRoomId
5. Логировать: notes += "\nRoom moved: {old} → {new} at {timestamp}"
```

### UI
- Кнопка "Сменить комнату" на карточке checked_in брони
- Modal: выбор свободной чистой комнаты нужного типа
- Подтверждение с указанием старой и новой комнаты

---

## Epic 7: OTA Stubs (O1)

### Цель
Архитектурные заглушки для будущей интеграции с OTA/channel manager.
Не реализуют бизнес-логику — только скелет API + документацию.

### Входящий webhook (OTA → наш PMS)
```
POST /api/ota/webhook
Headers: X-OTA-Source: booking.com|expedia|ostrovok
Body: { ...OTA booking payload }
Response: 501 {
  message: "OTA webhook integration not yet implemented",
  planned: "Converts OTA booking to internal booking format and calls POST /api/bookings"
}
```

### Исходящий (наш PMS → Channel Manager)
```
POST /api/ota/availability/push
Body: { propertyId, dateFrom, dateTo, roomTypeId, availability, rate }
Response: 501 {
  message: "Channel manager push not yet implemented",
  planned: "Pushes availability and rate updates to connected channel managers"
}

GET /api/ota/channel-managers
Response: 501 {
  message: "Channel manager list not yet implemented",
  planned: "Returns list of configured channel manager integrations"
}
```

### Концептуальный дизайн (в комментариях к коду)
- Incoming: адаптер-паттерн (OTAAdapter interface), отдельный адаптер на каждый OTA
- Outgoing: event-driven (после изменения availability → emit event → push к CM)
- Auth: каждый OTA получает отдельный API key
- Идемпотентность: OTA booking ID как внешний ключ

---

## Порядок выполнения (рекомендуемый)

```
1. Баги B1-B4          (0.5 дня — быстро, снижает риск)
2. Room Move R1         (1 день — операционно критично)
3. Детали тарифа T1     (1.5 дня — схема + логика + UI)
4. Депозит D1           (1 день — новые коды + check-in логика)
5. Folio Windows F1     (1.5 дня — схема API + UI)
6. Инвойс I1            (1 день — новый endpoint + UI страница)
7. OTA Stubs O1         (0.5 дня — только заглушки)

Итого: ~7 дней
```

---

## Пакеты в тарифах — концептуальная заметка (не реализуем)

Когда дойдём до пакетов, архитектура будет такой:
- Таблица `rate_plan_packages`: ratePlanId → [ packageItemId, description, postingCode, amount ]
- При заезде / ночном аудите: автоматически постировать включённые услуги в folio
- Примеры: завтрак (BRKF, 0 руб в отдельной строке), парковка (PARK, включена в тариф)
- Отображение: в счёте пакетные позиции показываются отдельно с пометкой "Включено"

---

*Документ создан по результатам gap-анализа сессии 2026-02-18*
*Команда: Mary (Analyst), Winston (Architect), John (PM), Barry (Dev), Amelia (Dev)*
