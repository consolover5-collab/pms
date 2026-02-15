import {
  pgTable,
  uuid,
  varchar,
  text,
  time,
  integer,
  decimal,
  timestamp,
} from "drizzle-orm/pg-core";

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  timezone: varchar("timezone", { length: 50 }).notNull().default("UTC"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  checkInTime: time("check_in_time").notNull().default("14:00"),
  checkOutTime: time("check_out_time").notNull().default("12:00"),
  numberOfRooms: integer("number_of_rooms"),
  numberOfFloors: integer("number_of_floors"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
