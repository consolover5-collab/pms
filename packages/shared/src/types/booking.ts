export const BOOKING_STATUSES = [
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const ROOM_STATUSES = [
  "clean",
  "dirty",
  "inspected",
  "out_of_order",
  "occupied",
] as const;

export type RoomStatus = (typeof ROOM_STATUSES)[number];
