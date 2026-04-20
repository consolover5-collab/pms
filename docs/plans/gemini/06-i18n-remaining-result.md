# Отчёт о выполнении: i18n — оставшиеся русские строки

## Обработанные файлы

1. `apps/web/src/app/bookings/date-filter.tsx`
2. `apps/web/src/app/bookings/page.tsx`
3. `apps/web/src/app/bookings/[id]/page.tsx`
4. `apps/web/src/app/bookings/[id]/folio-section.tsx`
5. `apps/web/src/app/bookings/[id]/booking-actions.tsx`
6. `apps/web/src/app/configuration/guarantee-codes/page.tsx`
7. `apps/web/src/app/configuration/page.tsx`
8. `apps/web/src/app/configuration/property/property-form.tsx`
9. `apps/web/src/app/configuration/rate-plans/[id]/edit/page.tsx`
10. `apps/web/src/app/configuration/rate-plans/room-rates-matrix.tsx`
11. `apps/web/src/app/configuration/transaction-codes/new/page.tsx`
12. `apps/web/src/app/configuration/transaction-codes/[id]/edit/page.tsx`
13. `apps/web/src/app/guests/new/guest-form.tsx`
14. `apps/web/src/app/guests/[id]/edit/guest-edit-form.tsx`
15. `apps/web/src/app/login/page.tsx`
16. `apps/web/src/app/night-audit/page.tsx`
17. `apps/web/src/app/rooms/[id]/edit/page.tsx`
18. `apps/web/src/app/rooms/[id]/page.tsx`
19. `apps/web/src/app/rooms/[id]/room-status-actions.tsx`

Все захардкоженные русские строки в этих файлах были успешно заменены на вызовы функции `t(dict, "key")`.

## Словари
Добавлено новых ключей в словари `en.ts` и `ru.ts`: **58 ключей** (по плану).
Ключи охватывают:
- Фильтр дат (`dateFilter.*`)
- Таблицы бронирований (`bookings.*`, `booking.*`)
- Коды гарантии (`guaranteeCodes.*`, `gc.*`)
- Настройки отеля (`property.*`)
- Тарифные планы и цены (`ratePlan.*`, `roomRates.*`)
- Новые/Редактирование кодов транзакций (`txCodes.*`)
- Формы гостей (замена "Нет" на "None" в value для VIP Status)
- Логин (`login.*`)
- Night Audit (`nightAudit.*`)
- Управление комнатами (`rooms.*`)

## Результат проверки
Компиляция проекта прошла успешно.

Команда `npx tsc --noEmit` в папке `apps/web`:
```
(empty) - 0 ошибок
```