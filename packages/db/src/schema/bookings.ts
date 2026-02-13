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
} from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { rooms, roomTypes } from "./rooms";
import { guests } from "./guests";

export const ratePlans = pgTable("rate_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
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
    .references(() => properties.id),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id),
  roomId: uuid("room_id").references(() => rooms.id),
  roomTypeId: uuid("room_type_id")
    .notNull()
    .references(() => roomTypes.id),
  ratePlanId: uuid("rate_plan_id").references(() => ratePlans.id),
  confirmationNumber: varchar("confirmation_number", { length: 20 })
    .notNull()
    .unique(),
  checkInDate: date("check_in_date").notNull(),
  checkOutDate: date("check_out_date").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("confirmed"),
  adults: integer("adults").notNull().default(1),
  children: integer("children").notNull().default(0),
  rateAmount: decimal("rate_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  paymentMethod: varchar("payment_method", { length: 20 }),
  actualCheckIn: timestamp("actual_check_in"),
  actualCheckOut: timestamp("actual_check_out"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
