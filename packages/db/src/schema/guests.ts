import {
  pgTable,
  uuid,
  varchar,
  date,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const guests = pgTable("guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  documentType: varchar("document_type", { length: 50 }),
  documentNumber: varchar("document_number", { length: 100 }),
  nationality: varchar("nationality", { length: 100 }),
  gender: varchar("gender", { length: 1 }),
  language: varchar("language", { length: 10 }),
  dateOfBirth: date("date_of_birth"),
  /**
   * @opera VIP_STATUS VARCHAR2(20) — коды "VIP", "GOLD", "SILVER" и т.п.
   * Изменено с integer: Opera хранит строку, не число
   */
  vipStatus: varchar("vip_status", { length: 20 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("guests_property_id_idx").on(table.propertyId),
]);
