# Канонизация бэкенда и i18n фронтенда

## Статусы фаз

| Фаза | Описание | Статус |
|---|---|---|
| 04-A | API error messages → EN + коды + i18n | ✅ DONE |
| 04-B | Folio Windows → profileId | ⏳ BLOCKED — ждать GLM (налоги) |
| 04-C | Seed data → EN | ▶️ СЕЙЧАС |
| 04-D | i18n: transaction-codes страницы | ▶️ СЕЙЧАС |
| 04-E | i18n: housekeeping страницы | ▶️ СЕЙЧАС |
| 04-F | Мелочи: rate-plan-form + error-display chrome | ▶️ СЕЙЧАС |

---

## Фаза 04-C: Seed data → English
**Файл:** `packages/db/src/seed.ts`

Заменить все кириллические строки в данных. **Структуру файла не трогать** — только строковый контент.

### Замены:

**Property (строки ~65–66):**
```
address: "Озёрный проезд, 2"  →  address: "2 Lake Drive, Kaliningrad"
city: "Калининград"           →  city: "Kaliningrad"
```

**Profiles — companies (~247–268):**
```
name: "ООО «Балтийские Линии»"   →  name: "Baltic Lines LLC"
shortName: "Балтийские Линии"    →  shortName: "Baltic Lines"
address: "г. Калининград, ул. Советская, 15"  →  address: "15 Sovetskaya St, Kaliningrad"
contactPerson: "Петрова Елена"   →  contactPerson: "Elena Petrova"

name: "АО «Запфильм»"           →  name: "Westfilm Inc."
shortName: "Запфильм"           →  shortName: "Westfilm"
address: "г. Калининград, пр. Мира, 42"  →  address: "42 Mira Ave, Kaliningrad"
contactPerson: "Сидоров Андрей"  →  contactPerson: "Andrey Sidorov"

name: "ИП Козлов В.А."          →  name: "Kozlov & Co."
shortName: "Козлов"             →  shortName: "Kozlov"
contactPerson: "Иванова Мария"   →  contactPerson: "Maria Ivanova"
```

**Packages — description (~670, 680):**
```
description: "Завтрак"  →  description: "Breakfast"
description: "Парковка" →  description: "Parking"
```

**Packages — name (~697, 707):**
```
name: "Завтрак"  →  name: "Breakfast"
name: "Парковка" →  name: "Parking"
```

**Folio transactions — description (~775–794):**
```
description: "Завтрак"  →  description: "Breakfast"
```

**Комментарии в коде (~342, 359, 392):** заменить упоминания кириллицы в комментариях на английские эквиваленты (`// Baltic Lines`, `// Westfilm`, `// Baltic Lines, TA: Baltic Travel`).

**Проверка:**
```bash
cd packages/db && npx tsc --noEmit
```

---

## Фаза 04-D: i18n — Transaction Codes страницы

### Паттерн i18n в этом проекте

**Server Component** (нет `"use client"`):
```typescript
import { getLocale, getDict, t } from "@/lib/i18n";
// внутри async функции:
const locale = await getLocale();
const dict = getDict(locale);
// использование:
t(dict, "txCodes.title")
```

**Client Component** (`"use client"`):
```typescript
import { useLocale } from "@/components/locale-provider";
import { t } from "@/lib/i18n";
// внутри компонента:
const { dict } = useLocale();
// использование:
t(dict, "txCodes.title")
```

Ключи добавляются в **оба** файла: `apps/web/src/lib/i18n/locales/en.ts` и `ru.ts`.  
Формат: плоский, snake_case с точкой (`"txCodes.title"`). `DictionaryKey = keyof typeof en` — TypeScript подхватит автоматически.

### Файл 1: `apps/web/src/app/configuration/transaction-codes/page.tsx`
Server Component. Добавить импорт getLocale/getDict/t, передать `dict` или использовать напрямую.

Новые ключи (добавить в en.ts и ru.ts):
```
"txCodes.title"          EN: "Transaction Codes"         RU: "Коды транзакций"
"txCodes.newCode"        EN: "+ New Code"                 RU: "+ Новый код"
"txCodes.empty"          EN: "No transaction codes configured."  RU: "Коды транзакций не настроены."
"txCodes.charges"        EN: "Charges ({count})"          RU: "Начисления ({count})"
"txCodes.payments"       EN: "Payments ({count})"         RU: "Оплаты ({count})"
"txCodes.colCode"        EN: "Code"                       RU: "Код"
"txCodes.colName"        EN: "Name"                       RU: "Название"
"txCodes.colGroup"       EN: "Group"                      RU: "Группа"
"txCodes.colType"        EN: "Type"                       RU: "Тип"
"txCodes.edit"           EN: "Edit"                       RU: "Изменить"
```

Для `"txCodes.charges"` и `"txCodes.payments"` используй `t(dict, "txCodes.charges", { count: chargeCodes.length })`.

### Файл 2: `apps/web/src/app/configuration/transaction-codes/transaction-code-form.tsx`
Client Component. Добавить `useLocale` + `t`.

Новые ключи:
```
"txCodes.form.labelCode"        EN: "Code *"                   RU: "Код *"
"txCodes.form.labelSortOrder"   EN: "Sort Order"               RU: "Порядок сортировки"
"txCodes.form.labelDescription" EN: "Description *"            RU: "Описание *"
"txCodes.form.placeholderDesc"  EN: "Room Charge"              RU: "Проживание"
"txCodes.form.labelType"        EN: "Type *"                   RU: "Тип *"
"txCodes.form.typeCharge"       EN: "Charge"                   RU: "Начисление"
"txCodes.form.typePayment"      EN: "Payment"                  RU: "Оплата"
"txCodes.form.labelGroup"       EN: "Group *"                  RU: "Группа *"
"txCodes.form.allowManual"      EN: "Allow manual posting"     RU: "Разрешить ручное начисление"
"txCodes.form.isActive"         EN: "Active"                   RU: "Активен"
"txCodes.form.saving"           EN: "Saving…"                  RU: "Сохранение..."
"txCodes.form.create"           EN: "Create"                   RU: "Создать"
"txCodes.form.update"           EN: "Update"                   RU: "Обновить"
"txCodes.form.cancel"           EN: "Cancel"                   RU: "Отмена"
"txCodes.form.saveError"        EN: "Failed to save"           RU: "Ошибка сохранения"
```

Замени `<a href="...">Отмена</a>` на `<Link href="...">` (уже есть импорт Link в соседних файлах).

**Проверка:**
```bash
cd apps/web && npx tsc --noEmit
```

---

## Фаза 04-E: i18n — Housekeeping страницы

### Файл 1: `apps/web/src/app/housekeeping/housekeeping-client.tsx`
Client Component. Добавить `useLocale` + `t`. Заменить захардкоженные объекты-словари на i18n.

Новые ключи:
```
"hk.taskType.checkout_clean"   EN: "Checkout Clean"           RU: "Уборка (выезд)"
"hk.taskType.stayover_clean"   EN: "Stayover Clean"           RU: "Уборка (проживание)"
"hk.taskType.inspection"       EN: "Inspection"               RU: "Инспекция"
"hk.taskType.deep_clean"       EN: "Deep Clean"               RU: "Генеральная уборка"
"hk.taskType.turndown"         EN: "Turndown"                 RU: "Вечерняя уборка"

"hk.status.pending"            EN: "Pending"                  RU: "Ожидает"
"hk.status.in_progress"        EN: "In Progress"              RU: "В процессе"
"hk.status.completed"          EN: "Completed"                RU: "Завершено"
"hk.status.skipped"            EN: "Skipped"                  RU: "Пропущено"

"hk.filterAllStatuses"         EN: "All statuses"             RU: "Все статусы"
"hk.filterByMaid"              EN: "Filter by attendant…"     RU: "Фильтр по горничной..."
"hk.generateBtn"               EN: "Generate today's tasks"   RU: "Сгенерировать задания на сегодня"
"hk.generating"                EN: "Generating…"              RU: "Генерация..."
"hk.generated"                 EN: "Tasks generated: {count}" RU: "Сгенерировано заданий: {count}"
"hk.emptyNoTasks"              EN: "No housekeeping tasks for today. Click Generate."  RU: "На текущую дату нет заданий по уборке. Нажмите «Сгенерировать»."
"hk.emptyFiltered"             EN: "No tasks match the current filters."  RU: "Нет заданий, подходящих под фильтры."
"hk.floor"                     EN: "Floor {floor}"            RU: "Этаж {floor}"
"hk.floorNone"                 EN: "No floor"                 RU: "Без этажа"
"hk.tasks"                     EN: "{count} tasks"            RU: "{count} заданий"
"hk.assignMaid"                EN: "Assign attendant:"        RU: "Назначить горничную:"
"hk.maidPlaceholder"           EN: "Attendant name…"          RU: "Имя горничной..."
"hk.actionStart"               EN: "Start"                    RU: "Начать"
"hk.actionDone"                EN: "Done"                     RU: "Готово"
"hk.actionSkip"                EN: "Skip"                     RU: "Пропустить"
```

Важно: `TASK_TYPE_LABELS` и `STATUS_LABELS` — замени на вызовы `t(dict, ...)` вместо object lookup.  
`"Без этажа"` используется как ключ в `tasksByFloor` для сортировки — замени строку на константу `NO_FLOOR = "no_floor"` и переводи при отображении через `t(dict, "hk.floorNone")`.  
`alert(...)` — замени на `t(dict, "hk.generated", { count: data.created })`.

### Файл 2: `apps/web/src/app/housekeeping/page.tsx`
Server Component.

Новые ключи:
```
"hk.title"              EN: "Housekeeping"                     RU: "Хаускипинг"
"hk.titleWithDate"      EN: "Housekeeping — {date}"           RU: "Хаускипинг — {date}"
"hk.subtitle"           EN: "Manage housekeeping tasks"       RU: "Управление заданиями на уборку"
"hk.noProperty"         EN: "Property not found"              RU: "Свойство не найдено"
```

**Проверка:**
```bash
cd apps/web && npx tsc --noEmit
```

---

## Фаза 04-F: Мелочи

### `apps/web/src/app/configuration/rate-plans/rate-plan-form.tsx`
Одна строка (~141):
```tsx
// Было:
<span className="text-gray-500">(выбирается по умолчанию при создании брони)</span>

// Стало (добавить ключ "ratePlan.defaultHint"):
<span className="text-gray-500">{t(dict, "ratePlan.defaultHint")}</span>
```
```
"ratePlan.defaultHint"  EN: "(selected by default when creating a booking)"  RU: "(выбирается по умолчанию при создании брони)"
```
Файл — Client Component, `useLocale` добавить.

### `apps/web/src/components/error-display.tsx`
Три строки UI-хрома (строки ~89, 100):
```tsx
// Было:
"Скрыть детали" / "Техническая информация"
"Скопировать для техподдержки"

// Стало:
t(dict, "error.hideDetails") / t(dict, "error.technicalInfo")
t(dict, "error.copyForSupport")
```
```
"error.hideDetails"     EN: "Hide details"            RU: "Скрыть детали"
"error.technicalInfo"   EN: "Technical information"   RU: "Техническая информация"
"error.copyForSupport"  EN: "Copy for support"        RU: "Скопировать для техподдержки"
```
`useLocale` уже импортирован в этом файле — просто добавить ключи и заменить строки.

**Проверка:**
```bash
cd apps/web && npx tsc --noEmit
```

---

## Итоговый порядок выполнения

1. **04-C** (seed.ts) — только данные, ноль риска конфликтов
2. **04-D** (transaction-codes) — только web
3. **04-E** (housekeeping) — только web
4. **04-F** (мелочи) — только web
5. **04-B** (folio windows) — **ПОСЛЕ** завершения GLM по налогам

## Отчёт

Сохрани результат в `docs/plans/gemini/04-result.md`:
- список изменённых файлов
- новые i18n ключи (сколько добавлено)
- результат `tsc --noEmit`
