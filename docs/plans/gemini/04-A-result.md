# Phase 04-A Result: API Error Messages Canonicalization

## Что было сделано
В рамках Фазы 04-A успешно завершен перевод всех системных сообщений об ошибках в API на каноничный английский язык. Бэкенд стал полностью независим от локали (locale-agnostic), а вывод ошибок пользователю на нужном языке теперь осуществляется через интерфейс `apps/web`.

### 1. Перевод и стандартизация API
Все кириллические ошибки были переведены на английский, и к каждому ответу был добавлен унифицированный `code`.

**Измененные файлы в `apps/api/src/routes/`:**
- `bookings.ts`
- `rooms.ts`
- `folio.ts`
- `cashier.ts`
- `properties.ts`
- `rate-plans.ts`
- `room-types.ts`
- `packages.ts`
- `profiles.ts`
- `dashboard.ts`
- `night-audit.ts`
- `apps/api/src/lib/validation.ts` (и `validation.test.ts`)

**Пример изменения:**
Было: `return reply.status(404).send({ error: "Бронирование не найдено" });`
Стало: `return reply.status(404).send({ error: "Booking not found", code: "BOOKING_NOT_FOUND" });`

Существующие коды (например, `POSSIBLE_DUPLICATE`, `HAS_BOOKINGS`, `ROOM_OCCUPIED`) были сохранены.

### 2. Локализация на клиенте (UI)
Для того чтобы пользователь по-прежнему видел понятные ошибки на русском (если выбрана локаль RU), была добавлена логика перевода на лету.

**Словари i18n:**
- Обновлен `apps/web/src/lib/i18n/locales/en.ts`
- Обновлен `apps/web/src/lib/i18n/locales/ru.ts`
В словари добавлены плоские `snake_case` ключи вида `err_<code_в_нижнем_регистре>`, а также дефолтный `err_unknown`.

**Компоненты:**
- Обновлен `apps/web/src/components/error-display.tsx`. Теперь он автоматически извлекает `error.code`, ищет его перевод по формату `err_code_name` с помощью хука `useLocale()`, и отображает локализованный текст. Если перевода для кода нет, срабатывает фоллбэк: перевод `err_unknown` + оригинальное английское сообщение от API в скобках.
- Поскольку все остальные компоненты (например, формы бронирования, ночной аудит) для вывода ошибок используют либо этот компонент, либо передают объект с `error`/`code` в локальный state, правка одного `error-display.tsx` решила вопрос централизованно.

### 3. Проверка типов
Выполнен явный запуск тайпчека для обхода возможных кэшей Turbo:
```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```
Оба проекта компилируются без ошибок.

---

## Как проверить (cURL)

**1. Проверка несуществующей комнаты (ROOM_NOT_FOUND)**
```bash
curl -X POST http://localhost:3001/api/bookings/123-123/check-in \
  -H "Content-Type: application/json" \
  -d '{"roomId":"00000000-0000-0000-0000-000000000000"}'
```
*Ожидаемый ответ:*
```json
{
  "error": "Booking not found",
  "code": "BOOKING_NOT_FOUND"
}
```

**2. Создание дубликата (MISSING_FIELDS)**
```bash
curl -X POST http://localhost:3001/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"type":"guest"}'
```
*Ожидаемый ответ:*
```json
{
  "error": "propertyId and type are required",
  "code": "MISSING_FIELDS"
}
```

**3. Ночной аудит до закрытия смен**
```bash
curl -X POST http://localhost:3001/api/night-audit/preview \
  -H "Content-Type: application/json" \
  -d '{"propertyId":"00000000-0000-0000-0000-000000000000"}'
```
*В UI это вызовет `err_no_open_business_date` (Нет открытой бизнес-даты) или `err_night_audit_blocking_due_outs` (Ночной аудит заблокирован просроченными выездами).*
