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
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { properties } from "./properties";
import { bookings } from "./bookings";
import { profiles } from "./profiles";
import { users } from "./users";

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

// Кассирские смены
export const cashierSessions = pgTable("cashier_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "restrict" }),
  cashierNumber: integer("cashier_number").notNull(),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  openingBalance: decimal("opening_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  closingBalance: decimal("closing_balance", { precision: 10, scale: 2 }),
  /** Valid values: open, closed */
  status: varchar("status", { length: 10 }).notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("cashier_sessions_one_open_per_number")
    .on(table.propertyId, table.cashierNumber)
    .where(sql`status = 'open'`),
  index("cashier_sessions_user_id_idx").on(table.userId),
]);

// Окна биллинга — разделение счёта (1-8 окон на бронирование)
export const folioWindows = pgTable("folio_windows", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "restrict" }),
  windowNumber: integer("window_number").notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  paymentMethod: varchar("payment_method", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("folio_windows_booking_window").on(table.bookingId, table.windowNumber),
  index("folio_windows_booking_id_idx").on(table.bookingId),
]);

// Story 7-3: Folio transactions — append-only debit/credit ledger
export const folioTransactions = pgTable("folio_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "restrict" }),
  folioWindowId: uuid("folio_window_id")
    .references(() => folioWindows.id, { onDelete: "restrict" }),
  cashierSessionId: uuid("cashier_session_id")
    .references(() => cashierSessions.id, { onDelete: "restrict" }),
  businessDateId: uuid("business_date_id")
    .notNull()
    .references(() => businessDates.id, { onDelete: "restrict" }),
  transactionCodeId: uuid("transaction_code_id")
    .notNull()
    .references(() => transactionCodes.id, { onDelete: "restrict" }),
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
  uniqueIndex("folio_tx_night_audit_unique")
    .on(table.bookingId, table.businessDateId, table.transactionCodeId)
    .where(sql`is_system_generated = true`),
  check("folio_transactions_debit_nonnegative_check", sql`${table.debit} >= 0`),
  check("folio_transactions_credit_nonnegative_check", sql`${table.credit} >= 0`),
  // Financial XOR: exactly one of debit/credit is positive.
  check(
    "folio_transactions_debit_credit_xor_check",
    sql`(${table.debit} > 0 AND ${table.credit} = 0) OR (${table.debit} = 0 AND ${table.credit} > 0)`,
  ),
  check("folio_transactions_quantity_positive_check", sql`${table.quantity} > 0`),
]);
