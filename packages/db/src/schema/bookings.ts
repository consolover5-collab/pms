import {
  pgTable,
  uuid,
  varchar,
  date,
  integer,
  text,
  boolean,
  timestamp,
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
  ratePlanId: uuid("rate_plan_id")
    .notNull()
    .references(() => ratePlans.id),
  confirmationNumber: varchar("confirmation_number", { length: 20 })
    .notNull()
    .unique(),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("confirmed"),
  adults: integer("adults").notNull().default(1),
  children: integer("children").notNull().default(0),
  specialRequests: text("special_requests"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
