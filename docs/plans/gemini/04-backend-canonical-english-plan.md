# План канонизации бэкенда и рефакторинга Folio Windows

## Проблема
По результатам аудита кодовой базы (`packages/db` и `apps/api`), в системе найдено большое количество жестко зашитых строк на русском языке. Это нарушает принцип "locale-agnostic backend" (бэкенд должен быть независимым от языка пользователя).

Более того, архитектура окон фолио (Folio Windows) сейчас использует статичные захардкоженные названия ("Основной", "Компания") и старую систему типов `payee_type`. В рамках перехода на **Unified Profiles** (единая таблица `profiles` для гостей, компаний, агентов и источников, см. `05-unified-profiles.md`), окна фолио должны динамически привязываться к конкретному профилю и наследовать его имя.

---

## Фаза 04-A: Тексты ошибок API и валидации (API Error Messages)
**Статус:** НЕЗАВИСИМО. Можно (и нужно) делать параллельно с GLM 05.

Практически все API-ендпоинты возвращают ошибки на русском языке. Фронтенд просто выводит `error.message`, и англоязычный пользователь увидит русскую ошибку.

**Где искать (явный список файлов):**
- `apps/api/src/routes/cashier.ts`
- `apps/api/src/routes/rooms.ts`
- `apps/api/src/routes/night-audit.ts`
- `apps/api/src/routes/bookings.ts`
- `apps/api/src/routes/folio.ts`
- `apps/api/src/routes/guests.ts` (если останется после GLM)
- `apps/api/src/routes/companies.ts` (если останется)
- `apps/api/src/routes/travel-agents.ts` (если останется)
- `apps/api/src/lib/validation.ts`

**План исправления:**
1. **Каноничные сообщения на английском:** Заменить все русские строки `error: "..."` в API на английские (например, `error: "Property ID and name are required"` вместо `"propertyId и name обязательны"`).
2. **Использование кодов ошибок:** Часть роутов уже возвращает `code`. Существующие коды (дополнять, не переименовывать!): `POSSIBLE_DUPLICATE`, `HAS_BOOKINGS`, `HAS_FOLIO_TRANSACTIONS`, `ROOM_OCCUPIED`, `NIGHT_AUDIT_BLOCKING_DUE_OUTS`, `CANCEL_CHECKIN_TOO_LATE`.
   Убедиться, что вместе с текстом ошибки API всегда возвращает уникальный `code` для всех новых переведенных ошибок.
3. **Локализация ошибок на клиенте:**
   - Обновить словари `apps/web/src/lib/i18n/locales/en.ts` и `ru.ts` плоскими ключами для кодов ошибок (например, `"err_room_occupied": "Room is occupied"`). Использовать flat style без точек в формате snake_case, так как наш словарь плоский (DictionaryKey — keyof typeof en). Обязательно добавить фоллбэк-ключ `"err_unknown": "An error occurred"` / `"err_unknown": "Произошла ошибка"`.
   - Обновить UI-компоненты: там, где сейчас выводится текст ошибки (например, `setError(err.message)`), заменить логику на использование перевода `t(dict, err.code ?? 'err_unknown')` (добавить такой фоллбэк), используя сообщение бэкенда только если код не распознан.
4. **Проверка:** В конце фазы запустить явную проверку (Turbo cache может врать):
   ```bash
   cd apps/api && npx tsc --noEmit
   cd ../web && npx tsc --noEmit
   ```

---

## Фаза 04-B: Рефакторинг и динамическое именование окон фолио (Folio Windows)
**Статус:** ЗАВИСИМО. Выполнять строго после завершения GLM 05 (Unified Profiles).

Окно фолио должно отражать реального плательщика — будь то гость, компания или турагент. Имя окна должно быть динамическим и браться из таблицы `profiles`.

**Шаги:**
1. **Обновить схему БД (`financial.ts`)**:
   - Удалить `payeeType` и `payeeId`.
   - Добавить поле `profileId` (ссылка на `profiles.id`).
   - Убрать `.default("Основной")` у поля `label` и явно добавить `.notNull()` (чтобы не было расхождения схемы и БД).
2. **Написать скрипт миграции (`packages/db/drizzle/0008_folio_profile_id.sql`)**:
   ```sql
   -- Добавляем колонку
   ALTER TABLE "folio_windows" ADD COLUMN "profile_id" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT;
   
   -- Заполняем данными из bookings (для Window 1 - главный гость)
   UPDATE "folio_windows" fw
   SET "profile_id" = b.guest_profile_id
   FROM "bookings" b
   WHERE fw.booking_id = b.id AND fw.window_number = 1;

   -- Заполняем данными из bookings (для Window 2+ где payee_type = company)
   UPDATE "folio_windows" fw
   SET "profile_id" = b.company_profile_id
   FROM "bookings" b
   WHERE fw.booking_id = b.id
     AND fw.payee_type = 'company'
     AND b.company_profile_id IS NOT NULL;

   -- Заполняем данными из bookings (для Window 2+ где payee_type = travel_agent)
   UPDATE "folio_windows" fw
   SET "profile_id" = b.agent_profile_id
   FROM "bookings" b
   WHERE fw.booking_id = b.id
     AND fw.payee_type = 'travel_agent'
     AND b.agent_profile_id IS NOT NULL;

   -- Фоллбэк: если profile_id всё ещё NULL — ставим guest профайл брони
   UPDATE "folio_windows" fw
   SET "profile_id" = b.guest_profile_id
   FROM "bookings" b
   WHERE fw.booking_id = b.id AND fw.profile_id IS NULL;

   -- Обновляем label существующих записей из профайлов перед тем как сделать его NOT NULL
   UPDATE "folio_windows" fw
   SET "label" = p.name
   FROM "profiles" p
   WHERE fw.profile_id = p.id AND (fw.label IS NULL OR fw.label IN ('Основной', 'Компания'));

   -- Делаем profile_id обязательным
   ALTER TABLE "folio_windows" ALTER COLUMN "profile_id" SET NOT NULL;

   -- Делаем label обязательным
   ALTER TABLE "folio_windows" ALTER COLUMN "label" SET NOT NULL;

   -- Удаляем старые колонки
   ALTER TABLE "folio_windows" DROP COLUMN "payee_type", DROP COLUMN "payee_id";
   ```
   *Не забыть обновить `packages/db/drizzle/meta/_journal.json`.*
3. **Обновить API создания броней (`bookings.ts`)**:
   - При создании первого окна фолио (Window 1), брать `name` из профиля главного гостя (`guestProfileId`) и передавать его в `label` и `profileId` (например, `"Ivan Ivanov"`).
   - Если создаются дополнительные окна для компании или агента (Window 2+), передавать соответствующий `profiles.name` (например, `"Baltic Lines LLC"`) и `companyProfileId`/`agentProfileId`.
4. **Обновить API создания окон (`folio.ts`)**:
   - Обновить роут `POST /api/bookings/:bookingId/folio/windows`, чтобы он принимал `profileId` и брал `label` из соответствующего профиля.
5. **Обновить UI**:
   - Фронтенду больше не нужно переводить системные слова. Он будет выводить `label` "как есть" (например, `W1: Ivan Ivanov`, `W2: Baltic Lines LLC`), что является самым каноничным и бизнес-логичным подходом.
6. **Обновить тесты**:
   - Обновить интеграционные тесты в `apps/api/src/routes/integration.test.ts`, которые проверяют folio windows, так как структура схемы изменилась.
7. **Проверка:** В конце фазы запустить явную проверку:
   ```bash
   cd apps/api && npx tsc --noEmit
   cd ../web && npx tsc --noEmit
   ```

---

## Фаза 04-C: Данные для сидирования (Seed Data — Контент)
**Статус:** ЗАВИСИМО. Выполнять строго после завершения GLM 05 (Unified Profiles).

**Важно:** GLM 05 переписывает *структуру* `seed.ts` (заменяет `guests/companies/travel_agents` на `profiles`). Задача Gemini на этом этапе — заниматься **исключительно контентом**. Структуру (как вставляются профили) трогать нельзя. Нужно лишь перевести кириллические строки на английский.

**Где найдено:**
- `packages/db/src/seed.ts`

**План исправления (только перевод строк):**
Заменить все тестовые данные в seed-файле на интернациональные/английские аналоги:
- Пакеты (таблица `packages`): `"Breakfast"`, `"Parking"` (вместо "Завтрак", "Парковка")
- Компании: `"Baltic Lines LLC"`, `"Westfilm Inc."` (вместо "ООО «Балтийские Линии»", "АО «Запфильм»")
- Имена: `"Elena Petrova"`, `"Andrey Sidorov"`
- Адреса: `"2 Lake Drive, Kaliningrad"` (вместо "Озёрный проезд, 2")

**Проверка:** В конце фазы запустить:
```bash
cd packages/db && npx tsc --noEmit
```

---

## Итоговый порядок выполнения
1. **GLM 05**: Unified Profiles (schema + migration + API + frontend + seed structure). Выполняется агентом GLM.
2. **Gemini 04-A**: API error messages → English + codes. **Можно выполнять параллельно с шагом 1.**
3. **Gemini 04-B**: Folio Windows → `profileId`. Ждем завершения шага 1.
4. **Gemini 04-C**: Seed data (перевод контента на `en`). Ждем завершения шага 1.
