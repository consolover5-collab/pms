import {
  pgTable,
  uuid,
  varchar,
  date,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const guests = pgTable("guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id").references(() => properties.id),
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
  vipStatus: integer("vip_status"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
