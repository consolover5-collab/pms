import {
  pgTable,
  uuid,
  varchar,
  date,
  integer,
  boolean,
  timestamp,
  decimal,
  unique,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { properties } from "./properties";
import { bookings } from "./bookings";

// Story 7-1: Business dates — one open date per property
export const businessDates = pgTable(
  "business_dates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    date: date("date").notNull(),
    /** Valid values: open, closed */
    status: varchar("status", { length: 10 }).notNull().default("open"),
    closedAt: timestamp("closed_at"),
    closedBy: uuid("closed_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("business_dates_property_date").on(table.propertyId, table.date),
    uniqueIndex("business_dates_one_open_per_property")
      .on(table.propertyId)
      .where(sql`status = 'open'`),
  ],
);

// Story 7-2: Transaction codes for financial operations
export const transactionCodes = pgTable(
  "transaction_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 20 }).notNull(),
    description: varchar("description", { length: 255 }).notNull(),
    /** Valid values: room_charge, tax, payment, minibar, restaurant, spa, laundry, phone, parking, misc */
    groupCode: varchar("group_code", { length: 20 }).notNull(),
    /** Valid values: charge, payment */
    transactionType: varchar("transaction_type", { length: 10 })
      .notNull()
      .default("charge"),
    isManualPostAllowed: boolean("is_manual_post_allowed")
      .notNull()
      .default(true),
    isActive: boolean("is_active").notNull().default(true),
    // Self-FK for adjustment codes
    adjustmentCodeId: uuid("adjustment_code_id")
      .references((): any => transactionCodes.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("transaction_codes_property_code").on(table.propertyId, table.code),
  ],
);

// Story 7-3: Folio transactions — append-only debit/credit ledger
export const folioTransactions = pgTable("folio_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "restrict" }),
  businessDateId: uuid("business_date_id")
    .notNull()
    .references(() => businessDates.id, { onDelete: "restrict" }),
  transactionCodeId: uuid("transaction_code_id")
    .notNull()
    .references(() => transactionCodes.id, { onDelete: "restrict" }),
  folioWindow: integer("folio_window").notNull().default(1),
  debit: decimal("debit", { precision: 10, scale: 2 }).notNull().default("0"),
  credit: decimal("credit", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  quantity: integer("quantity").notNull().default(1),
  description: varchar("description", { length: 255 }),
  isSystemGenerated: boolean("is_system_generated").notNull().default(false),
  appliedTaxRate: decimal("applied_tax_rate", { precision: 5, scale: 2 }),
  parentTransactionId: uuid("parent_transaction_id")
    .references((): any => folioTransactions.id, { onDelete: "restrict" }),
  postedBy: varchar("posted_by", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("folio_transactions_booking_id_idx").on(table.bookingId),
  index("folio_transactions_business_date_id_idx").on(table.businessDateId),
]);
