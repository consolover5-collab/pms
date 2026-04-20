import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { rooms } from "./rooms";
import { businessDates } from "./financial";

export const hkTasks = pgTable("hk_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "restrict" }),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "restrict" }),
  businessDateId: uuid("business_date_id")
    .notNull()
    .references(() => businessDates.id, { onDelete: "restrict" }),
  /** Valid values: checkout_clean, stayover_clean, deep_clean, inspection, turndown */
  taskType: varchar("task_type", { length: 20 }).notNull(),
  assignedTo: varchar("assigned_to", { length: 100 }),
  /** 0=normal, 1=rush (VIP, early arrival) */
  priority: integer("priority").notNull().default(0),
  /** Valid values: pending, in_progress, completed, skipped */
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("hk_tasks_room_date_type").on(table.roomId, table.businessDateId, table.taskType),
  index("hk_tasks_property_id_idx").on(table.propertyId),
  index("hk_tasks_business_date_id_idx").on(table.businessDateId),
  index("hk_tasks_assigned_to_idx").on(table.assignedTo),
]);
