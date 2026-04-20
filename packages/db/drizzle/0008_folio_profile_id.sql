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

-- Делаем label обязательным и убираем дефолт
ALTER TABLE "folio_windows" ALTER COLUMN "label" SET NOT NULL;
ALTER TABLE "folio_windows" ALTER COLUMN "label" DROP DEFAULT;

-- Удаляем старые колонки
ALTER TABLE "folio_windows" DROP COLUMN "payee_type";
ALTER TABLE "folio_windows" DROP COLUMN "payee_id";
