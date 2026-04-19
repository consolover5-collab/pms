import {
  pgTable,
  uuid,
  varchar,
  date,
  integer,
  text,
  boolean,
  timestamp,
  decimal,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { rooms, roomTypes } from "./rooms";
import { profiles } from "./profiles";

export const ratePlans = pgTable("rate_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  baseRate: decimal("base_rate", { precision: 10, scale: 2 }),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Rate matrix: one price per rate plan per room type
export const ratePlanRoomRates = pgTable(
  "rate_plan_room_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ratePlanId: uuid("rate_plan_id")
      .notNull()
      .references(() => ratePlans.id, { onDelete: "restrict" }),
    roomTypeId: uuid("room_type_id")
      .notNull()
      .references(() => roomTypes.id, { onDelete: "restrict" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("rate_plan_room_type_unique").on(table.ratePlanId, table.roomTypeId),
  ],
);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  guestProfileId: uuid("guest_profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "restrict" }),
  roomTypeId: uuid("room_type_id")
    .notNull()
    .references(() => roomTypes.id, { onDelete: "restrict" }),
  ratePlanId: uuid("rate_plan_id").references(() => ratePlans.id, { onDelete: "restrict" }),
  companyProfileId: uuid("company_profile_id")
    .references(() => profiles.id, { onDelete: "restrict" }),
  agentProfileId: uuid("agent_profile_id")
    .references(() => profiles.id, { onDelete: "restrict" }),
  sourceProfileId: uuid("source_profile_id")
    .references(() => profiles.id, { onDelete: "restrict" }),
  confirmationNumber: varchar("confirmation_number", { length: 20 })
    .notNull()
    .unique(),
  checkInDate: date("check_in_date").notNull(),
  checkOutDate: date("check_out_date").notNull(),
  /** Valid values: confirmed, checked_in, checked_out, cancelled, no_show */
  status: varchar("status", { length: 20 }).notNull().default("confirmed"),
  adults: integer("adults").notNull().default(1),
  children: integer("children").notNull().default(0),
  rateAmount: decimal("rate_amount", { precision: 10, scale: 2 }),
  /** Valid values: cash, credit_card, bank_transfer, other */
  paymentMethod: varchar("payment_method", { length: 20 }),
  /**
   * @opera GUARANTEE_CODE на RESERVATION_NAME (VARCHAR2 20)
   * Valid values: cc_guaranteed, company_guaranteed, deposit_guaranteed,
   *               non_guaranteed, travel_agent_guaranteed
   */
  guaranteeCode: varchar("guarantee_code", { length: 30 }),
  /**
   * @opera MARKET_CODE — упрощение: на уровне брони (не посуточно)
   * Примеры: direct, corporate, ota, group, government, leisure
   */
  marketCode: varchar("market_code", { length: 20 }),
  /**
   * @opera SOURCE_CODE в FINANCIAL_TRANSACTIONS
   * Примеры: phone, web, ota, walk_in, gds
   */
  sourceCode: varchar("source_code", { length: 20 }),
  /**
   * @opera CHANNEL VARCHAR2(40) в RESERVATION_NAME
   * Примеры: direct, booking_com, expedia, airbnb, other
   */
  channel: varchar("channel", { length: 40 }),
  actualCheckIn: timestamp("actual_check_in"),
  actualCheckOut: timestamp("actual_check_out"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("bookings_property_id_idx").on(table.propertyId),
  index("bookings_guest_profile_id_idx").on(table.guestProfileId),
  index("bookings_room_id_idx").on(table.roomId),
]);
