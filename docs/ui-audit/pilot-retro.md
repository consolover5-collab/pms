# UI Audit Pilot — Retrospective

**Дата:** 2026-04-21
**Секция:** 03 — Создание бронирования (`/bookings/new`)
**Branch:** `feat/design-system`
**App commit:** `98fbc439cca280b14d4f1d95e182c3e06ecf835c`
**Результат:** `ok` — 12/12 тестов зелёные (6 сценариев × 2 локали), 24 скриншота, багов не найдено.

## Что работало по плану

- Архитектура `tools/ui-audit/` (pnpm workspace + Playwright + 2 locale projects) встаёт с нуля без сюрпризов.
- Набор сценариев (empty-submit, happy-path, checkout-before-checkin, room-unavailable, inline-new-guest, rate-plan-auto-rate) покрывает обязательные поля, клиентскую валидацию, серверное отклонение и автоподстановку цены. Этот паттерн обобщается на остальные CRUD-секции.
- JSON-сайдкар с console/network/api-вызовами, записанный в `audit-data/` (вне `test-results/`, который Playwright чистит между проектами), переносит ошибки между RU- и EN-ранами и выступает источником для блоков YAML.
- YAML-отчёт получается детерминированным: порядок шагов совпадает с порядком скриншотов, список API-вызовов — из JSON-сайдкара, валидация `status: ok` очевидна.

## Что пришлось корректировать относительно плана

### 1. API endpoints и фикстуры не совпадают с документом плана

| План | Реально в коде |
|---|---|
| `GET /api/business-dates` | `GET /api/business-date` (singular) |
| `GET /api/profiles?type=guest` | `GET /api/profiles?propertyId=…&type=individual` (типы: individual/company/travel_agent/source/contact) |
| `jq '.length'` по `/api/profiles` | ответ paginated: `{ data, total }`, считать через `.total` |

**Урок:** перед full-run проверять каждый endpoint, перечисленный в плане, через `curl`/чтение `apps/api/src/routes/*`. Лучше включить в pre-flight автоматическую проверку списка endpoints, чтобы такие расхождения отлавливались до запуска spec.

### 2. Auth re-enabled на `feat/design-system`

План был написан для состояния, где BUG-001 (auth disable) ещё действовал — отсюда отсутствие логина в фикстурах. На `feat/design-system` login обязателен (cookie `pms_session`), иначе `/bookings/new` редиректит на `/login`. Фикс: сценарный `loginAsAdmin()` через `POST /api/auth/login` (admin/admin123 из `seed.ts`) **до** любого `page.goto`.

**Урок:** в full-run включить общий `loginAsAdmin()` в `setLocaleAndGoto()` на уровне `fixtures.ts`. Это инвариант для всех аутентифицированных секций.

### 3. Сборка Next.js не подхватывается автоматически

После переключения на `feat/design-system` я перезапустил `next start :3000`, но без `pnpm build` сервер продолжал отдавать старый `.next/` от предыдущей ветки. Пользователь заметил это на первых скриншотах ("старый UI"). После `pnpm build` (новый `BUILD_ID`) + restart — правильный design-system UI.

**Урок:** pre-flight обязан выполнять **`pnpm build`** (не просто `next start`) после любого переключения веток и логировать свежий `BUILD_ID`. Скриншоты без свежей сборки бесполезны.

### 4. Playwright strict mode на CSS-псевдоселекторах

`input[type="date"]:nth-of-type(1)` матчит оба date-input'а (каждый первый-of-type внутри своего `<div>`). Перешёл на `page.locator('input[type="date"]').nth(N)`.

**Урок:** для нативных инпутов использовать `.nth()` от общего локатора, не CSS-псевдоселекторы.

### 5. React-контролируемые `<input type="date">` не принимают `page.fill()`

Values откатываются setState'ом React. Решение — setter через прототип + ручной dispatch `input`+`change`:
```ts
const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
setter?.call(el, val);
el.dispatchEvent(new Event('input', { bubbles: true }));
el.dispatchEvent(new Event('change', { bubbles: true }));
```
Подойдёт для любых React-controlled нативных инпутов — можно вынести в `src/shared.ts` как `setNativeValue()` helper.

### 6. Фикстура данных на минимуме

Per план использовал `profile.type=individual` + `force=true` для `POST /api/profiles`. Works. Для сценариев со специфичными номерами / тарифами хардкожу UUID (рум `6762e1df…` OOS, room-type `e8f25fcd…` Standard Double, rate plan PROMO `28d39f1c…`). Эти UUID стабильны в seed — не ломается между прогонами.

**Урок:** держать справочную таблицу seed-UUID в `tools/ui-audit/src/seed-refs.ts` (единое место, не по файлам spec'ов).

## Рекомендации для full-run (перед новым планом)

1. **Зашить в `setLocaleAndGoto`** login + cookie + goto. Одна helper-функция на всю папку.
2. **`setNativeValue`** в `src/shared.ts` для React-controlled инпутов.
3. **`src/seed-refs.ts`** — карта UUID (property/rooms/room-types/rate-plans/profiles).
4. **Pre-flight API-probe** — пробегать по списку endpoints из плана, валидировать 200-ответы, проверять поле `total` у paginated-endpoints. Блокировать запуск spec'ов при расхождениях.
5. **Build-gate** — pre-flight обязан выполнить `pnpm build` и залогировать `BUILD_ID`. YAML-отчёты писать `app_commit` + `build_id`.
6. **errors.json писать в `audit-data/`** (вне `outputDir`). Уже применено — оставить.
7. **Генерация `index.yml` totals** через `scripts/aggregate.ts` вместо ручной правки, чтобы избежать дрейфа между feature-файлами и индексом.

## Сколько ушло времени (ориентир для full-run оценки)

- Scaffold + pre-flight: ~15 мин
- Чтение UI/i18n + составление сценариев: ~20 мин
- Написание spec + итерации (auth fix, date input fix, errors.json fix): ~45 мин
- Заполнение YAML + help hints + index + retro: ~15 мин

Итого ~1.5ч на одну «чистую» секцию без настоящих багов. Full-run × 24 секции — заранее брать минимум 40–60ч при текущем подходе; большинство экономии — от обобщённых helper'ов (пункты 1–5).

## Статус

Пилот завершён. Ждём ревью пользователя перед тем, как писать отдельный план для full-run (24 секции).
