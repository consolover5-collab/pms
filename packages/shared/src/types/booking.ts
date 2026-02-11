export const BOOKING_STATUSES = [
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const HOUSEKEEPING_STATUSES = [
  "clean",
  "dirty",
  "pickup",
  "inspected",
  "out_of_order",
  "out_of_service",
] as const;

export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number];

export const OCCUPANCY_STATUSES = [
  "vacant",
  "occupied",
] as const;

export type OccupancyStatus = (typeof OCCUPANCY_STATUSES)[number];
