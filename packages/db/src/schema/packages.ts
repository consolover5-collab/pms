import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  boolean,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { transactionCodes } from "./financial";
import { ratePlans } from "./bookings";

// Пакеты услуг (завтрак, парковка, трансфер)
export const packages = pgTable("packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  transactionCodeId: uuid("transaction_code_id")
    .notNull()
    .references(() => transactionCodes.id, { onDelete: "restrict" }),
  /** Valid values: per_night, per_stay, per_person_per_night */
  calculationRule: varchar("calculation_rule", { length: 30 }).notNull().default("per_night"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  /** Valid values: every_night, arrival_only, departure_only */
  postingRhythm: varchar("posting_rhythm", { length: 20 }).notNull().default("every_night"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("packages_property_code").on(table.propertyId, table.code),
  index("packages_property_id_idx").on(table.propertyId),
]);

// M:M связь rate_plans ↔ packages
export const ratePlanPackages = pgTable("rate_plan_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ratePlanId: uuid("rate_plan_id")
    .notNull()
    .references(() => ratePlans.id, { onDelete: "restrict" }),
  packageId: uuid("package_id")
    .notNull()
    .references(() => packages.id, { onDelete: "restrict" }),
  /** true = включён в тариф (0 доп. стоимость), false = отдельное начисление */
  includedInRate: boolean("included_in_rate").notNull().default(true),
}, (table) => [
  unique("rate_plan_packages_unique").on(table.ratePlanId, table.packageId),
]);
