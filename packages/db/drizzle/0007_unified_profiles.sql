-- Enums
CREATE TYPE "profile_type" AS ENUM ('individual','company','travel_agent','source','contact');
CREATE TYPE "channel_type_enum" AS ENUM ('direct','ota','gds','corporate','walkin','other');

-- Profiles table
CREATE TABLE "profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "type" profile_type NOT NULL,
  "name" text NOT NULL,
  "email" varchar(255),
  "phone" varchar(50),
  "notes" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "first_name" varchar(100),
  "last_name" varchar(100),
  "date_of_birth" date,
  "nationality" varchar(100),
  "gender" varchar(1),
  "language" varchar(10),
  "passport_number" varchar(100),
  "document_type" varchar(50),
  "vip_status" varchar(20),
  "short_name" varchar(100),
  "tax_id" varchar(50),
  "registration_number" varchar(50),
  "address" text,
  "credit_limit" decimal(12,2),
  "payment_term_days" integer,
  "ar_account_number" varchar(50),
  "iata_code" varchar(20),
  "commission_percent" decimal(5,2),
  "source_code" varchar(20),
  "channel_type" channel_type_enum,
  "contact_person" varchar(200),
  "contact_title" varchar(100),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "profiles_property_id_idx" ON "profiles"("property_id");
CREATE INDEX "profiles_type_idx" ON "profiles"("type");
CREATE INDEX "profiles_name_idx" ON "profiles"("name");

-- Profile relationships
CREATE TABLE "profile_relationships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "to_profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "relationship_type" varchar(50) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Migrate guests → profiles (type = individual)
INSERT INTO "profiles" (
  "id", "property_id", "type", "name",
  "first_name", "last_name", "email", "phone",
  "document_type", "passport_number", "nationality",
  "gender", "language", "date_of_birth", "vip_status",
  "notes", "is_active", "created_at", "updated_at"
)
SELECT
  id, property_id, 'individual'::profile_type,
  first_name || ' ' || last_name,
  first_name, last_name, email, phone,
  document_type, document_number, nationality,
  gender, language, date_of_birth, vip_status,
  notes, true, created_at, updated_at
FROM "guests";

-- Migrate companies → profiles (type = company)
INSERT INTO "profiles" (
  "id", "property_id", "type", "name",
  "short_name", "tax_id", "registration_number",
  "email", "phone", "address", "contact_person",
  "credit_limit", "payment_term_days", "ar_account_number",
  "notes", "is_active", "created_at", "updated_at"
)
SELECT
  id, property_id, 'company'::profile_type, name,
  short_name, tax_id, registration_number,
  email, phone, address, contact_person,
  credit_limit, payment_term_days, ar_account_number,
  notes, is_active, created_at, updated_at
FROM "companies";

-- Migrate travel_agents → profiles (type = travel_agent)
INSERT INTO "profiles" (
  "id", "property_id", "type", "name",
  "iata_code", "commission_percent",
  "email", "phone", "address", "contact_person",
  "notes", "is_active", "created_at", "updated_at"
)
SELECT
  id, property_id, 'travel_agent'::profile_type, name,
  iata_code, commission_percent,
  email, phone, address, contact_person,
  notes, is_active, created_at, updated_at
FROM "travel_agents";

-- Create source profiles from distinct source_code values in bookings
INSERT INTO "profiles" ("property_id", "type", "name", "source_code", "is_active")
SELECT DISTINCT
  b.property_id,
  'source'::profile_type,
  CASE b.source_code
    WHEN 'phone' THEN 'Phone'
    WHEN 'web' THEN 'Web Direct'
    WHEN 'ota' THEN 'OTA'
    WHEN 'walk_in' THEN 'Walk-in'
    WHEN 'gds' THEN 'GDS'
    ELSE initcap(b.source_code)
  END,
  b.source_code,
  true
FROM "bookings" b
WHERE b.source_code IS NOT NULL AND b.source_code <> '';

-- Add new FK columns to bookings
ALTER TABLE "bookings"
  ADD COLUMN "guest_profile_id" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT,
  ADD COLUMN "company_profile_id" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT,
  ADD COLUMN "agent_profile_id" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT,
  ADD COLUMN "source_profile_id" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT;

-- Populate guest_profile_id from existing guest_id
UPDATE "bookings" SET "guest_profile_id" = "guest_id";

-- Populate company_profile_id from existing company_id
UPDATE "bookings" SET "company_profile_id" = "company_id" WHERE "company_id" IS NOT NULL;

-- Populate agent_profile_id from existing travel_agent_id
UPDATE "bookings" SET "agent_profile_id" = "travel_agent_id" WHERE "travel_agent_id" IS NOT NULL;

-- Populate source_profile_id from source_code
UPDATE "bookings" b
SET "source_profile_id" = p.id
FROM "profiles" p
WHERE p.type = 'source'
  AND p.source_code = b.source_code
  AND p.property_id = b.property_id;

-- Make guest_profile_id NOT NULL
ALTER TABLE "bookings" ALTER COLUMN "guest_profile_id" SET NOT NULL;

-- Drop old FK columns
ALTER TABLE "bookings"
  DROP COLUMN "guest_id",
  DROP COLUMN "company_id",
  DROP COLUMN "travel_agent_id";

-- Drop old tables
DROP TABLE "travel_agents";
DROP TABLE "companies";
DROP TABLE "guests";
