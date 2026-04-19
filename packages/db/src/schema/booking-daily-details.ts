import {
  pgTable,
  uuid,
  varchar,
  date,
  integer,
  decimal,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { bookings, ratePlans } from "./bookings";
import { rooms, roomTypes } from "./rooms";

export const bookingDailyDetails = pgTable(
  "booking_daily_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    stayDate: date("stay_date").notNull(),
    roomId: uuid("room_id").references(() => rooms.id, {
      onDelete: "restrict",
    }),
    roomTypeId: uuid("room_type_id")
      .notNull()
      .references(() => roomTypes.id, { onDelete: "restrict" }),
    ratePlanId: uuid("rate_plan_id").references(() => ratePlans.id, {
      onDelete: "restrict",
    }),
    rateAmount: decimal("rate_amount", { precision: 10, scale: 2 }).notNull(),
    adults: integer("adults").notNull().default(1),
    children: integer("children").notNull().default(0),
    marketCode: varchar("market_code", { length: 20 }),
    sourceCode: varchar("source_code", { length: 20 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("booking_daily_details_unique_stay").on(
      table.bookingId,
      table.stayDate,
    ),
  ],
);
