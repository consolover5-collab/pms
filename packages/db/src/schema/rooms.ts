import {
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  date,
  text,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const roomTypes = pgTable("room_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 10 }).notNull(),
  maxOccupancy: integer("max_occupancy").notNull().default(2),
  baseRate: decimal("base_rate", { precision: 10, scale: 2 }),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  roomTypeId: uuid("room_type_id")
    .notNull()
    .references(() => roomTypes.id, { onDelete: "restrict" }),
  roomNumber: varchar("room_number", { length: 10 }).notNull(),
  floor: integer("floor"),
  /** Valid values: clean, dirty, pickup, inspected, out_of_order, out_of_service */
  housekeepingStatus: varchar("housekeeping_status", { length: 20 })
    .notNull()
    .default("clean"),
  /** Valid values: vacant, occupied */
  occupancyStatus: varchar("occupancy_status", { length: 20 })
    .notNull()
    .default("vacant"),
  /**
   * @opera Даты OOO/OOS периода (из логики ROOM_OOO)
   * Обязательны при установке out_of_order / out_of_service
   */
  oooFromDate: date("ooo_from_date"),
  oooToDate: date("ooo_to_date"),
  /** Статус возврата после окончания OOO: clean | dirty */
  returnStatus: varchar("return_status", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("rooms_property_room_number").on(table.propertyId, table.roomNumber),
  index("rooms_property_id_idx").on(table.propertyId),
  index("rooms_room_type_id_idx").on(table.roomTypeId),
]);
