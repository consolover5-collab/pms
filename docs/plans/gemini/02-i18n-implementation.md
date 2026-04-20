# Gemini — i18n Implementation Brief (v2)

> Задача: внедрить двуязычный UI (EN по умолчанию + RU из коробки), с архитектурой,
> допускающей добавление любых языков в будущем без изменения кода компонентов.

---

## Архитектура

```
apps/web/src/lib/i18n/
├── index.ts          # t(), plural(), LOCALES, getLocale()
├── locales/
│   ├── en.ts         # English — источник правды, все ключи обязательны
│   └── ru.ts         # Russian — должен покрывать все ключи en.ts
```

**Переключение языка:** cookie `locale` (читается в Server Components через `next/headers`,
в Client Components через `document.cookie`). Без URL-роутинга — язык это настройка пользователя.

**Добавление нового языка в будущем:** создать `locales/de.ts` реализующий тот же тип → готово.

---

## Шаг 1 — Создать `apps/web/src/lib/i18n/locales/en.ts`

Это источник правды. Все ключи обязательны:

```typescript
export const en = {
  // Navigation
  "nav.dashboard": "Dashboard",
  "nav.bookings": "Bookings",
  "nav.rooms": "Rooms",
  "nav.tapeChart": "Tape Chart",
  "nav.guests": "Guests",
  "nav.housekeeping": "Housekeeping",
  "nav.nightAudit": "Night Audit",
  "nav.settings": "Settings",
  "nav.help": "Help",
  "nav.logout": "Log out",
  "nav.businessDate": "Business date",

  // Dashboard
  "dashboard.title": "Dashboard",
  "dashboard.occupied": "Occupied",
  "dashboard.vacant": "Vacant",
  "dashboard.dirty": "Dirty",
  "dashboard.clean": "Clean",
  "dashboard.inspected": "Inspected",
  "dashboard.dueIn": "Due In",
  "dashboard.dueOut": "Due Out",
  "dashboard.inHouse": "In-House",
  "dashboard.noArrivals": "No arrivals today",
  "dashboard.noDepartures": "No departures today",
  "dashboard.noInHouse": "No in-house guests",
  "dashboard.viewAll": "View all",
  "dashboard.more": "+{count} more",
  "dashboard.guests": "{count} guests",
  "dashboard.room": "Room {number}",
  "dashboard.failedToLoad": "Failed to load dashboard",
  "dashboard.couldNotConnect": "Could not connect to API",
  "dashboard.retry": "Retry",
  "dashboard.noProperty": "No property configured",
  "dashboard.runSeed": "Run database seed to initialize the system.",

  // Booking actions
  "booking.checkIn": "Check In",
  "booking.checkOut": "Check Out",
  "booking.cancelCheckIn": "Cancel Check-in",
  "booking.cancelBooking": "Cancel Booking",
  "booking.reinstate": "Reinstate",
  "booking.confirmCheckOut": "Confirm Check-out",
  "booking.changeRoom": "Change Room",
  "booking.selectRoom": "— select a room —",
  "booking.selectRoomForCheckIn": "Select room for check-in",
  "booking.roomChange": "Room Change",
  "booking.noCleanRooms": "No available clean rooms of this type.",
  "booking.loadingRooms": "Loading rooms…",
  "booking.cancel": "Cancel",
  "booking.confirm": "Confirm",
  "booking.checkInAvailable": "Check-in available on {date}",
  "booking.cancelCheckInConfirm": "Cancel check-in? The guest will need to check in again.",
  "booking.cancelReason": "Cancellation reason (optional):",
  "booking.reinstateCheckedOut": "Reinstate booking? The guest will be re-checked in, room is occupied.",
  "booking.reinstateNoShow": "Reinstate booking? Check-in date will be moved to today.",
  "booking.reinstateCancelled": "Reinstate booking? Status will return to Confirmed.",
  "booking.dirtyWarning.title": "Warning: Room requires housekeeping",
  "booking.dirtyWarning.forceCheckIn": "Check in anyway",
  "booking.noRoomWarning": "Booking is checked in but has no room assigned. Assign a room to check out.",
  "booking.connectionError": "Connection error: could not reach the API server. Make sure it is running.",
  "booking.networkError": "Network error — check your connection",

  // Night Audit
  "nightAudit.title": "Night Audit",
  "nightAudit.description": "Night Audit closes the current business date, posts room charges and taxes, marks no-shows, and opens the next business date.",
  "nightAudit.preview": "Preview Night Audit",
  "nightAudit.previewTitle": "Night Audit Preview",
  "nightAudit.roomsToCharge": "Rooms to charge:",
  "nightAudit.estimatedRevenue": "Estimated revenue:",
  "nightAudit.run": "Run Night Audit",
  "nightAudit.running": "Running…",
  "nightAudit.complete": "Night Audit Complete",
  "nightAudit.closedDate": "Closed date:",
  "nightAudit.newDate": "New business date:",
  "nightAudit.roomCharges": "Room charges posted:",
  "nightAudit.taxCharges": "Tax charges posted:",
  "nightAudit.packageCharges": "Package charges posted:",
  "nightAudit.noShows": "No-shows:",
  "nightAudit.cancelled": "Cancelled:",
  "nightAudit.totalRevenue": "Total revenue:",
  "nightAudit.roomsDirty": "Rooms marked dirty:",
  "nightAudit.oooRestored": "OOO restored:",
  "nightAudit.cancel": "Cancel",
  "nightAudit.done": "Done",
  "nightAudit.dismiss": "Dismiss",
  "nightAudit.warnings": "Warnings",
  "nightAudit.chargesBreakdown": "Room Charges Breakdown",
  "nightAudit.overdueDueOut": "Overdue check-out:",
  "nightAudit.blockingAudit": "(blocking audit)",
  "nightAudit.dueToday": "Due out today:",
  "nightAudit.pendingNoShows": "Pending no-shows ({count}) — choose action",
  "nightAudit.noShowExplanation": "Confirmed bookings past their arrival date. No Show is the standard status. Cancel if the guest notified you they won't arrive.",
  "nightAudit.loading": "Loading…",
  "nightAudit.failed": "Night Audit failed",
  "nightAudit.previewFailed": "Failed to load preview",
  "nightAudit.colRoom": "Room",
  "nightAudit.colGuest": "Guest",
  "nightAudit.colRate": "Rate",

  // Error pages
  "error.title": "Something went wrong",
  "error.unexpected": "An unexpected error occurred.",
  "error.tryAgain": "Try again",

  // Common
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.deactivate": "Deactivate",
  "common.activate": "Activate",
  "common.loading": "Loading…",
  "common.name": "Name",
  "common.guest": "Guest",
  "common.total": "Total",
  "common.status": "Status",
  "common.amount": "Amount",
  "common.room": "Room",
  "common.rate": "Rate",
  "common.active": "Active",
  "common.failedToLoad": "Failed to load data",
  "common.failedToSave": "Failed to save",
  "common.confirmDelete": "Are you sure you want to delete this?",
  "common.searchByName": "Search by name…",
  "common.noResults": "No results found",
  "common.backToBookings": "Back to bookings",
  "common.editBooking": "Edit Booking",
} as const;

export type Dictionary = typeof en;
export type DictionaryKey = keyof Dictionary;
```

---

## Шаг 2 — Создать `apps/web/src/lib/i18n/locales/ru.ts`

Тип `Dictionary` гарантирует что все ключи покрыты:

```typescript
import type { Dictionary } from "./en";

export const ru: Dictionary = {
  // Navigation
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
  "booking.connectionError": "Ошибка соединения: не удалось подключиться к серверу API.",
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
  "nightAudit.packageCharges": "Начисления пакетов:",
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
  "nightAudit.noShowExplanation": "Подтверждённые брони с прошедшей датой заезда. No Show — штатный статус.",
  "nightAudit.loading": "Загрузка…",
  "nightAudit.failed": "Не удалось выполнить Night Audit",
  "nightAudit.previewFailed": "Не удалось получить предпросмотр",
  "nightAudit.colRoom": "Номер",
  "nightAudit.colGuest": "Гость",
  "nightAudit.colRate": "Тариф",

  // Error pages
  "error.title": "Произошла ошибка",
  "error.unexpected": "Непредвиденная ошибка.",
  "error.tryAgain": "Повторить",

  // Common
  "common.cancel": "Отмена",
  "common.save": "Сохранить",
  "common.delete": "Удалить",
  "common.edit": "Редактировать",
  "common.deactivate": "Деактивировать",
  "common.activate": "Активировать",
  "common.loading": "Загрузка…",
  "common.name": "Наименование",
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
  "common.noResults": "Ничего не найдено",
  "common.backToBookings": "К бронированиям",
  "common.editBooking": "Edit Booking",
};
```

---

## Шаг 3 — Создать `apps/web/src/lib/i18n/index.ts`

```typescript
import { en, type DictionaryKey } from "./locales/en";
import { ru } from "./locales/ru";

export type Locale = "en" | "ru";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "ru", label: "RU" },
];

export const DEFAULT_LOCALE: Locale = "en";

const dictionaries: Record<Locale, typeof en> = { en, ru };

export function getDict(locale: Locale): typeof en {
  return dictionaries[locale] ?? en;
}

// Для Server Components: читает cookie из next/headers
// Импортируй только в Server Components (файлы без "use client")
export async function getLocale(): Promise<Locale> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const value = jar.get("locale")?.value;
  return (value === "ru" || value === "en") ? value : DEFAULT_LOCALE;
}

// Для Client Components: читает cookie из document
export function getLocaleClient(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
  const value = match?.[1];
  return (value === "ru" || value === "en") ? value : DEFAULT_LOCALE;
}

// t() для Server Components (используй с await getLocale())
export function t(
  dict: typeof en,
  key: DictionaryKey,
  params?: Record<string, string | number>,
): string {
  let text: string = dict[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

// Русское склонение: plural(3, "гость", "гостя", "гостей") → "гостя"
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export type { DictionaryKey };
```

---

## Шаг 4 — Создать `apps/web/src/components/locale-provider.tsx`

Client Context — чтобы Client Components могли читать локаль и переключать:

```tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getDict, getLocaleClient, type Locale } from "@/lib/i18n";
import type { en } from "@/lib/i18n/locales/en";

type LocaleContextValue = {
  locale: Locale;
  dict: typeof en;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    document.cookie = `locale=${next};path=/;max-age=31536000`;
    setLocaleState(next);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, dict: getDict(locale), setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
```

---

## Шаг 5 — Обновить `apps/web/src/app/layout.tsx`

Обернуть всё приложение в `LocaleProvider`, передав locale с сервера:

```tsx
import { LocaleProvider } from "@/components/locale-provider";
import { getLocale } from "@/lib/i18n";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
```

---

## Шаг 6 — Добавить переключатель языка в navbar

В `apps/web/src/components/navbar.tsx` добавить кнопки EN / RU:

```tsx
"use client";
import { useLocale, LOCALES } from "@/lib/i18n";

// Внутри компонента navbar:
const { locale, setLocale } = useLocale();

// В JSX:
<div className="flex gap-1">
  {LOCALES.map(({ code, label }) => (
    <button
      key={code}
      onClick={() => setLocale(code)}
      className={`px-2 py-1 text-xs rounded ${
        locale === code
          ? "bg-gray-700 text-white"
          : "text-gray-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  ))}
</div>
```

---

## Шаг 7 — Паттерны использования в компонентах

### Server Component
```tsx
import { getLocale, getDict, t } from "@/lib/i18n";

export default async function DashboardPage() {
  const locale = await getLocale();
  const dict = getDict(locale);

  return <h1>{t(dict, "dashboard.title")}</h1>;
}
```

### Client Component
```tsx
"use client";
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";

export function BookingActions() {
  const { dict } = useLocale();

  return <button>{t(dict, "booking.checkIn")}</button>;
}
```

### Передача строк из Server → Client Component
```tsx
// Server Component — передаём уже переведённую строку, не dict
const locale = await getLocale();
const dict = getDict(locale);
<ClientModal title={t(dict, "booking.dirtyWarning.title")} />
```

---

## Порядок миграции файлов

| # | Файл | Примечание |
|---|------|-----------|
| 1 | `lib/i18n/locales/en.ts` | Создать |
| 2 | `lib/i18n/locales/ru.ts` | Создать |
| 3 | `lib/i18n/index.ts` | Создать |
| 4 | `components/locale-provider.tsx` | Создать |
| 5 | `app/layout.tsx` | Добавить `LocaleProvider` + `getLocale()` |
| 6 | `components/navbar.tsx` | Переключатель + перевод пунктов меню |
| 7 | `app/error.tsx` | Простой старт |
| 8 | `app/page.tsx` | Dashboard |
| 9 | `app/bookings/[id]/booking-actions.tsx` | Самый смешанный |
| 10 | `app/bookings/page.tsx` | Список |
| 11 | `app/bookings/[id]/page.tsx` | Детальная |
| 12 | `app/night-audit/page.tsx` | Большой файл |
| 13 | Остальные страницы | По очереди |

Файлы **не трогаем** (уже на одном языке или не UI):
- `apps/web/src/app/housekeeping/` — уже RU, мигрировать на EN + добавить в словарь
- `apps/api/` — бэкенд, ошибки API не локализуем

---

## Верификация после каждого шага

```bash
cd /home/oci/pms && pnpm typecheck   # все ключи t() типобезопасны
```

После всех файлов:
```bash
# Не должно быть хардкода в JSX (кроме отраслевых терминов)
grep -rn '>[A-Z][a-z]' apps/web/src/app --include="*.tsx" | grep -v "// keep" | grep -v i18n
```

Сохрани отчёт в `docs/plans/gemini/02-i18n-implementation-result.md`.
