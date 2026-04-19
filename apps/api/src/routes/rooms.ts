import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { rooms, roomTypes, bookings } from "@pms/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { VALID_HK_TRANSITIONS } from "@pms/domain";

// Use domain state machine as single source of truth
const hkTransitions: Record<string, string[]> = VALID_HK_TRANSITIONS;

const validHkStatuses = [
  "clean", "dirty", "pickup", "inspected", "out_of_order", "out_of_service",
];
const validOccStatuses = ["vacant", "occupied"];

/** Shared validation for room status updates. Returns error reply or null if valid. */
async function validateRoomStatusUpdate(
  db: any,
  roomId: string,
  housekeepingStatus: string | undefined,
  occupancyStatus: string | undefined,
  reply: FastifyReply,
): Promise<boolean> {
  if (housekeepingStatus && !validHkStatuses.includes(housekeepingStatus)) {
    reply.status(400).send({ error: "Invalid housekeeping status" });
    return false;
  }
  if (occupancyStatus && !validOccStatuses.includes(occupancyStatus)) {
    reply.status(400).send({ error: "Invalid occupancy status" });
    return false;
  }

  // Validate HK transition
  if (housekeepingStatus) {
    const [currentRoom] = await db
      .select({ housekeepingStatus: rooms.housekeepingStatus })
      .from(rooms)
      .where(eq(rooms.id, roomId));

    if (currentRoom) {
      const allowed = hkTransitions[currentRoom.housekeepingStatus];
      if (allowed && !allowed.includes(housekeepingStatus)) {
        reply.status(400).send({
          error: `Cannot change status from "${currentRoom.housekeepingStatus}" to "${housekeepingStatus}". Allowed transitions: ${allowed.join(", ")}.`, code: "INVALID_HK_TRANSITION",
          currentStatus: currentRoom.housekeepingStatus,
          allowedTransitions: allowed,
        });
        return false;
      }
    }
  }

  return true;
}

export const roomsRoutes: FastifyPluginAsync = async (app) => {
  // List rooms with optional filters
  app.get<{
    Querystring: {
      propertyId: string;
      housekeepingStatus?: string;
      occupancyStatus?: string;
      roomTypeId?: string;
    };
  }>("/api/rooms", async (request) => {
    const { propertyId, housekeepingStatus, occupancyStatus, roomTypeId } =
      request.query;

    const conditions = [eq(rooms.propertyId, propertyId)];
    if (housekeepingStatus) {
      conditions.push(eq(rooms.housekeepingStatus, housekeepingStatus));
    }
    if (occupancyStatus) {
      conditions.push(eq(rooms.occupancyStatus, occupancyStatus));
    }
    if (roomTypeId) {
      conditions.push(eq(rooms.roomTypeId, roomTypeId));
    }

    const result = await app.db
      .select({
        id: rooms.id,
        roomNumber: rooms.roomNumber,
        floor: rooms.floor,
        housekeepingStatus: rooms.housekeepingStatus,
        occupancyStatus: rooms.occupancyStatus,
        oooFromDate: rooms.oooFromDate,
        oooToDate: rooms.oooToDate,
        returnStatus: rooms.returnStatus,
        roomTypeId: rooms.roomTypeId,
        roomType: {
          id: roomTypes.id,
          name: roomTypes.name,
          code: roomTypes.code,
        },
      })
      .from(rooms)
      .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(and(...conditions))
      .orderBy(rooms.floor, rooms.roomNumber);

    return result;
  });

  // Get single room with room type info
  app.get<{ Params: { id: string } }>(
    "/api/rooms/:id",
    async (request, reply) => {
      const [room] = await app.db
        .select({
          id: rooms.id,
          roomNumber: rooms.roomNumber,
          floor: rooms.floor,
          housekeepingStatus: rooms.housekeepingStatus,
          occupancyStatus: rooms.occupancyStatus,
          oooFromDate: rooms.oooFromDate,
          oooToDate: rooms.oooToDate,
          returnStatus: rooms.returnStatus,
          propertyId: rooms.propertyId,
          roomType: {
            id: roomTypes.id,
            name: roomTypes.name,
            code: roomTypes.code,
            maxOccupancy: roomTypes.maxOccupancy,
            description: roomTypes.description,
          },
        })
        .from(rooms)
        .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
        .where(eq(rooms.id, request.params.id));

      if (!room) return reply.status(404).send({ error: "Not found" });
      return room;
    }
  );

  // Update room status (POST for convenience)
  app.post<{
    Params: { id: string };
    Body: {
      housekeepingStatus?: string;
      occupancyStatus?: string;
      oooFromDate?: string;  // YYYY-MM-DD
      oooToDate?: string;    // YYYY-MM-DD, включительно
      returnStatus?: string; // clean | dirty
    };
  }>("/api/rooms/:id/status", async (request, reply) => {
    const { housekeepingStatus, occupancyStatus, oooFromDate, oooToDate, returnStatus } = request.body;

    const valid = await validateRoomStatusUpdate(app.db, request.params.id, housekeepingStatus, occupancyStatus, reply);
    if (!valid) return;

    // OOO/OOS specific validations (B-02, B-05)
    if (housekeepingStatus === "out_of_order" || housekeepingStatus === "out_of_service") {
      const [room] = await app.db
        .select({ occupancyStatus: rooms.occupancyStatus })
        .from(rooms)
        .where(eq(rooms.id, request.params.id));

      // B-05a: Нельзя OOO если комната занята
      if (room?.occupancyStatus === "occupied") {
        return reply.status(400).send({
          error: "Cannot set occupied room to Out of Order. Perform checkout first.", code: "ROOM_IS_OCCUPIED",
        });
      }

      // B-02: Даты OOO обязательны
      if (!oooFromDate || !oooToDate) {
        return reply.status(400).send({
          error: "Start and end dates are required for OOO/OOS.", code: "OOO_DATES_REQUIRED",
        });
      }

      // B-05b: Нельзя OOO если есть активные брони в периоде
      const conflictingBookings = await app.db
        .select({ id: bookings.id, confirmationNumber: bookings.confirmationNumber })
        .from(bookings)
        .where(
          and(
            eq(bookings.roomId, request.params.id),
            inArray(bookings.status, ["confirmed", "checked_in"]),
            sql`${bookings.checkInDate} < ${oooToDate}`,
            sql`${bookings.checkOutDate} > ${oooFromDate}`,
          ),
        );

      if (conflictingBookings.length > 0) {
        return reply.status(400).send({
          error: `Cannot set Out of Order: room is booked for this period (${conflictingBookings.length} booking(s)).`, code: "ROOM_HAS_BOOKINGS_IN_PERIOD",
          conflictingBookings: conflictingBookings.map((b) => b.confirmationNumber),
        });
      }
    }

    // Валидация дат OOO
    if (oooToDate && oooFromDate && oooToDate < oooFromDate) {
      return reply.status(400).send({
        error: "OOO end date cannot be before start date.", code: "INVALID_OOO_DATES",
      });
    }
    if (returnStatus && !["clean", "dirty"].includes(returnStatus)) {
      return reply.status(400).send({
        error: "Return status must be clean or dirty.", code: "INVALID_RETURN_STATUS",
      });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (housekeepingStatus) updates.housekeepingStatus = housekeepingStatus;
    if (occupancyStatus) updates.occupancyStatus = occupancyStatus;
    if (oooFromDate !== undefined) updates.oooFromDate = oooFromDate;
    if (oooToDate !== undefined) updates.oooToDate = oooToDate;
    if (returnStatus !== undefined) updates.returnStatus = returnStatus;

    // При снятии OOO/OOS — очищать даты автоматически
    if (housekeepingStatus && housekeepingStatus !== "out_of_order" && housekeepingStatus !== "out_of_service") {
      updates.oooFromDate = null;
      updates.oooToDate = null;
      updates.returnStatus = null;
    }

    const [updated] = await app.db
      .update(rooms)
      .set(updates)
      .where(eq(rooms.id, request.params.id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });

  // PATCH version (keeping for compatibility, same validation as POST)
  app.patch<{
    Params: { id: string };
    Body: {
      housekeepingStatus?: string;
      occupancyStatus?: string;
      oooFromDate?: string;
      oooToDate?: string;
      returnStatus?: string;
    };
  }>("/api/rooms/:id/status", async (request, reply) => {
    const { housekeepingStatus, occupancyStatus, oooFromDate, oooToDate, returnStatus } = request.body;

    const valid = await validateRoomStatusUpdate(app.db, request.params.id, housekeepingStatus, occupancyStatus, reply);
    if (!valid) return;

    if (housekeepingStatus === "out_of_order" || housekeepingStatus === "out_of_service") {
      const [room] = await app.db
        .select({ occupancyStatus: rooms.occupancyStatus })
        .from(rooms)
        .where(eq(rooms.id, request.params.id));

      if (room?.occupancyStatus === "occupied") {
        return reply.status(400).send({
          error: "Cannot set occupied room to Out of Order. Perform checkout first.", code: "ROOM_IS_OCCUPIED",
        });
      }

      if (!oooFromDate || !oooToDate) {
        return reply.status(400).send({
          error: "Start and end dates are required for OOO/OOS.", code: "OOO_DATES_REQUIRED",
        });
      }

      const conflictingBookings = await app.db
        .select({ id: bookings.id, confirmationNumber: bookings.confirmationNumber })
        .from(bookings)
        .where(
          and(
            eq(bookings.roomId, request.params.id),
            inArray(bookings.status, ["confirmed", "checked_in"]),
            sql`${bookings.checkInDate} < ${oooToDate}`,
            sql`${bookings.checkOutDate} > ${oooFromDate}`,
          ),
        );

      if (conflictingBookings.length > 0) {
        return reply.status(400).send({
          error: `Cannot set Out of Order: room is booked for this period (${conflictingBookings.length} booking(s)).`, code: "ROOM_HAS_BOOKINGS_IN_PERIOD",
          conflictingBookings: conflictingBookings.map((b) => b.confirmationNumber),
        });
      }
    }

    if (oooToDate && oooFromDate && oooToDate < oooFromDate) {
      return reply.status(400).send({
        error: "OOO end date cannot be before start date.", code: "INVALID_OOO_DATES",
      });
    }
    if (returnStatus && !["clean", "dirty"].includes(returnStatus)) {
      return reply.status(400).send({
        error: "Return status must be clean or dirty.", code: "INVALID_RETURN_STATUS",
      });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (housekeepingStatus) updates.housekeepingStatus = housekeepingStatus;
    if (occupancyStatus) updates.occupancyStatus = occupancyStatus;
    if (oooFromDate !== undefined) updates.oooFromDate = oooFromDate;
    if (oooToDate !== undefined) updates.oooToDate = oooToDate;
    if (returnStatus !== undefined) updates.returnStatus = returnStatus;

    if (housekeepingStatus && housekeepingStatus !== "out_of_order" && housekeepingStatus !== "out_of_service") {
      updates.oooFromDate = null;
      updates.oooToDate = null;
      updates.returnStatus = null;
    }

    const [updated] = await app.db
      .update(rooms)
      .set(updates)
      .where(eq(rooms.id, request.params.id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });

  // Edit room properties (type, number, floor)
  app.put<{
    Params: { id: string };
    Body: { roomTypeId?: string; roomNumber?: string; floor?: number | null };
  }>("/api/rooms/:id", async (request, reply) => {
    const [room] = await app.db.select().from(rooms).where(eq(rooms.id, request.params.id));
    if (!room) return reply.status(404).send({ error: "Not found" });

    if (room.occupancyStatus === "occupied") {
      return reply.status(400).send({
        error: "Cannot change parameters of an occupied room. Wait for guest check-out.", code: "ROOM_OCCUPIED",
      });
    }

    // Проверка нового типа комнаты
    if (request.body.roomTypeId) {
      const [rt] = await app.db.select({ id: roomTypes.id }).from(roomTypes).where(eq(roomTypes.id, request.body.roomTypeId));
      if (!rt) return reply.status(400).send({ error: "Room type not found", code: "ROOM_TYPE_NOT_FOUND" });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (request.body.roomTypeId !== undefined) updates.roomTypeId = request.body.roomTypeId;
    if (request.body.roomNumber !== undefined) updates.roomNumber = request.body.roomNumber;
    if ("floor" in request.body) updates.floor = request.body.floor;

    const [updated] = await app.db.update(rooms).set(updates).where(eq(rooms.id, request.params.id)).returning();
    return updated;
  });

  // Delete room
  app.delete<{ Params: { id: string } }>(
    "/api/rooms/:id",
    async (request, reply) => {
      // Check for any bookings referencing this room (RESTRICT policy)
      const bookingCount = await app.db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(eq(bookings.roomId, request.params.id));

      const bookingCountNum = Number(bookingCount[0].count);
      if (bookingCountNum > 0) {
        return reply.status(400).send({
          error: `Cannot delete room: ${bookingCountNum} bookings are linked to this room. Related functions: Bookings, Folio.`, code: "HAS_BOOKINGS",
          count: bookingCountNum,
        });
      }

      const [deleted] = await app.db
        .delete(rooms)
        .where(eq(rooms.id, request.params.id))
        .returning();

      if (!deleted) return reply.status(404).send({ error: "Not found" });
      return { success: true };
    }
  );
};
