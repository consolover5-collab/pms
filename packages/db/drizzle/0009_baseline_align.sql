-- Baseline alignment: выравнивает схему чистой БД с schema.ts.
-- Миграции 0000-0008 исторически расходились с кодом из-за ручных push'ей
-- в pms_dev. Эта миграция идемпотентно добавляет/переименовывает недостающее.

-- properties: tax_rate
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "tax_rate" numeric(5,2) NOT NULL DEFAULT '0';

-- rate_plans: base_rate, is_default
ALTER TABLE "rate_plans"
  ADD COLUMN IF NOT EXISTS "base_rate" numeric(10,2);
ALTER TABLE "rate_plans"
  ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false;

-- bookings: rename check_in → check_in_date, check_out → check_out_date, special_requests → notes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='bookings' AND column_name='check_in')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name='bookings' AND column_name='check_in_date') THEN
    ALTER TABLE "bookings" RENAME COLUMN "check_in" TO "check_in_date";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='bookings' AND column_name='check_out')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name='bookings' AND column_name='check_out_date') THEN
    ALTER TABLE "bookings" RENAME COLUMN "check_out" TO "check_out_date";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='bookings' AND column_name='special_requests')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name='bookings' AND column_name='notes') THEN
    ALTER TABLE "bookings" RENAME COLUMN "special_requests" TO "notes";
  END IF;
END $$;

-- bookings: rate_amount, payment_method, actual_check_in, actual_check_out, notes (fallback)
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "rate_amount" numeric(10,2);
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "payment_method" varchar(20);
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "actual_check_in" timestamp;
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "actual_check_out" timestamp;
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "notes" text;
