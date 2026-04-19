# Пользовательское тестирование PMS — 2026-03-31

Web: http://localhost:3000
API: http://localhost:3001


начнём отсюда, появилось окно логина, хотя его не должно было появиться, зашёл пользователем admin
---

## Сценарий 1: Dashboard
Открой http://localhost:3000

**Ожидание:** dashboard с показателями — occupied rooms, arrivals today, departures today.

**Результат:**


Dashboard
вторник, 31 марта 2026 г.

3/54
Occupied (6%)
51
Vacant
0
Dirty
53
Clean
1
Inspected
Arrivals1
View all
FN5946 LN5946#GBH-000009
STD→ 303
Departures1
View all
FN7162 LN7162#GBH-000010
Room 304
In-House3 guests
View all
FN7162 LN7162#GBH-000010
Room 304CO 31 мар.
FN2070 LN2070#GBH-000004
Room 601CO 1 апр.
FN568 LN568#GBH-000003
Room 401CO 2 апр.

тут всё в порядке, ошибок нет, математику не проверял
---

## Сценарий 2: Создание бронирования
1. Bookings → New Booking
2. Выбери гостя (любого из seed)
3. Room type: STD
4. Check-in: 2026-03-31 (сегодня)
5. Check-out: 2026-04-03 (3 ночи)
6. Adults: 1
7. Rate: 4500
8. Save

**Ожидание:** бронирование создано, статус confirmed, confirmation number GBH-000011+.

**Результат:**

бронирование на 0 ночей создать не смог, 3 ночи - порядок 

← Back to bookings
#GBH-000014
Confirmed
Edit Booking
Check In
Cancel Booking
Guest
Name
Ivan Karpov
Email
—
Phone
+38260055827
View guest profile →
Check-in
2026-03-31
Check-out
2026-04-03
Nights
3
Guests
1 adults
Room
Not assigned
Room Type
Standard Twin (STD_TWN)
Rate Plan
Corporate Rate
Rate/Night
4 500,00 ₽
Расч. сумма
13 500,00 ₽
Payment
cash
Folio
Balance: 0,00 ₽
Post Charge
Accept Payment
Total Charges: 0,00 ₽
Total Payments: 0,00 ₽
No transactions

Created: 3/31/2026, 10:06:25 AM

---

## Сценарий 3: Check-in
1. Открой созданное бронирование
2. Нажми Check In
3. Выбери комнату (свободная чистая STD)

**Ожидание:** статус → checked_in, комната назначена.

**Результат:**
на этапе заселения есть вопросы по clean/inspected, я могу заселять и туда и туда, думаю, что нужно иначе, но это записать в бэклог, не критично
---

## Сценарий 4: Folio — ручной charge
1. На странице бронирования — секция Folio
2. Добавь charge: code = FB_REST, amount = 1500
3. Post

**Ожидание:** транзакция в folio, баланс +1500.

**Результат:**
Пробил 500 рублей, затем 1000 добавил комментарии, всё успешно
---

## Сценарий 5: Folio — payment
1. В том же folio — Payment
2. Code = PAY_CASH, amount = 1500

**Ожидание:** payment в folio, баланс -1500.

**Результат:**

 Над этим модулем ещё много нужно будет работать. Сейчас тест прошёл:

Folio
Balance: 0,00 ₽
Post Charge
Accept Payment
Total Charges: 1 500,00 ₽
Total Payments: 1 500,00 ₽
Date	Code	Description	Debit	Credit	Posted By
2026-03-31	PAY_CASH	Cash Payment		1 500,00	system
2026-03-31	FB_REST	и за борщ	1 000,00		system
2026-03-31	FB_REST	за бутерброд	500,00		system
Created: 3/31/2026, 10:06:25 AM

ещё я заметил, что пишу к платежу комментарий, но его не видно.

---

## Сценарий 6: Night Audit
1. Night Audit → Preview
2. Проверь: rooms to charge включает наше бронирование
3. Run

**Ожидание:** Room charge + Tax постятся. Business date → 2026-04-01.

**Результат:**

тут тоже косяк - мы ж на 3 ночи поселили, 01.04 наш номер не уезжает. Создал ещё один номер на 1 ночь и провёл с ним ручные начисления

Guest
Name
Ivanov Ivan
Email
—
Phone
—
View guest profile →
Check-in
2026-03-31
Check-out
2026-04-01
Nights
1
Guests
1 adults
Room
#703
Room Type
Suite (STE)
Rate Plan
Corporate Rate
Rate/Night
4 500,00 ₽
Расч. сумма
4 500,00 ₽
Payment
cash
Folio
Balance: -400,00 ₽
Post Charge
Accept Payment
Total Charges: 100,00 ₽
Total Payments: 500,00 ₽
Date	Code	Description	Debit	Credit	Posted By
2026-03-31	PAY_TRANSFER	Bank Transfer		500,00	system
2026-03-31	MINIBAR	чипсы	100,00		system
Created: 3/31/2026, 10:14:10 AM
И вот тест аудита:
Night Audit
Night Audit Preview — 2026-03-31
Rooms to charge: 4
Estimated revenue: 21 600,00 ₽
Room Charges Breakdown
Room	Guest	Rate
401	FN568 LN568	4 500,00 ₽
703	Ivanov Ivan	4 500,00 ₽
303	FN1086 LN1086	4 500,00 ₽
201	Ivan Karpov	4 500,00 ₽
Run Night Audit
Cancel

Night Audit
Night Audit Complete
Closed date: 2026-03-31
New business date: 2026-04-01
Room charges: 4
Tax charges: 4
No-shows: 0
Total revenue: 21 600,00 ₽
Rooms set to dirty: 4
Done

аудит прошёл, а вот с налогом косяк. Опять же это про логику начисления, пока в бэклог, сам аудит успешный, начисления есть, номер комнаты теперь грязный 


---

## Сценарий 7: Check-out
1. Вернись к бронированию
2. Если check-out date = сегодня (после аудита) — нажми Check Out

**Ожидание:** статус → checked_out, комната → vacant + dirty.

**Результат:**
заплатил денег и уехал, в целом ок

## Сценарий 8: Tape Chart
Открой Tape Chart

**Ожидание:** сетка комнат с бронированиями.

**Результат:**
заполнено, порядок.
---

## Сценарий 9: Rooms
1. Rooms → найди комнату после check-out (dirty)
2. Поменяй HK status на clean

**Ожидание:** статус обновился.

**Результат:**

Порядок

---

## Сценарий 10: API-only (curl в терминале)

```bash
# Packages
curl -s http://localhost:3001/api/packages?propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad | jq '.data | length'

# HK generate
curl -s -X POST http://localhost:3001/api/housekeeping/generate -H 'Content-Type: application/json' -d '{"propertyId":"ff1d9135-dfb9-4baa-be46-0e739cd26dad"}' | jq

# Companies
curl -s http://localhost:3001/api/companies?propertyId=ff1d9135-dfb9-4baa-be46-0e739cd26dad | jq '.data | length'
```

**Ожидание:** packages = 2, HK tasks created, companies = 3.

**Результат:**

эти тесты сам делай