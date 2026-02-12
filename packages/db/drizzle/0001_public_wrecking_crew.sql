ALTER TABLE "rooms" ALTER COLUMN "floor" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "check_in_time" time DEFAULT '14:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "check_out_time" time DEFAULT '12:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "number_of_rooms" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "number_of_floors" integer;--> statement-breakpoint
ALTER TABLE "room_types" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "housekeeping_status" varchar(20) DEFAULT 'clean' NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "occupancy_status" varchar(20) DEFAULT 'vacant' NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN "status";