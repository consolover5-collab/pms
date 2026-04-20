# Промт для Gemini: i18n — оставшиеся русские строки

## Контекст

Проект: PMS, `apps/web/`. i18n-система:
- Словари: `apps/web/src/lib/i18n/locales/en.ts` и `ru.ts`. Плоские, snake_case с точкой.
- `DictionaryKey = keyof typeof en` — TypeScript проверяет все ключи автоматически.
- **Client Component**: `import { useLocale } from "@/components/locale-provider"` → `const { dict } = useLocale()` → `t(dict, "key")`
- **Server Component**: `import { getLocale, getDict, t } from "@/lib/i18n"` → `const locale = await getLocale(); const dict = getDict(locale);` → `t(dict, "key")`

Новые ключи добавлять ВСЕГДА в оба файла: `en.ts` и `ru.ts`.

---

## Файлы и задачи

### 1. `apps/web/src/app/bookings/date-filter.tsx` — Client, 6 строк

Добавить `useLocale` и заменить:
```
"Даты:"                → t(dict, "dateFilter.label")
"Применить"            → t(dict, "dateFilter.apply")
"Сегодня"              → t(dict, "dateFilter.today")
"Неделя"               → t(dict, "dateFilter.week")
"Месяц"                → t(dict, "dateFilter.month")
"Сбросить"             → t(dict, "dateFilter.reset")
```
Ключи en/ru:
```
"dateFilter.label"  EN:"Dates:"     RU:"Даты:"
"dateFilter.apply"  EN:"Apply"      RU:"Применить"
"dateFilter.today"  EN:"Today"      RU:"Сегодня"
"dateFilter.week"   EN:"Week"       RU:"Неделя"
"dateFilter.month"  EN:"Month"      RU:"Месяц"
"dateFilter.reset"  EN:"Reset"      RU:"Сбросить"
```

---

### 2. `apps/web/src/app/bookings/page.tsx` — Server, 2 строки

Добавить `getLocale`/`getDict`/`t`:
```
"Заселён сегодня"   → t(dict, "bookings.checkedInToday")
"Выехал сегодня"    → t(dict, "bookings.checkedOutToday")
```
Ключи:
```
"bookings.checkedInToday"   EN:"Checked in today"   RU:"Заселён сегодня"
"bookings.checkedOutToday"  EN:"Checked out today"  RU:"Выехал сегодня"
```

---

### 3. `apps/web/src/app/bookings/[id]/page.tsx` — Server, 2 строки

```
"Расч. сумма"   → t(dict, "booking.estAmount")
"Гарантия"      → t(dict, "booking.guarantee")  (уже может быть в словаре — проверь)
```
Ключи:
```
"booking.estAmount"   EN:"Est. Amount"   RU:"Расч. сумма"
"booking.guarantee"   EN:"Guarantee"     RU:"Гарантия"
```

---

### 4. `apps/web/src/app/bookings/[id]/folio-section.tsx` — Client, 1 строка

```
"Выберите код и укажите сумму больше 0"  → t(dict, "folio.validationError")
```
Ключи:
```
"folio.validationError"  EN:"Select a code and enter an amount greater than 0"  RU:"Выберите код и укажите сумму больше 0"
```

---

### 5. `apps/web/src/app/bookings/[id]/booking-actions.tsx` — Client, 1 строка

Строка: `` `№{r.roomNumber}{r.floor ? ` · эт.${r.floor}` : ""} · ...` ``

Заменить `· эт.` на `· fl.` (просто заменить строку, ключ не нужен — это форматирование):
```tsx
// Было:
` · эт.${r.floor}`
// Стало:
` · fl.${r.floor}`
```

---

### 6. `apps/web/src/app/configuration/guarantee-codes/page.tsx` — Server, 16 строк

Самый крупный файл. Добавить `getLocale`/`getDict`/`t`.

Ключи:
```
"guaranteeCodes.title"        EN:"Guarantee Codes"         RU:"Коды гарантии"
"guaranteeCodes.subtitle"     EN:"Guarantee codes define how a booking is secured and affect no-show and cancellation handling."
                               RU:"Код гарантии определяет чем обеспечена бронь и влияет на обработку no-show и отмены бронирования."
"guaranteeCodes.colCode"      EN:"Code"        RU:"Код"
"guaranteeCodes.colName"      EN:"Name"        RU:"Название"
"guaranteeCodes.colDesc"      EN:"Description" RU:"Описание"

"gc.cc.label"    EN:"Credit Card Guarantee"    RU:"Гарантия кредитной картой"
"gc.cc.desc"     EN:"Booking is secured by guest's credit card. No-show may result in a charge."
                  RU:"Бронь обеспечена кредитной картой гостя. При no-show возможно списание с карты."
"gc.co.label"    EN:"Company Guarantee"        RU:"Гарантия компании"
"gc.co.desc"     EN:"Invoice is billed to the company. No-show is billed to the company."
                  RU:"Счёт выставляется компании. При no-show счёт выставляется компании."
"gc.dep.label"   EN:"Deposit Guarantee"        RU:"Гарантия депозитом"
"gc.dep.desc"    EN:"Guest has paid a deposit. No-show results in full or partial deposit retention."
                  RU:"Гость внёс предоплату. При no-show депозит удерживается полностью или частично."
"gc.ng.label"    EN:"No Guarantee"             RU:"Без гарантии"
"gc.ng.desc"     EN:"Booking is unsecured. No financial claims possible in case of no-show."
                  RU:"Бронь не обеспечена. При no-show финансовые претензии невозможны."
"gc.ta.label"    EN:"Travel Agent Guarantee"   RU:"Гарантия турагента"
"gc.ta.desc"     EN:"Travel agent is financially responsible. No-show is billed to the agent."
                  RU:"Турагент несёт финансовую ответственность. При no-show счёт выставляется агенту."
```

---

### 7. `apps/web/src/app/configuration/page.tsx` — Server, 2 строки

```
"Коды гарантии"                             → t(dict, "guaranteeCodes.title")   (ключ уже добавлен выше)
"Типы гарантий бронирования и обработка no-show"  → t(dict, "config.guaranteeCodesDesc")
```
Ключи (только второй новый):
```
"config.guaranteeCodesDesc"  EN:"Booking guarantee types and no-show handling"  RU:"Типы гарантий бронирования и обработка no-show"
```

---

### 8. `apps/web/src/app/configuration/property/property-form.tsx` — Client, 1 строка

```
"НДС/VAT — ставка налога, применяемая к начислениям за проживание"
→ t(dict, "property.taxRateHint")
```
Ключи:
```
"property.taxRateHint"  EN:"VAT/Tax — tax rate applied to room charges"  RU:"НДС/VAT — ставка налога, применяемая к начислениям за проживание"
```

---

### 9. `apps/web/src/app/configuration/rate-plans/[id]/edit/page.tsx` — Server, 2 строки

```
"Настройки тарифного плана"   → t(dict, "ratePlan.settingsTitle")
"Цены по типам комнат"        → t(dict, "ratePlan.roomRatesTitle")
```
Ключи:
```
"ratePlan.settingsTitle"   EN:"Rate Plan Settings"     RU:"Настройки тарифного плана"
"ratePlan.roomRatesTitle"  EN:"Prices by Room Type"    RU:"Цены по типам комнат"
```

---

### 10. `apps/web/src/app/configuration/rate-plans/room-rates-matrix.tsx` — Client, 7 строк

```
"Нет типов комнат. Добавьте типы комнат в разделе"  → t(dict, "roomRates.noTypes")
"Тип комнаты"       → t(dict, "roomRates.colRoomType")
"Цена / ночь"       → t(dict, "roomRates.colPrice")
"✓ Сохранено"       → t(dict, "roomRates.saved")
"Сохранить"         → t(dict, "roomRates.save")
"Удалить"           → t(dict, "common.delete")  (ключ уже есть)
"Enter или кнопка «Сохранить» — сохранить цену для типа комнаты"  → t(dict, "roomRates.hint")
```
Ключи (новые):
```
"roomRates.noTypes"      EN:"No room types. Add room types in the"     RU:"Нет типов комнат. Добавьте типы комнат в разделе"
"roomRates.colRoomType"  EN:"Room Type"     RU:"Тип комнаты"
"roomRates.colPrice"     EN:"Price / Night" RU:"Цена / ночь"
"roomRates.saved"        EN:"✓ Saved"       RU:"✓ Сохранено"
"roomRates.save"         EN:"Save"          RU:"Сохранить"
"roomRates.hint"         EN:"Press Enter or Save to store the price for this room type"  RU:"Enter или кнопка «Сохранить» — сохранить цену для типа комнаты"
```

---

### 11. `apps/web/src/app/configuration/transaction-codes/new/page.tsx` — Server, 1 строка

```
"Новый код транзакции"  → t(dict, "txCodes.newTitle")
```
Ключи:
```
"txCodes.newTitle"   EN:"New Transaction Code"   RU:"Новый код транзакции"
```

---

### 12. `apps/web/src/app/configuration/transaction-codes/[id]/edit/page.tsx` — Server, 1 строка

```
"Редактировать код транзакции"  → t(dict, "txCodes.editTitle")
```
Ключи:
```
"txCodes.editTitle"  EN:"Edit Transaction Code"  RU:"Редактировать код транзакции"
```

---

### 13. `apps/web/src/app/guests/new/guest-form.tsx` и `guests/[id]/edit/guest-edit-form.tsx` — Client, по 1 строке

В обоих файлах:
```
"Нет"  →  (просто заменить на "None" без i18n — это value VIP статуса)
```

---

### 14. `apps/web/src/app/login/page.tsx` — Client, 3 строки

Добавить `useLocale`:
```
"Логин"    → t(dict, "login.username")
"Пароль"   → t(dict, "login.password")
"Вход..."  → t(dict, "login.signingIn")
"Войти"    → t(dict, "login.signIn")
```
Ключи:
```
"login.username"   EN:"Username"       RU:"Логин"
"login.password"   EN:"Password"       RU:"Пароль"
"login.signIn"     EN:"Sign In"        RU:"Войти"
"login.signingIn"  EN:"Signing in…"    RU:"Вход..."
```

---

### 15. `apps/web/src/app/night-audit/page.tsx` — Client, 3 строки

Уже используется `useLocale`. Добавить только три ключа:
```
"Бронь"     → t(dict, "nightAudit.colBooking")
"Заезд"     → t(dict, "nightAudit.colCheckIn")
"Гарантия"  → t(dict, "nightAudit.colGuarantee")
```
Ключи:
```
"nightAudit.colBooking"    EN:"Booking"    RU:"Бронь"
"nightAudit.colCheckIn"    EN:"Check-in"   RU:"Заезд"
"nightAudit.colGuarantee"  EN:"Guarantee"  RU:"Гарантия"
```

---

### 16. `apps/web/src/app/rooms/[id]/edit/page.tsx` — Client, 11 строк

Добавить `useLocale`:
```
"Ошибка сохранения"               → t(dict, "common.failedToSave")   (ключ уже есть)
"Ошибка сети"                     → t(dict, "rooms.networkError")
"Загрузка…"                       → t(dict, "common.loading")         (ключ уже есть)
"← Назад к комнате"               → t(dict, "rooms.backToRoom")
"Редактировать комнату"           → t(dict, "rooms.editTitle")
"Номер комнаты *"                 → t(dict, "rooms.labelNumber")
"Этаж"                            → t(dict, "rooms.labelFloor")
"Тип номера *"                    → t(dict, "rooms.labelRoomType")
"— выберите тип —"                → t(dict, "rooms.selectType")
"Сохранение…"                     → t(dict, "rooms.saving")
"Сохранить"                       → t(dict, "common.save")            (ключ уже есть)
"Отмена"                          → t(dict, "common.cancel")          (ключ уже есть)
```
Ключи (новые):
```
"rooms.networkError"  EN:"Network error"          RU:"Ошибка сети"
"rooms.backToRoom"    EN:"← Back to room"         RU:"← Назад к комнате"
"rooms.editTitle"     EN:"Edit Room"              RU:"Редактировать комнату"
"rooms.labelNumber"   EN:"Room Number *"          RU:"Номер комнаты *"
"rooms.labelFloor"    EN:"Floor"                  RU:"Этаж"
"rooms.labelRoomType" EN:"Room Type *"            RU:"Тип номера *"
"rooms.selectType"    EN:"— select type —"        RU:"— выберите тип —"
"rooms.saving"        EN:"Saving…"                RU:"Сохранение…"
```

---

### 17. `apps/web/src/app/rooms/[id]/page.tsx` — Server, 1 строка

```
"Настройки комнаты"  → t(dict, "rooms.settingsTitle")
```
Ключи:
```
"rooms.settingsTitle"  EN:"Room Settings"  RU:"Настройки комнаты"
```

---

### 18. `apps/web/src/app/rooms/[id]/room-status-actions.tsx` — Client, 12 строк

Добавить `useLocale`:
```
"Статус уборки"                         → t(dict, "rooms.hkStatus")
"Период: {from} → {to}"                 → t(dict, "rooms.oooPeriod", { from, to })
"| После: {status}"                     → t(dict, "rooms.oooAfter", { status })
"Вернуть в работу (dirty)"              → t(dict, "rooms.returnToDirty")
"Установить Out of Order"               → t(dict, "rooms.setOoo")
"С даты *"                              → t(dict, "rooms.oooFrom")
"По дату *"                             → t(dict, "rooms.oooTo")
"Статус после OOO"                      → t(dict, "rooms.oooReturnStatus")
"Dirty (требует уборки)"                → t(dict, "rooms.dirtyOption")
"Clean (готова)"                        → t(dict, "rooms.cleanOption")
"Подтвердить OOO"                       → t(dict, "rooms.confirmOoo")
"Отмена"                                → t(dict, "common.cancel")         (ключ уже есть)
"Комната занята. Out of Order недоступен до выезда гостя."  → t(dict, "rooms.oooBlocked")
```
Ключи (новые):
```
"rooms.hkStatus"      EN:"Housekeeping Status"             RU:"Статус уборки"
"rooms.oooPeriod"     EN:"Period: {from} → {to}"           RU:"Период: {from} → {to}"
"rooms.oooAfter"      EN:"| After: {status}"               RU:"| После: {status}"
"rooms.returnToDirty" EN:"Return to service (dirty)"       RU:"Вернуть в работу (dirty)"
"rooms.setOoo"        EN:"Set Out of Order"                RU:"Установить Out of Order"
"rooms.oooFrom"       EN:"From date *"                     RU:"С даты *"
"rooms.oooTo"         EN:"To date *"                       RU:"По дату *"
"rooms.oooReturnStatus" EN:"Status after OOO"              RU:"Статус после OOO"
"rooms.dirtyOption"   EN:"Dirty (requires housekeeping)"   RU:"Dirty (требует уборки)"
"rooms.cleanOption"   EN:"Clean (ready)"                   RU:"Clean (готова)"
"rooms.confirmOoo"    EN:"Confirm OOO"                     RU:"Подтвердить OOO"
"rooms.oooBlocked"    EN:"Room is occupied. Out of Order unavailable until guest checks out."
                       RU:"Комната занята. Out of Order недоступен до выезда гостя."
```

---

## Проверка

```bash
cd apps/web && npx tsc --noEmit
```
0 ошибок.

## Отчёт

Сохрани в `docs/plans/gemini/06-i18n-remaining-result.md`:
- список обработанных файлов
- сколько ключей добавлено в en.ts / ru.ts
- результат tsc
