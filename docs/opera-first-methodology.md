# Opera-First Development Methodology

> Этот документ описывает обязательный процесс исследования перед реализацией любой бизнес-логики в проекте PMS.
>
> **Принцип:** Этот проект — упрощённая open-source замена Oracle Opera PMS V5. Любая бизнес-логика должна коррелировать с Opera, даже если реализация проще.

---

## Зачем это нужно

Opera PMS — 30 лет production-опыта в тысячах отелей. Каждое бизнес-правило в ней выстрадано реальными операционными ошибками. Если мы придумываем логику с нуля, мы неизбежно повторяем те же ошибки.

Задача этого процесса — взять готовые решения Opera, убрать лишнее (vendor lock-in, избыточность, устаревшие паттерны) и сохранить суть.

---

## Источники истины

### 1. Oracle Opera DB (через MCP)
Живая база реального отеля HA336 (Mercure Kalининград, 167 комнат, 135K броней).

```bash
# Доступ через MCP инструменты:
mcp__opera__query         — выполнить SQL SELECT
mcp__opera__describe_table — структура таблицы
mcp__opera__search_columns — найти колонку по имени
mcp__opera__distinct_values — реальные значения enum/code поля
mcp__opera__sample_data   — примеры строк
mcp__opera__foreign_keys  — связи между таблицами
```

**Ключевые таблицы Opera:**

| Наш модуль | Opera таблица | Что содержит |
|------------|---------------|--------------|
| bookings | `RESERVATION_NAME` | Основная запись брони |
| bookings (per-night) | `RESERVATION_DAILY_ELEMENTS` | Данные за каждую ночь (rate, room, market) |
| rooms | `ROOM` | Статусы, OOO даты, HK секции |
| guests | `NAME` | Профиль гостя/компании |
| folio transactions | `FINANCIAL_TRANSACTIONS` | Все проводки фолио |
| transaction codes | `TRANSACTION_CODES` | Справочник кодов транзакций |
| rate plans | `RATE_CODE_HEADER` | Тарифные планы |
| room types | `ROOM_CATEGORY` | Категории комнат |
| business date | `RESORT` (поле `business_date`) | Текущая бизнес-дата отеля |

### 2. Oracle Help Center (docs.oracle.com)
Официальная документация Opera PMS с описанием бизнес-правил.

**Полезные разделы:**
- Opera 5.x: `https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/`
- Opera Cloud: `https://docs.oracle.com/en/industries/hospitality/opera-cloud/`

**Поиск:** `site:docs.oracle.com opera [feature name]`

### 3. Код проекта
Текущая реализация — для сравнения с Opera.

---

## Процесс: 4 шага перед реализацией

### Шаг 1 — Изучить Opera DB

Для каждой новой фичи:

```sql
-- 1. Найти релевантные таблицы
SELECT table_name FROM all_tables
WHERE owner = 'OPERA1' AND table_name LIKE '%RESERV%';

-- 2. Изучить структуру
DESCRIBE opera1.reservation_name;

-- 3. Посмотреть реальные значения enum-полей
SELECT DISTINCT status, COUNT(*) FROM opera1.reservation_name
WHERE resort = 'HA336' GROUP BY status ORDER BY 2 DESC;

-- 4. Изучить FK и связи
-- (через mcp__opera__foreign_keys)

-- 5. Посмотреть примеры данных
-- (через mcp__opera__sample_data)
```

**Что искать:**
- Какие поля есть в Opera, которых нет у нас
- Какие enum-значения реально используются в HA336
- Как Opera хранит даты/суммы/статусы
- Есть ли per-night / per-room breakdown (часто Opera хранит данные детальнее)

### Шаг 2 — Прочитать официальную документацию

Для каждой фичи найти соответствующий раздел в Oracle Help Center:

```
Пример: "OOO rooms"
→ https://docs.oracle.com/cd/E98457_01/opera_5_6_core_help/out_of_order_service_hsk_ooo.htm

Пример: "No-show processing"
→ docs.oracle.com → search "no show posting rules"
```

**Что искать:**
- Точные бизнес-правила ("It is not possible to...")
- Порядок шагов в операции
- Условия и исключения
- Разница между похожими концептами (OOO vs OOS, FOLIO_NO vs FOLIO_VIEW)

### Шаг 3 — Сверить с нашей схемой

```bash
# Прочитать нашу схему
cat /home/oci/pms/packages/db/src/schema/bookings.ts
cat /home/oci/pms/apps/api/src/routes/bookings.ts
```

Составить таблицу расхождений:

| Opera | У нас | Severity | Действие |
|-------|-------|----------|----------|
| `GUARANTEE_CODE` | нет | CRITICAL | Добавить |
| `MARKET_CODE` per-night | `marketCode` per-booking | MINOR | OK для MVP, добавить комментарий |
| OOO проверяет брони | нет | CRITICAL | Добавить валидацию |

### Шаг 4 — Принять решение об упрощении

**Правило упрощения:**
- Если функция напрямую влияет на корректность операций (check-in, check-out, ночной аудит, фолио) — реализуем максимально близко к Opera
- Если функция аналитическая или отчётная (market codes, VIP levels) — упрощаем или откладываем
- Если функция требует нового модуля (groups, allotments, packages) — в backlog, не в MVP

---

## Чеклист перед каждой задачей

```
[ ] Прочитал код текущей реализации (если есть)
[ ] Нашёл Opera таблицу(ы) для этого модуля
[ ] Изучил структуру таблицы (describe_table)
[ ] Посмотрел реальные данные HA336 (distinct_values, sample_data)
[ ] Прочитал документацию Oracle Help Center по этой фиче
[ ] Составил таблицу расхождений Opera vs нас
[ ] Решил что упрощаем, что реализуем точно, что откладываем
[ ] Добавил комментарии в схему/код о намеренных упрощениях
```

---

## Допустимые упрощения (MVP)

Эти отличия от Opera осознанны и задокументированы:

| Что | Opera | У нас | Обоснование |
|-----|-------|-------|-------------|
| Market/Source code | Per-night (RESERVATION_DAILY_ELEMENTS) | Per-booking | MVP: нет посуточного breakdown |
| Folio document number | FOLIO_NO (sequential) + FOLIO_VIEW (window) | Только folioWindow | MVP: нет печати счетов |
| Guarantee code values | Короткие коды (GCC, NON, GRD...) | Descriptive strings | Читаемость в open-source |
| No-show posting rules | Конфигурируемые правила по reservation type + source | Ручное решение оператора | MVP: нет автопостинга |
| Sharers | SHARE_SEQ_NO, MASTER_SHARE | Нет | MVP: один гость на бронь |
| Allotments/Groups | ALLOTMENT_HEADER_ID, BLOCK_ID | Нет | Вне MVP scope |
| Net/Gross amounts | NET_AMOUNT + GROSS_AMOUNT на транзакцию | Отдельные строки ROOM + ROOM_TAX | Эквивалентно, разный формат |

---

## Что НЕ упрощаем

Эти аспекты реализуются строго по логике Opera:

- **Статус-машина бронирования** — confirmed → checked_in → checked_out (с точными правилами переходов)
- **OOO/OOS логика** — нельзя на занятую/забронированную, ночной аудит восстанавливает
- **Ночной аудит** — порядок шагов, идемпотентность, атомарность
- **Фолио** — append-only, нет UPDATE/DELETE транзакций
- **Бизнес-дата** — все операции относительно открытой бизнес-даты, не системной
- **Guarantee code** — влияет на no-show информацию
- **OOO проверки** — нельзя бронировать занятую OOO комнату, нельзя ставить OOO на забронированный период

---

## Формат документирования расхождений

При обнаружении расхождения — фиксируй в коде:

```typescript
/**
 * @opera GUARANTEE_CODE на RESERVATION_NAME (VARCHAR2 20)
 * Значения: GCC, NON, GCO, GRD, GRT, DEP, INQ, ALL
 * MVP упрощение: используем descriptive strings вместо Opera кодов
 * Маппинг: cc_guaranteed=GCC, company_guaranteed=GCO,
 *           deposit_guaranteed=GRD, non_guaranteed=NON,
 *           travel_agent_guaranteed=GRT
 */
guaranteeCode: varchar("guarantee_code", { length: 30 }),
```

---

## Связанные документы

- `docs/project-context.md` — 52 правила для AI агентов
- `docs/plans/2026-02-19-opera-alignment.md` — текущий план доработок
- `docs/opera-retrospective.md` — полный ретроспективный анализ (генерируется)
- `_bmad-output/project-context.md` — копия project-context для BMAD

---

*Последнее обновление: 2026-02-19. Этот документ обновляется при изменении методологии или обнаружении новых паттернов.*
