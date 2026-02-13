import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const roomTypes = pgTable("room_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 10 }).notNull(),
  maxOccupancy: integer("max_occupancy").notNull().default(2),
  baseRate: numeric("base_rate", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id),
  roomTypeId: uuid("room_type_id")
    .notNull()
    .references(() => roomTypes.id),
  roomNumber: varchar("room_number", { length: 10 }).notNull(),
  floor: integer("floor"),
  housekeepingStatus: varchar("housekeeping_status", { length: 20 })
    .notNull()
    .default("clean"),
  occupancyStatus: varchar("occupancy_status", { length: 20 })
    .notNull()
    .default("vacant"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("rooms_property_room_number").on(table.propertyId, table.roomNumber),
]);
