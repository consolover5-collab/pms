import type { BookingStatus, HousekeepingStatus } from "@pms/shared";

// --- Booking status transitions ---

const VALID_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["checked_out"],
  checked_out: [],
  cancelled: [],
  no_show: [],
};

export function canTransitionBooking(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return VALID_BOOKING_TRANSITIONS[from].includes(to);
}

export function assertBookingTransition(
  from: BookingStatus,
  to: BookingStatus,
): void {
  if (!canTransitionBooking(from, to)) {
    throw new Error(
      `Invalid booking status transition: ${from} -> ${to}`,
    );
  }
}

// --- Housekeeping status transitions ---

const VALID_HK_TRANSITIONS: Record<HousekeepingStatus, HousekeepingStatus[]> = {
  dirty: ["pickup", "clean", "out_of_order", "out_of_service"],
  pickup: ["clean", "dirty"],
  clean: ["inspected", "dirty", "out_of_order", "out_of_service"],
  inspected: ["dirty", "out_of_order", "out_of_service"],
  out_of_order: ["dirty"],
  out_of_service: ["dirty"],
};

export function canTransitionHousekeeping(
  from: HousekeepingStatus,
  to: HousekeepingStatus,
): boolean {
  return VALID_HK_TRANSITIONS[from].includes(to);
}

export function assertHousekeepingTransition(
  from: HousekeepingStatus,
  to: HousekeepingStatus,
): void {
  if (!canTransitionHousekeeping(from, to)) {
    throw new Error(
      `Invalid housekeeping status transition: ${from} -> ${to}`,
    );
  }
}
