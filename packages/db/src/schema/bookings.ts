import {
  pgTable,
  uuid,
  varchar,
  date,
  integer,
  text,
  boolean,
  timestamp,
  decimal,
  index,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { rooms, roomTypes } from "./rooms";
import { guests } from "./guests";

export const ratePlans = pgTable("rate_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  baseRate: decimal("base_rate", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id, { onDelete: "restrict" }),
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "restrict" }),
  roomTypeId: uuid("room_type_id")
    .notNull()
    .references(() => roomTypes.id, { onDelete: "restrict" }),
  ratePlanId: uuid("rate_plan_id").references(() => ratePlans.id, { onDelete: "restrict" }),
  confirmationNumber: varchar("confirmation_number", { length: 20 })
    .notNull()
    .unique(),
  checkInDate: date("check_in_date").notNull(),
  checkOutDate: date("check_out_date").notNull(),
  /** Valid values: confirmed, checked_in, checked_out, cancelled, no_show */
  status: varchar("status", { length: 20 }).notNull().default("confirmed"),
  adults: integer("adults").notNull().default(1),
  children: integer("children").notNull().default(0),
  rateAmount: decimal("rate_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  /** Valid values: cash, credit_card, bank_transfer, other */
  paymentMethod: varchar("payment_method", { length: 20 }),
  actualCheckIn: timestamp("actual_check_in"),
  actualCheckOut: timestamp("actual_check_out"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("bookings_property_id_idx").on(table.propertyId),
  index("bookings_guest_id_idx").on(table.guestId),
  index("bookings_room_id_idx").on(table.roomId),
]);
