# План локализации UI — устранение смешения языков

## 1. Текущее состояние

### 1.1 i18n-библиотеки
**Ни одной не установлено.** В `apps/web/package.json` нет `next-intl`, `react-i18next`, `i18next` или других библиотек локализации.

### 1.2 Паттерн смешения

Навигация (`navbar.tsx`) содержит **дублирующие поля** `label` (EN) и `labelRu` (RU), но рендерит только `label`. Это свидетельствует о незавершённой попытке двуязычия. Во всех остальных файлах строки хардкодятся напрямую — никакого механизма переключения.

**Распределение по файлам:**
- ~65% строк — английские
- ~25% строк — русские
- ~10% — смешанные внутри одного компонента (худший кейс)

---

## 2. Инвентаризация строк

Легенда для колонки «Рекомендация»:
- **→ RU** — перевести на русский
- **→ KEEP** — оставить как устоявшийся отраслевой термин (Check In, Folio и т.п.)
- **→ RU+термин** — перевести, но сохранить английский термин в скобках/рядом

### 2.1 Навигация и общий layout

| Файл | Строка | Язык | Текст | Рекомендация |
|------|--------|------|-------|--------------|
| `navbar.tsx:18` | `label` | EN | `"Dashboard"` | → RU: `"Дашборд"` |
| `navbar.tsx:19` | `label` | EN | `"Bookings"` | → RU: `"Бронирования"` |
| `navbar.tsx:20` | `label` | EN | `"Rooms"` | → RU: `"Номера"` |
| `navbar.tsx:21` | `label` | EN | `"Tape Chart"` | → KEEP: `"Tape Chart"` (отраслевой термин) |
| `navbar.tsx:22` | `label` | EN | `"Guests"` | → RU: `"Гости"` |
| `navbar.tsx:23` | `label` | EN | `"Housekeeping"` | → RU: `"Хаускипинг"` |
| `navbar.tsx:26` | `label` | EN | `"Night Audit"` | → KEEP |
| `navbar.tsx:32` | `label` | EN | `"Settings"` | → RU: `"Настройки"` |
| `navbar.tsx:36` | `label` | RU | `"Справка"` | OK |
| `navbar.tsx:126` | текст | RU | `"Бизнес-дата"` | OK |
| `navbar.tsx:141` | кнопка | RU | `"Выйти"` | OK |
| `navbar.tsx:50-53` | роли | RU | `"Админ"`, `"Ресепшен"`, `"Горничная"` | OK |

**Navbar:** убрать поля `labelRu`, переименовать `label` в русские значения (кроме Night Audit, Tape Chart). Удалить `labelRu` из типа `NavItem`.

### 2.2 Страница логина

| Файл | Текст | Язык | Рекомендация |
|------|-------|------|--------------|
| `login/page.tsx:34` | `"Логин"` | RU | OK |
| `login/page.tsx:51` | `"Пароль"` | RU | OK |
| `login/page.tsx:72` | `"Войти"` / `"Вход..."` | RU | OK |

**Логин:** уже полностью на русском — менять нечего.

### 2.3 Dashboard (`page.tsx`)

| Файл | Строка | Язык | Текст | Рекомендация |
|------|--------|------|-------|--------------|
| `page.tsx:58` | заголовок | EN | `"Failed to load dashboard"` | → RU |
| `page.tsx:61` | текст | EN | `"Could not connect to API"` | → RU |
| `page.tsx:67` | ссылка | EN | `"Retry"` | → RU: `"Повторить"` |
| `page.tsx:79` | заголовок | EN | `"No property configured"` | → RU |
| `page.tsx:81` | текст | EN | `"Run database seed to initialize..."` | → RU |
| `page.tsx:106` | заголовок | EN | `"Failed to load dashboard data"` | → RU |
| `page.tsx:131` | h1 | EN | `"Dashboard"` | → RU: `"Дашборд"` |
| `page.tsx:147` | лейбл | EN | `"Occupied"` | → RU: `"Занято"` |
| `page.tsx:154` | лейбл | EN | `"Vacant"` | → RU: `"Свободно"` |
| `page.tsx:161` | лейбл | EN | `"OOO/OOS"` | → KEEP (отраслевые аббревиатуры) |
| `page.tsx:171` | лейбл | EN | `"Dirty"` | → RU: `"Грязные"` |
| `page.tsx:180` | лейбл | EN | `"Clean"` | → RU: `"Чистые"` |
| `page.tsx:189` | лейбл | EN | `"Inspected"` | → RU: `"Проверено"` |
| `page.tsx:199` | h2 | EN | `"Due In"` | → KEEP: `"Due In"` (отраслевой термин) |
| `page.tsx:208` | ссылка | EN | `"View all"` | → RU: `"Все"` |
| `page.tsx:212` | empty | EN | `"No arrivals today"` | → RU: `"Заездов нет"` |
| `page.tsx:244` | ссылка | EN | `"+N more"` | → RU: `"+N ещё"` |
| `page.tsx:255` | h2 | EN | `"Due Out"` | → KEEP |
| `page.tsx:268` | empty | EN | `"No departures today"` | → RU |
| `page.tsx:309` | h2 | EN | `"In-House"` | → KEEP: `"In-House"` |
| `page.tsx:311` | текст | EN | `"N guests"` | → RU: `"N гостей"` |
| `page.tsx:322` | empty | EN | `"No in-house guests"` | → RU: `"Нет проживающих"` |
| `page.tsx:341` | текст | EN | `"Room N"` | → RU: `"№N"` |

### 2.4 Бронирования — список (`bookings/page.tsx`)

| Текст | Язык | Рекомендация |
|-------|------|--------------|
| `"Заселён сегодня"` (строка фильтра) | RU | OK |
| `"Расч. сумма"` | RU | OK |
| Заголовки таблиц: `"Guest"`, `"Check-in"`, `"Check-out"`, `"Total"` | EN | → RU: `"Гость"`, → KEEP: `"Check-in"`, `"Check-out"`, → RU: `"Сумма"` |
| Плейсхолдеры поиска | EN | → RU |

### 2.5 Бронирования — действия (`booking-actions.tsx`) — ХУДШИЙ ФАЙЛ

| Строка | Текст | Язык | Рекомендация |
|--------|-------|------|--------------|
| 56 | `"Загрузка комнат…"` | RU | OK |
| 58 | `"Нет свободных чистых комнат данного типа."` | RU | OK |
| 65 | `"— выберите комнату —"` | RU | OK |
| 79 | `"Отмена"` | RU | OK |
| 86 | `"Подтвердить"` | RU | OK |
| 170 | `"Connection error: Cannot reach the API server..."` | EN | → RU |
| 173 | `"Network error - check your connection"` | EN | → RU |
| 203 | `aria-label="Check in guest"` | EN | → RU |
| 206 | `"Check In"` (кнопка) | EN | → KEEP: `"Check In"` |
| 213 | `"Check-in available on {date}"` | EN | → RU: `"Заселение доступно {date}"` |
| 222 | `aria-label="Check out guest"` | EN | → RU |
| 225 | `"Check Out"` (кнопка) | EN | → KEEP: `"Check Out"` |
| 234 | `aria-label="Move guest to another room"` | EN | → RU |
| 237 | `"Сменить комнату"` | RU | OK |
| 245 | `"Cancel check-in? The guest will need to check in again."` | EN | → RU |
| 250 | `aria-label="Cancel check-in..."` | EN | → RU |
| 253 | `"Cancel Check-in"` | EN | → RU: `"Отменить заселение"` |
| 261 | `"Cancellation reason (optional):"` | EN | → RU: `"Причина отмены (необязательно):"` |
| 266 | `aria-label="Cancel this booking"` | EN | → RU |
| 269 | `"Cancel Booking"` | EN | → RU: `"Отменить бронь"` |
| 279 | `"Восстановить бронирование? Гость будет заново заселён..."` | RU | OK |
| 288 | `aria-label="Reinstate this booking"` | EN | → RU |
| 291 | `"Reinstate"` | EN | → RU: `"Восстановить"` |
| 305 | `"Confirm Check-out"` | EN | → RU: `"Подтвердить выселение"` |
| 319 | `"Warning: This booking is checked-in but has no room assigned..."` | EN | → RU |
| 328 | `"Выберите комнату для заселения"` | RU | OK |
| 343 | `"Смена комнаты"` | RU | OK |
| 359 | `"Внимание: Номер требует уборки"` | RU | OK |
| 366 | `"Отмена"` | RU | OK |
| 379 | `"Заселить всё равно"` | RU | OK |

### 2.6 Night Audit (`night-audit/page.tsx`)

| Строка | Текст | Язык | Рекомендация |
|--------|-------|------|--------------|
| 142 | `"Night Audit"` | EN | → KEEP |
| 151 | `"Dismiss"` | EN | → RU: `"Закрыть"` |
| 160-161 | описание Night Audit | EN | → RU |
| 168 | `"Preview Night Audit"` | EN | → RU: `"Предпросмотр ночного аудита"` |
| 178 | `"Night Audit Preview — ..."` | EN | → KEEP: `"Night Audit — Предпросмотр"` |
| 182 | `"Rooms to charge:"` | EN | → RU: `"Начисления на номера:"` |
| 186 | `"Estimated revenue:"` | EN | → RU: `"Ожидаемая выручка:"` |
| 193 | `"Просрочен выезд:"` | RU | OK |
| 195 | `"(блокируют аудит)"` | RU | OK |
| 200 | `"Выезжают сегодня:"` | RU | OK |
| 211 | `"Неприбывшие гости..."` | RU | OK |
| 244 | `"No Show"` | EN | → KEEP |
| 258 | `"Room Charges Breakdown"` | EN | → RU: `"Детализация начислений"` |
| 262-264 | `"Room"`, `"Guest"`, `"Rate"` | EN | → RU: `"Номер"`, `"Гость"`, `"Тариф"` |
| 285 | `"Warnings"` | EN | → RU: `"Предупреждения"` |
| 300 | `"Run Night Audit"` | EN | → RU: `"Выполнить Night Audit"` |
| 310 | `"Cancel"` | EN | → RU: `"Отмена"` |
| 321 | `"Night Audit Complete"` | EN | → RU: `"Night Audit завершён"` |
| 325-365 | `"Closed date:"`, `"New business date:"`, etc. | EN | → RU (все лейблы) |
| 348 | `"Отменено:"` | RU | OK |
| 364 | `"OOO восстановлено:"` | RU | OK |
| 379 | `"Done"` | EN | → RU: `"Готово"` |

### 2.7 Housekeeping (`housekeeping/`)

| Файл | Текст | Язык | Рекомендация |
|------|-------|------|--------------|
| `page.tsx:44` | `"Хаускипинг — {date}"` | RU | OK |
| `housekeeping-client.tsx:8-12` | Все типы задач на русском | RU | OK |
| `housekeeping-client.tsx:22-27` | Все статусы на русском | RU | OK |
| `housekeeping-client.tsx:54` | `"Без этажа"` | RU | OK |
| `housekeeping-client.tsx:77` | `"Сгенерировано заданий: N"` | RU | OK |

**Housekeeping:** уже полностью на русском.

### 2.8 Configuration

| Файл | Текст | Язык | Рекомендация |
|------|-------|------|--------------|
| `page.tsx:58` | `"Configuration"` | EN | → RU: `"Настройки"` |
| `page.tsx:48` | `"Коды гарантии"` | RU | OK |
| `room-types/page.tsx:27` | `"Room Types"` | EN | → RU: `"Типы номеров"` |
| `rate-plans/page.tsx:28` | `"Rate Plans"` | EN | → RU: `"Тарифные планы"` |
| `packages/page.tsx:37` | `"Packages"` | EN | → RU: `"Пакеты"` |
| `travel-agents/page.tsx:28` | `"Travel Agents"` | EN | → RU: `"Турагенты"` |
| `companies/page.tsx:29` | `"Companies"` | EN | → RU: `"Компании"` |
| Все error messages | EN | → RU |
| Все placeholder | EN | → RU |
| `property-form.tsx:235` | `"НДС/VAT — ставка налога..."` | RU | OK |
| `transaction-codes/` заголовки | RU | OK |

### 2.9 Error handling

| Файл | Текст | Язык | Рекомендация |
|------|-------|------|--------------|
| `error.tsx:14` | `"Something went wrong"` | EN | → RU: `"Произошла ошибка"` |
| `error.tsx:17` | `"An unexpected error occurred."` | EN | → RU: `"Непредвиденная ошибка."` |
| `error.tsx:23` | `"Try again"` | EN | → RU: `"Повторить"` |
| `error-display.tsx:69` | `"Скрыть детали"` / `"Техническая информация"` | RU | OK |
| `error-display.tsx:81` | `"📋 Скопировать для техподдержки"` | RU | OK |

### 2.10 Статистика

| Категория | EN → RU | EN → KEEP | RU (уже ок) | Итого |
|-----------|---------|-----------|-------------|-------|
| Навигация | 6 | 3 | 4 | 13 |
| Dashboard | 18 | 3 | 0 | 21 |
| Booking actions | 10 | 2 | 12 | 24 |
| Booking form/detail | 8 | 2 | 3 | 13 |
| Night Audit | 14 | 2 | 6 | 22 |
| Configuration | ~30 | 0 | 3 | ~33 |
| Guests | ~10 | 0 | 2 | ~12 |
| Rooms | ~8 | 0 | 2 | ~10 |
| Error pages | 3 | 0 | 3 | 6 |
| Housekeeping | 0 | 0 | ~10 | ~10 |
| Help | ~15 | ~5 | 0 | ~20 |
| **Итого** | **~122** | **~17** | **~45** | **~184** |

---

## 3. Стратегия локализации

### 3.1 Подход: **без внешней библиотеки**

**Обоснование:**
1. Проект **однозычный** — целевой язык русский, переключение не планируется
2. ~184 строк — объём, не оправдывающий подключение `next-intl` (routing, middleware, конфигурация)
3. Внешняя библиотека добавит runtime-оверhead, усложнит Server Components
4. Простой словарь + типобезопасный доступ — чище и прозрачнее

### 3.2 Архитектура решения

```
apps/web/src/lib/
└── i18n.ts        # Словарь + функция t()
```

Содержимое `i18n.ts`:

```typescript
const dictionary = {
  // Навигация
  "nav.dashboard": "Дашборд",
  "nav.bookings": "Бронирования",
  "nav.rooms": "Номера",
  "nav.tapeChart": "Tape Chart",
  "nav.guests": "Гости",
  "nav.housekeeping": "Хаускипинг",
  "nav.nightAudit": "Night Audit",
  "nav.settings": "Настройки",
  "nav.help": "Справка",
  "nav.logout": "Выйти",
  "nav.businessDate": "Бизнес-дата",

  // Dashboard
  "dashboard.title": "Дашборд",
  "dashboard.occupied": "Занято",
  "dashboard.vacant": "Свободно",
  "dashboard.dirty": "Грязные",
  "dashboard.clean": "Чистые",
  "dashboard.inspected": "Проверено",
  "dashboard.dueIn": "Due In",
  "dashboard.dueOut": "Due Out",
  "dashboard.inHouse": "In-House",
  "dashboard.noArrivals": "Заездов нет",
  "dashboard.noDepartures": "Выездов нет",
  "dashboard.noInHouse": "Нет проживающих",
  "dashboard.viewAll": "Все",
  "dashboard.more": "+{count} ещё",
  "dashboard.guests": "{count} гостей",
  "dashboard.room": "№{number}",
  "dashboard.failedToLoad": "Не удалось загрузить дашборд",
  "dashboard.couldNotConnect": "Не удалось подключиться к API",
  "dashboard.retry": "Повторить",
  "dashboard.noProperty": "Отель не настроен",
  "dashboard.runSeed": "Выполните сидирование базы данных для инициализации системы.",

  // Booking actions
  "booking.checkIn": "Check In",
  "booking.checkOut": "Check Out",
  "booking.cancelCheckIn": "Отменить заселение",
  "booking.cancelBooking": "Отменить бронь",
  "booking.reinstate": "Восстановить",
  "booking.confirmCheckOut": "Подтвердить выселение",
  "booking.changeRoom": "Сменить комнату",
  "booking.selectRoom": "— выберите комнату —",
  "booking.selectRoomForCheckIn": "Выберите комнату для заселения",
  "booking.roomChange": "Смена комнаты",
  "booking.noCleanRooms": "Нет свободных чистых комнат данного типа.",
  "booking.loadingRooms": "Загрузка комнат…",
  "booking.cancel": "Отмена",
  "booking.confirm": "Подтвердить",
  "booking.checkInAvailable": "Заселение доступно {date}",
  "booking.cancelCheckInConfirm": "Отменить заселение? Гостю нужно будет заселиться заново.",
  "booking.cancelReason": "Причина отмены (необязательно):",
  "booking.reinstateCheckedOut": "Восстановить бронирование? Гость будет заново заселён, комната занята.",
  "booking.reinstateNoShow": "Восстановить бронирование? Дата заезда будет перенесена на сегодня.",
  "booking.reinstateCancelled": "Восстановить бронирование? Статус вернётся в «Подтверждено».",
  "booking.dirtyWarning.title": "Внимание: Номер требует уборки",
  "booking.dirtyWarning.forceCheckIn": "Заселить всё равно",
  "booking.noRoomWarning": "Бронирование заселено, но номер не назначен. Назначьте номер для выселения.",
  "booking.connectionError": "Ошибка соединения: не удалось подключиться к серверу API. Проверьте, что он запущен.",
  "booking.networkError": "Ошибка сети — проверьте подключение",

  // Night Audit
  "nightAudit.title": "Night Audit",
  "nightAudit.description": "Night Audit закрывает текущую бизнес-дату, начисляет стоимость проживания и налоги, отмечает неприбывших гостей и открывает следующую бизнес-дату.",
  "nightAudit.preview": "Предпросмотр ночного аудита",
  "nightAudit.previewTitle": "Night Audit — Предпросмотр",
  "nightAudit.roomsToCharge": "Начисления на номера:",
  "nightAudit.estimatedRevenue": "Ожидаемая выручка:",
  "nightAudit.run": "Выполнить Night Audit",
  "nightAudit.running": "Выполняется…",
  "nightAudit.complete": "Night Audit завершён",
  "nightAudit.closedDate": "Закрытая дата:",
  "nightAudit.newDate": "Новая бизнес-дата:",
  "nightAudit.roomCharges": "Начисления за номера:",
  "nightAudit.taxCharges": "Начисления налогов:",
  "nightAudit.noShows": "No-show:",
  "nightAudit.cancelled": "Отменено:",
  "nightAudit.totalRevenue": "Итого выручка:",
  "nightAudit.roomsDirty": "Номеров переведено в «Грязный»:",
  "nightAudit.oooRestored": "OOO восстановлено:",
  "nightAudit.cancel": "Отмена",
  "nightAudit.done": "Готово",
  "nightAudit.dismiss": "Закрыть",
  "nightAudit.warnings": "Предупреждения",
  "nightAudit.chargesBreakdown": "Детализация начислений",
  "nightAudit.overdueDueOut": "Просрочен выезд:",
  "nightAudit.blockingAudit": "(блокируют аудит)",
  "nightAudit.dueToday": "Выезжают сегодня:",
  "nightAudit.pendingNoShows": "Неприбывшие гости ({count}) — выберите действие",
  "nightAudit.noShowExplanation": "Подтверждённые брони с прошедшей датой заезда. No Show — штатный статус. Отмена — гость предупредил, не приедет.",
  "nightAudit.overdue": "Просрочен выезд:",
  "nightAudit.loading": "Загрузка…",
  "nightAudit.failed": "Не удалось выполнить Night Audit",
  "nightAudit.previewFailed": "Не удалось получить предпросмотр",

  // Error pages
  "error.title": "Произошла ошибка",
  "error.unexpected": "Непредвиденная ошибка.",
  "error.tryAgain": "Повторить",

  // Common
  "common.cancel": "Отмена",
  "common.save": "Сохранить",
  "common.delete": "Удалить",
  "common.edit": "Редактировать",
  "common.loading": "Загрузка…",
  "common.name": "Имя",
  "common.guest": "Гость",
  "common.total": "Итого",
  "common.status": "Статус",
  "common.amount": "Сумма",
  "common.room": "Номер",
  "common.rate": "Тариф",
  "common.active": "Активен",
  "common.failedToLoad": "Не удалось загрузить данные",
  "common.failedToSave": "Не удалось сохранить",
  "common.confirmDelete": "Вы уверены, что хотите удалить?",
  "common.searchByName": "Поиск по названию…",
} as const;

type DictionaryKey = keyof typeof dictionary;

export function t(key: DictionaryKey, params?: Record<string, string | number>): string {
  let text = dictionary[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export type { DictionaryKey };
```

### 3.3 Ключи, которые НЕ переводятся (отраслевые термины)

Эти строки остаются на английском — это стандартные термины гостиничного бизнеса:

- `Check In`, `Check Out` — на кнопках действий
- `Night Audit` — в заголовках и кнопках
- `Tape Chart` — в навигации
- `Due In`, `Due Out`, `In-House` — на Dashboard
- `No Show` — статус (используется как существительное)
- `OOO/OOS` — аббревиатуры Out of Order / Out of Service
- `Folio` — счёт гостя

---

## 4. Пошаговый план миграции

### Этап 1: Инфраструктура (1 шаг)

1. **Создать `apps/web/src/lib/i18n.ts`** со словарём и функцией `t()` (как описано выше)

### Этап 2: Миграция по файлам (порядок — от общих к частным)

Каждый шаг — отдельный коммит. Порядок:

| # | Файл | Строк | Сложность |
|---|------|-------|-----------|
| 1 | `components/navbar.tsx` | 10 | Низкая — убрать `labelRu`, использовать `t()` |
| 2 | `app/error.tsx` | 3 | Низкая |
| 3 | `app/page.tsx` (Dashboard) | 21 | Средняя — большой файл, много строк |
| 4 | `app/bookings/[id]/booking-actions.tsx` | 24 | Высокая — смешанный, модальные диалоги |
| 5 | `app/bookings/page.tsx` | ~10 | Средняя |
| 6 | `app/bookings/[id]/page.tsx` | ~8 | Низкая |
| 7 | `app/bookings/[id]/folio-section.tsx` | ~5 | Низкая |
| 8 | `app/bookings/[id]/edit/booking-edit-form.tsx` | ~5 | Низкая |
| 9 | `app/bookings/new/booking-form.tsx` | ~10 | Средняя |
| 10 | `app/bookings/date-filter.tsx` | 1 | Низкая |
| 11 | `app/bookings/search-form.tsx` | 1 | Низкая |
| 12 | `app/night-audit/page.tsx` | 22 | Высокая — большой файл |
| 13 | `app/rooms/page.tsx` | ~5 | Низкая |
| 14 | `app/rooms/[id]/page.tsx` | ~5 | Низкая |
| 15 | `app/rooms/[id]/room-status-actions.tsx` | ~5 | Низкая |
| 16 | `app/rooms/[id]/edit/page.tsx` | 1 | Низкая |
| 17 | `app/guests/page.tsx` | ~5 | Низкая |
| 18 | `app/guests/[id]/page.tsx` | ~3 | Низкая |
| 19 | `app/guests/[id]/edit/guest-edit-form.tsx` | ~8 | Низкая |
| 20 | `app/guests/new/guest-form.tsx` | ~8 | Низкая |
| 21 | `app/guests/search-form.tsx` | 1 | Низкая |
| 22 | `app/configuration/page.tsx` | ~5 | Низкая |
| 23 | `app/configuration/room-types/*` | ~10 | Средняя |
| 24 | `app/configuration/rate-plans/*` | ~15 | Средняя |
| 25 | `app/configuration/packages/*` | ~10 | Средняя |
| 26 | `app/configuration/travel-agents/*` | ~8 | Низкая |
| 27 | `app/configuration/companies/*` | ~8 | Низкая |
| 28 | `app/configuration/transaction-codes/*` | ~3 | Низкая |
| 29 | `app/configuration/property/*` | ~8 | Средняя |
| 30 | `app/help/*` | ~20 | Низкая — контент, можно перевести прямо |

### Этап 3: Верификация

1. `pnpm typecheck` — проверить, что все ключи словаря используются корректно
2. `pnpm lint` — линтинг
3. Визуальная проверка: `pnpm dev` и пройти по всем страницам
4. Grep по кириллице в JSX за пределами `i18n.ts` — не должно быть хардкода

---

## 5. Пример: до/после — `booking-actions.tsx`

### До (фрагмент)

```tsx
// booking-actions.tsx — строки 195-270
<button aria-label="Check in guest" ...>
  Check In
</button>

<button aria-label="Check out guest" ...>
  Check Out
</button>

<button onClick={() => {
  if (confirm("Cancel check-in? The guest will need to check in again.")) {
    performAction("cancel-check-in");
  }
}} aria-label="Cancel check-in - guest will need to check in again" ...>
  Cancel Check-in
</button>

<button onClick={() => {
  const reason = prompt("Cancellation reason (optional):");
  ...
}} aria-label="Cancel this booking" ...>
  Cancel Booking
</button>
```

### После

```tsx
import { t } from "@/lib/i18n";

<button aria-label={t("booking.checkIn")} ...>
  {t("booking.checkIn")}
</button>

<button aria-label={t("booking.checkOut")} ...>
  {t("booking.checkOut")}
</button>

<button onClick={() => {
  if (confirm(t("booking.cancelCheckInConfirm"))) {
    performAction("cancel-check-in");
  }
}} aria-label={t("booking.cancelCheckIn")} ...>
  {t("booking.cancelCheckIn")}
</button>

<button onClick={() => {
  const reason = prompt(t("booking.cancelReason"));
  ...
}} aria-label={t("booking.cancelBooking")} ...>
  {t("booking.cancelBooking")}
</button>
```

### Navbar — до/после

**До:**
```tsx
interface NavItem {
  href: string;
  label: string;
  labelRu: string;
  visibleTo?: UserRole[];
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", labelRu: "Дашборд" },
  { href: "/bookings", label: "Bookings", labelRu: "Бронирования" },
  // ...
];
// Рендер: {item.label}
```

**После:**
```tsx
import { t, type DictionaryKey } from "@/lib/i18n";

interface NavItem {
  href: string;
  labelKey: DictionaryKey;
  visibleTo?: UserRole[];
}

const navItems: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard" },
  { href: "/bookings", labelKey: "nav.bookings" },
  // ...
];
// Рендер: {t(item.labelKey)}
```

---

## 6. Что НЕ нужно трогать

- `apps/api/` — API возвращает данные, не UI-строки. Ошибки API (`data.error`) остаются как есть — они приходят с бэкенда
- `packages/domain/` — чистая логика, нет UI
- `packages/shared/` — только типы
- `packages/db/` — схема и сид
- `components/auth-provider.tsx` — `"Login failed"`, `"Loading..."` — строк мало, но при желании можно добавить в словарь
- `help/[topic]/page.tsx` — большой контентный файл, лучше перевести целиком при необходимости

## 7. Риски и ограничения

1. **Строки от API**: ошибки вроде `data.error || "Failed to save"` — fallback-строка переводится, но `data.error` приходит с сервера на английском. Решение: в будущем добавить локализацию API-ошибок, но сейчас это не блокер
2. **`confirm()` / `prompt()`**: используют системный диалог браузера — там язык ОС, не наше приложение. Для промо-демо это приемлемо
3. **Даты**: `toLocaleDateString("ru-RU", ...)` — уже настроено, менять не нужно
4. **Параметризация**: строки с `{date}`, `{count}` — простая замена через `String.replace()`, не полноценный ICU-формат. Для одноязычного проекта достаточно

## 8. Итого

- ~184 строки для миграции
- ~122 строки → перевести на русский
- ~17 строк → оставить как отраслевые термины
- ~45 строк → уже на русском, не менять
- 1 новый файл (`i18n.ts`), 0 новых зависимостей
- ~30 файлов затронуто
- Оценка: 2-3 часа работы
