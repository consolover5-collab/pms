import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  date,
  decimal,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const profileTypeEnum = pgEnum("profile_type", [
  "individual",
  "company",
  "travel_agent",
  "source",
  "contact",
]);

export const channelTypeEnum = pgEnum("channel_type_enum", [
  "direct",
  "ota",
  "gds",
  "corporate",
  "walkin",
  "other",
]);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    type: profileTypeEnum("type").notNull(),

    name: text("name").notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),

    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    dateOfBirth: date("date_of_birth"),
    nationality: varchar("nationality", { length: 100 }),
    gender: varchar("gender", { length: 1 }),
    language: varchar("language", { length: 10 }),
    passportNumber: varchar("passport_number", { length: 100 }),
    documentType: varchar("document_type", { length: 50 }),
    vipStatus: varchar("vip_status", { length: 20 }),

    shortName: varchar("short_name", { length: 100 }),
    taxId: varchar("tax_id", { length: 50 }),
    registrationNumber: varchar("registration_number", { length: 50 }),
    address: text("address"),
    creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
    paymentTermDays: integer("payment_term_days"),
    arAccountNumber: varchar("ar_account_number", { length: 50 }),

    iataCode: varchar("iata_code", { length: 20 }),
    commissionPercent: decimal("commission_percent", { precision: 5, scale: 2 }),

    sourceCode: varchar("source_code", { length: 20 }),
    channelType: channelTypeEnum("channel_type"),

    contactPerson: varchar("contact_person", { length: 200 }),
    contactTitle: varchar("contact_title", { length: 100 }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("profiles_property_id_idx").on(table.propertyId),
    index("profiles_type_idx").on(table.type),
    index("profiles_name_idx").on(table.name),
  ],
);

export const profileRelationships = pgTable("profile_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromProfileId: uuid("from_profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  toProfileId: uuid("to_profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  relationshipType: varchar("relationship_type", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
