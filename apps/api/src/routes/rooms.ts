import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { rooms, roomTypes } from "@pms/db";
import { eq, and } from "drizzle-orm";

// Допустимые переходы housekeeping-статусов (Opera workflow)
const hkTransitions: Record<string, string[]> = {
  dirty:          ["clean", "pickup", "out_of_order", "out_of_service"],
  pickup:         ["clean", "dirty", "out_of_order", "out_of_service"],
  clean:          ["inspected", "dirty", "out_of_order", "out_of_service"],
  inspected:      ["dirty", "clean", "out_of_order", "out_of_service"],
  out_of_order:   ["dirty", "clean"],
  out_of_service: ["dirty", "clean"],
};

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
          error: `Нельзя изменить статус с "${currentRoom.housekeepingStatus}" на "${housekeepingStatus}". Допустимые переходы: ${allowed.join(", ")}.`,
          code: "INVALID_HK_TRANSITION",
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
    Body: { housekeepingStatus?: string; occupancyStatus?: string };
  }>("/api/rooms/:id/status", async (request, reply) => {
    const { housekeepingStatus, occupancyStatus } = request.body;

    const valid = await validateRoomStatusUpdate(app.db, request.params.id, housekeepingStatus, occupancyStatus, reply);
    if (!valid) return;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (housekeepingStatus) updates.housekeepingStatus = housekeepingStatus;
    if (occupancyStatus) updates.occupancyStatus = occupancyStatus;

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
    Body: { housekeepingStatus?: string; occupancyStatus?: string };
  }>("/api/rooms/:id/status", async (request, reply) => {
    const { housekeepingStatus, occupancyStatus } = request.body;

    const valid = await validateRoomStatusUpdate(app.db, request.params.id, housekeepingStatus, occupancyStatus, reply);
    if (!valid) return;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (housekeepingStatus) updates.housekeepingStatus = housekeepingStatus;
    if (occupancyStatus) updates.occupancyStatus = occupancyStatus;

    const [updated] = await app.db
      .update(rooms)
      .set(updates)
      .where(eq(rooms.id, request.params.id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });
};
