# Отчет по исследованию i18n (Смешение языков в UI)

## 1. Есть ли i18n-библиотека?
**Нет.**
В `apps/web/package.json` отсутствуют популярные библиотеки для интернационализации, такие как `next-intl`, `i18next`, `react-i18next`, `lingui` или `rosetta`. Сейчас строки захардкожены прямо в компонентах, иногда используется дублирование свойств (например, `label` и `labelRu` в `navbar.tsx`), а также смешение английских и русских текстов непосредственно в JSX.

## 2. Инвентаризация строк (Примеры)

| Файл | Строка/Текст | Язык | Рекомендация |
|---|---|---|---|
| `navbar.tsx` | `"Дашборд"` | RU | → RU |
| `navbar.tsx` | `"Выйти"` | RU | → RU |
| `page.tsx` (Dashboard) | `"Dashboard"` | EN | → RU (Дашборд) |
| `page.tsx` (Dashboard) | `"Occupied"`, `"Vacant"`, `"Dirty"` | EN | → RU (Занято, Свободно, Грязный) |
| `page.tsx` (Dashboard) | `"Due In"`, `"Due Out"`, `"In-House"` | EN | → KEEP (Отраслевые термины) |
| `booking-actions.tsx` | `"Сменить комнату"` | RU | → RU |
| `booking-actions.tsx` | `"Cancel Check-in"` | EN | → RU (Отменить заезд) / KEEP (Check In) |
| `booking-actions.tsx` | `"Check In"`, `"Check Out"` | EN | → KEEP (Отраслевые термины) |
| `night-audit/page.tsx` | `"Night Audit"`, `"No Show"` | EN | → KEEP (Отраслевые термины) |
| `night-audit/page.tsx` | `"Просрочен выезд:"` | RU | → RU |
| `night-audit/page.tsx` | `"Rooms to charge:"` | EN | → RU (Начисления за номера:) |
| `error.tsx` | `"Something went wrong"` | EN | → RU (Что-то пошло не так) |
| `error.tsx` | `"Try again"` | EN | → RU (Попробовать снова) |

*Примечание: отраслевые термины (Check In, Check Out, Night Audit, Tape Chart, Due In, Due Out, In-House, No Show, Folio, OOO/OOS) остаются на английском.*

## 3. Стратегия

**Выбор:** Для текущего MVP и монорепозитория на базе Next.js 16 (App Router) **достаточно простого словаря (Dictionary)**. Внедрение тяжелых библиотек вроде `next-intl` или `i18next` избыточно, так как проект на данный момент ориентирован на фиксированную локаль (русский язык с вкраплениями профессиональных английских терминов). Если в будущем потребуется полноценная мультиязычность (например, переключение RU/EN пользователем), простую систему словарей легко мигрировать на `next-intl`.

**Архитектура решения:**
1. Создаем директорию `apps/web/src/dictionaries/` с файлом `ru.ts`, содержащим объект со всеми строками интерфейса.
2. Для серверных компонентов (RSC) импортируем словарь напрямую.
3. Для клиентских компонентов (Client Components) создаем хук `useTranslation` через React Context или просто импортируем константу словаря, если язык пока один.
4. Выносим форматирование дат и валют в общие утилиты `lib/format.ts` с жесткой привязкой к локали `ru-RU`.

```typescript
// apps/web/src/dictionaries/ru.ts
export const dict = {
  dashboard: {
    title: "Дашборд",
    vacant: "Свободно",
    occupied: "Занято",
    dueIn: "Due In", // Отраслевой термин
    // ...
  },
  actions: {
    checkIn: "Check In",
    cancel: "Отмена",
  }
};
```

## 4. Порядок миграции

Миграцию следует проводить покомпонентно, начиная с глобальных элементов и заканчивая внутренними страницами.

| Приоритет | Файл / Директория | Оценка кол-ва строк | Сложность |
|---|---|---|---|
| 1 | `apps/web/src/components/navbar.tsx` | ~20 | Низкая |
| 2 | `apps/web/src/app/error.tsx`, `layout.tsx` | ~5 | Низкая |
| 3 | `apps/web/src/app/page.tsx` (Dashboard) | ~40 | Средняя |
| 4 | `apps/web/src/app/bookings/**/*` | ~60 | Высокая (Много бизнес-логики) |
| 5 | `apps/web/src/app/night-audit/**/*` | ~50 | Высокая |
| 6 | `apps/web/src/app/rooms/**/*` | ~40 | Средняя |
| 7 | Остальные директории (`guests`, `housekeeping` и т.д.) | ~100+ | Выше среднего |

## 5. Пример до/после

Возьмем глобальный компонент ошибки `error.tsx`.

**До:**
```tsx
"use client";

export default function GlobalError({ error, reset }: { error: Error, reset: () => void }) {
  return (
    <main className="p-8 max-w-xl mx-auto mt-20">
      <div className="border-2 border-red-300 bg-red-50 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-800 mb-2">
          Something went wrong
        </h2>
        <p className="text-red-700 mb-4">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
```

**После:**
```tsx
"use client";
import { dict } from "@/dictionaries/ru";

export default function GlobalError({ error, reset }: { error: Error, reset: () => void }) {
  const t = dict.errors;

  return (
    <main className="p-8 max-w-xl mx-auto mt-20">
      <div className="border-2 border-red-300 bg-red-50 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-800 mb-2">
          {t.somethingWentWrong}
        </h2>
        <p className="text-red-700 mb-4">
          {error.message || t.unexpectedError}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          {t.tryAgain}
        </button>
      </div>
    </main>
  );
}
```

## 6. Риски
- **Случайный перевод отраслевых терминов:** Важно жестко закрепить в правилах линтинга или код-ревью, что термины типа *Check In*, *Check Out*, *Folio*, *Night Audit* и *OOO/OOS* переводу не подлежат.
- **Внедрение словаря в Server Components (RSC):** Нужно следить за тем, чтобы не передавать функции из словарей в клиентские компоненты из серверных, а передавать только строки (сериализуемые данные).
- **Форматирование:** Различные компоненты могут по-своему форматировать даты и валюты. Обязательна унификация через `Intl.DateTimeFormat` и `Intl.NumberFormat` с привязкой к русской локали.
- **Сложные конструкции с плюрализацией:** Если в будущем появится потребность в плюрализации (например, "1 гость", "2 гостя", "5 гостей"), простой словарь без логики не справится и потребуется написать небольшую утилиту-хелпер или всё же внедрить библиотеку `next-intl`.