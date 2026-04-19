# Gemini CLI — i18n Research Prompt

> Запускается из корня проекта: `/home/oci/pms`
> Задача: независимое исследование смешения языков в UI, без подсказок

---

## Промт

```
Ты исследуешь open-source PMS (Property Management System) на Next.js 16 + React 19 + TypeScript.
Монорепо: pnpm + Turborepo. UI — в apps/web/src/.

Проблема: в интерфейсе смешаны русский и английский языки. Нужно исследовать масштаб проблемы
и предложить решение.

ШАГ 1 — Изучи структуру:

  ls apps/web/src/app/
  ls apps/web/src/components/
  cat apps/web/package.json | grep -E '"(next-intl|i18next|react-i18next|lingui|rosetta)"'

ШАГ 2 — Прочитай ключевые файлы целиком:

  cat apps/web/src/components/navbar.tsx
  cat apps/web/src/app/page.tsx
  cat apps/web/src/app/bookings/[id]/booking-actions.tsx
  cat apps/web/src/app/night-audit/page.tsx
  cat apps/web/src/app/error.tsx

ШАГ 3 — Быстрый grep по остальным:

  grep -rn '"[A-Z][a-z]' apps/web/src/app/ --include="*.tsx" -l
  grep -rn '[а-яёА-ЯЁ]' apps/web/src/app/ --include="*.tsx" -l

ШАГ 4 — Подготовь результат в виде Markdown-документа со следующими разделами:

  ## 1. Есть ли i18n-библиотека?
  (да/нет + что найдено)

  ## 2. Инвентаризация строк
  Таблица: файл | строка | текст | язык | рекомендация (→RU / →KEEP / ок)
  Отраслевые термины, которые НЕ переводим: Check In, Check Out, Night Audit,
  Tape Chart, Due In, Due Out, In-House, No Show, Folio, OOO/OOS.

  ## 3. Стратегия
  - Нужна ли внешняя библиотека (next-intl, i18next) или достаточно простого словаря?
  - Обоснование выбора.
  - Архитектура решения (1-2 абзаца + пример кода).

  ## 4. Порядок миграции
  Таблица файлов по приоритету: файл | кол-во строк | сложность.

  ## 5. Пример до/после
  Возьми один реальный компонент из кода и покажи конкретный diff.

  ## 6. Риски
  Что может пойти не так, на что обратить внимание.

Сохрани результат в файл: docs/plans/gemini/01-i18n-research-result.md
```
