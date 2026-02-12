ALTER TABLE "guests" ADD COLUMN "gender" varchar(1);--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "language" varchar(10);--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "vip_status" integer;