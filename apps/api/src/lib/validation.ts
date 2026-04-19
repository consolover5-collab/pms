import { bookings, rooms, roomTypes } from "@pms/db";
import { eq, and, ne, lt, gt, or } from "drizzle-orm";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// Тип для db передаётся как any — Drizzle transaction и основной db совместимы
export async function checkRoomConflict(
  db: any,
  roomId: string,
  checkInDate: string,
  checkOutDate: string,
  excludeBookingId?: string
): Promise<string | null> {
  const conditions: any[] = [
    eq(bookings.roomId, roomId),
    lt(bookings.checkInDate, checkOutDate),
    gt(bookings.checkOutDate, checkInDate),
    or(
      eq(bookings.status, "confirmed"),
      eq(bookings.status, "checked_in")
    ),
  ];

  if (excludeBookingId) {
    conditions.push(ne(bookings.id, excludeBookingId));
  }

  const conflicts = await db
    .select({ id: bookings.id, confirmationNumber: bookings.confirmationNumber, checkInDate: bookings.checkInDate, checkOutDate: bookings.checkOutDate })
    .from(bookings)
    .where(and(...conditions))
    .limit(1);

  if (conflicts.length > 0) {
    const c = conflicts[0];
    return `Room occupied by booking #${c.confirmationNumber} (${c.checkInDate} - ${c.checkOutDate}).`;
  }

  return null;
}

export function validateBookingDates(checkInDate: string, checkOutDate: string): string | null {
  if (!checkInDate || !checkOutDate) return null;
  if (checkInDate > checkOutDate) {
    return `Check-out date (${checkOutDate}) cannot be before check-in date (${checkInDate}).`;
  }
  return null;
}

/** Validate all preconditions for a room move (pure, no DB). Returns error message or null. */
export function validateRoomMove(
  booking: { status: string; roomId: string | null; roomTypeId: string },
  newRoom: { id: string; roomTypeId: string; occupancyStatus: string; housekeepingStatus: string },
): string | null {
  if (booking.status !== "checked_in") {
    return `Room change is only possible for checked-in bookings. Current status: ${booking.status}.`;
  }
  if (newRoom.id === booking.roomId) {
    return `Cannot move guest to the same room.`;
  }
  if (newRoom.roomTypeId !== booking.roomTypeId) {
    return `New room type does not match booking type.`;
  }
  if (newRoom.occupancyStatus !== "vacant") {
    return `Room ${newRoom.id} is occupied (${newRoom.occupancyStatus}).`;
  }
  if (newRoom.housekeepingStatus !== "clean" && newRoom.housekeepingStatus !== "inspected") {
    return `Room is not ready for check-in (housekeeping status: ${newRoom.housekeepingStatus}).`;
  }
  return null;
}

/** Validate that a checked_out booking can be reinstated: checkOutDate must be after businessDate */
export function validateReinstateCheckedOut(checkOutDate: string, businessDate: string): string | null {
  if (checkOutDate <= businessDate) {
    return `Cannot reinstate: check-out date (${checkOutDate}) has already passed (business date: ${businessDate}).`;
  }
  return null;
}

export function validateOccupancy(
  adults: number,
  children: number,
  maxOccupancy: number
): string | null {
  const total = adults + children;
  if (total > maxOccupancy) {
    return `Total guests (${total}) exceeds room capacity (${maxOccupancy}).`;
  }
  if (adults < 1) {
    return `At least 1 adult is required.`;
  }
  return null;
}
