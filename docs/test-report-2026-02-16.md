# Отчёт о тестировании PMS — 2026-02-16

## Сводка

- **Всего тестов**: 44
- **PASS**: 42
- **FAIL**: 1
- **PARTIAL**: 1

## Результаты по эпикам

### Epic 1: Booking Creation & Management — 12/13 PASS, 1 FAIL

| # | Тест | Результат | Примечание |
|---|------|-----------|------------|
| 1 | GET /api/rooms | PASS | 167 комнат, все поля присутствуют |
| 2 | GET /api/rate-plans | PASS | 5 тарифных планов |
| 3 | GET /api/availability | **FAIL** | 404 — эндпоинт не реализован (FR8) |
| 4 | POST /api/bookings | PASS | Бронь создана, totalAmount рассчитан |
| 5 | GET /api/bookings (список) | PASS | Пагинация, фильтрация по статусу |
| 6 | GET /api/bookings/:id | PASS | Полная детализация с гостем и комнатой |
| 7 | PUT /api/bookings/:id | PASS | Обновление дат работает |
| 8 | POST /api/bookings/:id/cancel | PASS | Статус → CANCELLED |
| 9 | Валидация дат (checkOut <= checkIn) | PASS | 400 Bad Request |
| 10 | Валидация гостя (несуществующий) | PASS | 400 Bad Request |
| 11 | Двойная отмена | PASS | 409 Conflict |
| 12 | GET /api/guests | PASS | 10 гостей в сиде |
| 13 | GET /api/guests/:id | PASS | Полные данные гостя |

### Epic 2: Check-in & Check-out — 8/8 PASS

| # | Тест | Результат | Примечание |
|---|------|-----------|------------|
| 1 | POST /api/bookings/:id/check-in | PASS | Статус → CHECKED_IN, комната → occupied+dirty |
| 2 | Check-in уже заселённого | PASS | 409 Conflict |
| 3 | POST /api/bookings/:id/check-out | PASS | Статус → CHECKED_OUT, комната → vacant+dirty |
| 4 | Check-out незаселённого | PASS | 409 Conflict |
| 5 | Назначение комнаты при check-in | PASS | roomId обновляется |
| 6 | Check-in с ошибочной комнатой | PASS | 400 Bad Request |
| 7 | Статус комнаты после check-in | PASS | occupied + dirty |
| 8 | Статус комнаты после check-out | PASS | vacant + dirty |

### Epic 3: Housekeeping — 5/5 PASS

| # | Тест | Результат | Примечание |
|---|------|-----------|------------|
| 1 | PUT /api/rooms/:id/housekeeping | PASS | dirty → pickup → clean |
| 2 | Невалидный статус | PASS | 400 Bad Request |
| 3 | Несуществующая комната | PASS | 404 Not Found |
| 4 | Статус сохраняется | PASS | GET возвращает обновлённый статус |
| 5 | Массовое обновление | PASS | Обновление нескольких комнат подряд |

### Epic 4: Front Desk Dashboard — 4/4 PASS

| # | Тест | Результат | Примечание |
|---|------|-----------|------------|
| 1 | GET /api/dashboard/stats | PASS | occupancy, arrivals, departures, revenue |
| 2 | GET /api/dashboard/arrivals | PASS | Список ожидаемых заездов |
| 3 | GET /api/dashboard/departures | PASS | Список ожидаемых выездов |
| 4 | GET /api/dashboard/room-status | PASS | Сводка по статусам комнат |

### Epic 5: Tape Chart — 3/3 PASS

| # | Тест | Результат | Примечание |
|---|------|-----------|------------|
| 1 | GET /api/tape-chart | PASS | Данные для визуализации |
| 2 | Фильтрация по датам | PASS | startDate/endDate работают |
| 3 | Фильтрация по типу комнаты | PASS | roomType параметр работает |

### Epic 6: Authentication — 5/5 PASS

| # | Тест | Результат | Примечание |
|---|------|-----------|------------|
| 1 | POST /api/auth/login | PASS | Сессионный cookie возвращается |
| 2 | Неверный пароль | PASS | 401 Unauthorized |
| 3 | GET /api/auth/me | PASS | Информация о пользователе |
| 4 | Защита маршрутов без cookie | PASS | 401 на защищённых эндпоинтах |
| 5 | POST /api/auth/logout | PASS | Cookie удаляется |

### Epic 7: Financial Core — 5/6 PASS, 1 PARTIAL

| # | Тест | Результат | Примечание |
|---|------|-----------|------------|
| 1 | GET /api/business-date | PASS | Текущая бизнес-дата |
| 2 | GET /api/transaction-codes | PASS | Список кодов транзакций |
| 3 | POST /api/folios/:id/charges | PASS | Начисление на фолио |
| 4 | POST /api/folios/:id/payments | PASS | Оплата на фолио |
| 5 | POST /api/night-audit/run | PASS | Ночной аудит выполняется |
| 6 | Идемпотентность night audit | **PARTIAL** | Повторный запуск на ту же дату → ALREADY_RUN (корректно), но повторные вызовы без задержки продвигают дату дальше |

## Веб-страницы

| Страница | Статус | Примечание |
|----------|--------|------------|
| / (Dashboard) | OK | 200, но API вызовы возвращают 401 (нет auth cookie при SSR) |
| /login | OK | 200, форма отображается |
| /rooms | OK | 200, но данные не загружаются (401) |
| /guests | OK | 200, но данные не загружаются (401) |
| /bookings | OK | 200, но данные не загружаются (401) |
| /tape-chart | OK | 200 |
| /night-audit | OK | 200 |
| /dashboard | **404** | Dashboard живёт на `/`, а не `/dashboard` |

## Известные проблемы (не блокирующие)

### 1. GET /api/availability — не реализован (FR8)
- **Серьёзность**: Средняя
- **Описание**: Эндпоинт проверки доступности комнат на даты отсутствует. Бронирование работает, но без предварительной проверки.
- **Связано с**: FR8 (PRD)

### 2. /dashboard возвращает 404
- **Серьёзность**: Низкая
- **Описание**: Дашборд расположен на корне `/`, а URL `/dashboard` не существует. Navbar может ссылаться неверно.

### 3. PUT /api/bookings не пересчитывает totalAmount при смене дат
- **Серьёзность**: Средняя
- **Описание**: При обновлении дат бронирования `totalAmount` остаётся прежним. Нужен пересчёт `nights × rate`.

### 4. GET /api/bookings без propertyId → 500
- **Серьёзность**: Низкая
- **Описание**: При отсутствии параметра `propertyId` API возвращает 500 вместо 400. Нужна валидация.

### 5. SSR-страницы получают 401 от API
- **Серьёзность**: Средняя
- **Описание**: Server-side rendering страниц (/, /rooms, /guests, /bookings) вызывает API без сессионного cookie, получает 401. Нужна передача cookie при SSR или перенос загрузки на клиент.

### 6. Night Audit — последовательные запуски продвигают дату
- **Серьёзность**: Низкая
- **Описание**: Идемпотентность работает для одной даты (ALREADY_RUN), но быстрые последовательные вызовы могут продвинуть бизнес-дату далеко вперёд. Дата продвинулась с 2026-02-15 до 2026-02-18 за 3 запуска.

### 7. API использует POST вместо PATCH для смены статусов
- **Серьёзность**: Информационная
- **Описание**: Check-in, check-out, cancel используют `POST /api/bookings/:id/action` вместо `PATCH`. Это отклонение от PRD, но REST-валидно и работает.

## Побочные эффекты тестирования

- Бизнес-дата продвинулась до **2026-02-18** (было 2026-02-15)
- Создана и отменена тестовая бронь **#100011**
- Бронь **7272e39e** — checkout выполнен
- Комната **304** — HK статус менялся (dirty → pickup → clean)
- Комната **202** — dirty + occupied (после check-in теста)
