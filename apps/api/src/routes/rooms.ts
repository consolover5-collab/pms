import type { FastifyPluginAsync } from "fastify";
import { rooms, roomTypes } from "@pms/db";
import { eq } from "drizzle-orm";

export const roomsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: { propertyId: string };
  }>("/api/rooms", async (request) => {
    const { propertyId } = request.query;

    const result = await app.db
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
        },
      })
      .from(rooms)
      .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(rooms.propertyId, propertyId))
      .orderBy(rooms.roomNumber);

    return result;
  });

  app.get<{ Params: { id: string } }>(
    "/api/rooms/:id",
    async (request, reply) => {
      const [room] = await app.db
        .select()
        .from(rooms)
        .where(eq(rooms.id, request.params.id));
      if (!room) return reply.status(404).send({ error: "Not found" });
      return room;
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { housekeepingStatus?: string; occupancyStatus?: string };
  }>("/api/rooms/:id/status", async (request, reply) => {
    const { housekeepingStatus, occupancyStatus } = request.body;

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
