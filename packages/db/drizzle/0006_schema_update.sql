CREATE TABLE IF NOT EXISTS "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action,
	"name" varchar(200) NOT NULL,
	"short_name" varchar(100),
	"tax_id" varchar(50),
	"registration_number" varchar(50),
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"contact_person" varchar(200),
	"credit_limit" numeric(12, 2),
	"payment_term_days" integer DEFAULT 30 NOT NULL,
	"ar_account_number" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "travel_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action,
	"name" varchar(200) NOT NULL,
	"iata_code" varchar(20),
	"commission_percent" numeric(5, 2),
	"email" varchar(255),
	"phone" varchar(50),
	"address" text,
	"contact_person" varchar(200),
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_daily_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action,
	"stay_date" date NOT NULL,
	"room_id" uuid REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action,
	"room_type_id" uuid NOT NULL REFERENCES "public"."room_types"("id") ON DELETE restrict ON UPDATE no action,
	"rate_plan_id" uuid REFERENCES "public"."rate_plans"("id") ON DELETE restrict ON UPDATE no action,
	"rate_amount" numeric(10, 2) NOT NULL,
	"adults" integer DEFAULT 1 NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"market_code" varchar(20),
	"source_code" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cashier_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action,
	"user_id" uuid REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action,
	"cashier_number" integer NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"opening_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"closing_balance" numeric(10, 2),
	"status" varchar(10) DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "folio_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action,
	"window_number" integer NOT NULL,
	"label" varchar(100) DEFAULT 'Основной' NOT NULL,
	"payee_type" varchar(20) DEFAULT 'guest' NOT NULL,
	"payee_id" uuid,
	"payment_method" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "folio_windows_booking_window" UNIQUE("booking_id","window_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"transaction_code_id" uuid NOT NULL REFERENCES "public"."transaction_codes"("id") ON DELETE restrict ON UPDATE no action,
	"calculation_rule" varchar(30) DEFAULT 'per_night' NOT NULL,
	"amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"posting_rhythm" varchar(20) DEFAULT 'every_night' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "packages_property_code" UNIQUE("property_id","code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_plan_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rate_plan_id" uuid NOT NULL REFERENCES "public"."rate_plans"("id") ON DELETE restrict ON UPDATE no action,
	"package_id" uuid NOT NULL REFERENCES "public"."packages"("id") ON DELETE restrict ON UPDATE no action,
	"included_in_rate" boolean DEFAULT true NOT NULL,
	CONSTRAINT "rate_plan_packages_unique" UNIQUE("rate_plan_id","package_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hk_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action,
	"room_id" uuid NOT NULL REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action,
	"business_date_id" uuid NOT NULL REFERENCES "public"."business_dates"("id") ON DELETE restrict ON UPDATE no action,
	"task_type" varchar(20) NOT NULL,
	"assigned_to" varchar(100),
	"priority" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hk_tasks_room_date_type" UNIQUE("room_id","business_date_id","task_type")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cashier_sessions_one_open_per_number" ON "cashier_sessions" USING btree ("property_id","cashier_number") WHERE status = 'open';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cashier_sessions_user_id_idx" ON "cashier_sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "folio_windows_booking_id_idx" ON "folio_windows" USING btree ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companies_property_id_idx" ON "companies" USING btree ("property_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "companies_property_tax_id_idx" ON "companies" USING btree ("property_id","tax_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "travel_agents_property_id_idx" ON "travel_agents" USING btree ("property_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_daily_details_unique_stay" ON "booking_daily_details" USING btree ("booking_id","stay_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "packages_property_id_idx" ON "packages" USING btree ("property_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hk_tasks_property_id_idx" ON "hk_tasks" USING btree ("property_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hk_tasks_business_date_id_idx" ON "hk_tasks" USING btree ("business_date_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hk_tasks_assigned_to_idx" ON "hk_tasks" USING btree ("assigned_to");
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "company_id" uuid REFERENCES "public"."companies"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "travel_agent_id" uuid REFERENCES "public"."travel_agents"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "folio_transactions" ADD COLUMN IF NOT EXISTS "folio_window_id" uuid REFERENCES "public"."folio_windows"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "folio_transactions" ADD COLUMN IF NOT EXISTS "cashier_session_id" uuid REFERENCES "public"."cashier_sessions"("id") ON DELETE restrict;