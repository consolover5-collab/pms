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
    return `Комната занята бронированием #${c.confirmationNumber} (${c.checkInDate} — ${c.checkOutDate}).`;
  }

  return null;
}

export function validateBookingDates(checkInDate: string, checkOutDate: string): string | null {
  if (!checkInDate || !checkOutDate) return null;
  if (checkInDate > checkOutDate) {
    return `Дата выезда (${checkOutDate}) не может быть раньше даты заезда (${checkInDate}).`;
  }
  return null;
}

/** Validate all preconditions for a room move (pure, no DB). Returns error message or null. */
export function validateRoomMove(
  booking: { status: string; roomId: string | null; roomTypeId: string },
  newRoom: { id: string; roomTypeId: string; occupancyStatus: string; housekeepingStatus: string },
): string | null {
  if (booking.status !== "checked_in") {
    return `Смена комнаты возможна только для заселённых броней (checked_in). Текущий статус: ${booking.status}.`;
  }
  if (newRoom.id === booking.roomId) {
    return `Нельзя переселить гостя в ту же комнату.`;
  }
  if (newRoom.roomTypeId !== booking.roomTypeId) {
    return `Тип новой комнаты не совпадает с типом бронирования.`;
  }
  if (newRoom.occupancyStatus !== "vacant") {
    return `Комната ${newRoom.id} занята (${newRoom.occupancyStatus}).`;
  }
  if (newRoom.housekeepingStatus !== "clean" && newRoom.housekeepingStatus !== "inspected") {
    return `Комната не готова к заселению (статус уборки: ${newRoom.housekeepingStatus}).`;
  }
  return null;
}

/** Validate that a checked_out booking can be reinstated: checkOutDate must be after businessDate */
export function validateReinstateCheckedOut(checkOutDate: string, businessDate: string): string | null {
  if (checkOutDate <= businessDate) {
    return `Нельзя восстановить: дата выезда (${checkOutDate}) уже прошла (бизнес-дата: ${businessDate}).`;
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
    return `Общее количество гостей (${total}) превышает вместимость номера (${maxOccupancy}).`;
  }
  if (adults < 1) {
    return `Должен быть минимум 1 взрослый.`;
  }
  return null;
}
