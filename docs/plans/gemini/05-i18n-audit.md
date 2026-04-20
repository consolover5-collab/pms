# Промт для Gemini: аудит оставшихся русских строк в web-приложении

## Контекст

Проект: PMS, монорепо. Фронтенд: `apps/web/` (Next.js App Router, React).

i18n-система: плоский словарь `apps/web/src/lib/i18n/locales/en.ts` и `ru.ts`.  
`DictionaryKey = keyof typeof en` — TypeScript проверяет все ключи автоматически.

Паттерн использования:
- Client Component: `useLocale()` → `const { dict } = useLocale()` → `t(dict, "key")`
- Server Component: `await getLocale()` → `getDict(locale)` → `t(dict, "key")`

Ранее уже переведены: housekeeping, transaction-codes, error-display, rate-plan-form, night-audit (частично), booking-actions (частично).

## Задача — только исследование, ничего не менять

Найди все файлы в `apps/web/src/` (`.tsx`, `.ts`), содержащие кириллические символы в пользовательских строках UI.

### Исключи из проверки:
- `apps/web/src/lib/i18n/locales/ru.ts` — это сам словарь, кириллица там обязательна
- `apps/web/src/lib/i18n/locales/en.ts` — нет кириллицы, но для справки
- `apps/web/src/lib/i18n/index.ts` — комментарии разработчика
- `apps/web/src/app/help/` — справочный контент, переводить не нужно
- Комментарии в коде (`//`, `/* */`) — не считать

### Для каждого файла с кириллицей выведи:
1. Путь к файлу
2. Тип компонента: Server или Client (`"use client"` в начале?)
3. Количество строк с кириллицей в UI
4. Сами строки (кратко, без номеров строк)

### Дополнительно проверь паритет словарей:
- Есть ли ключи в `en.ts`, которых нет в `ru.ts` (и наоборот)?
- Если да — перечисли их

## Формат отчёта

Сохрани результат в `docs/plans/gemini/05-i18n-audit-result.md`:

```
## Файлы с кириллицей в UI

### apps/web/src/app/...
- Тип: Client / Server
- Строк: N
- Строки: "...", "...", "..."

...

## Паритет словарей

Ключи только в en.ts: ...
Ключи только в ru.ts: ...

## Итог

Всего файлов: N
Всего строк кириллицы в UI: N
```
