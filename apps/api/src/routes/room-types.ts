import type { FastifyPluginAsync } from "fastify";
import { roomTypes, rooms, bookings } from "@pms/db";
import { eq, and, or, sql } from "drizzle-orm";

export const roomTypesRoutes: FastifyPluginAsync = async (app) => {
  // List room types
  app.get<{ Querystring: { propertyId: string } }>(
    "/api/room-types",
    async (request) => {
      const { propertyId } = request.query;
      return app.db
        .select()
        .from(roomTypes)
        .where(eq(roomTypes.propertyId, propertyId))
        .orderBy(roomTypes.sortOrder);
    },
  );

  // Get single room type
  app.get<{ Params: { id: string } }>(
    "/api/room-types/:id",
    async (request, reply) => {
      const [roomType] = await app.db
        .select()
        .from(roomTypes)
        .where(eq(roomTypes.id, request.params.id));

      if (!roomType) return reply.status(404).send({ error: "Not found" });
      return roomType;
    }
  );

  // Create room type
  app.post<{
    Body: {
      propertyId: string;
      code: string;
      name: string;
      maxOccupancy?: number;
      baseRate: string;
      description?: string;
      sortOrder?: number;
    };
  }>("/api/room-types", async (request, reply) => {
    const [roomType] = await app.db
      .insert(roomTypes)
      .values({
        propertyId: request.body.propertyId,
        code: request.body.code,
        name: request.body.name,
        maxOccupancy: request.body.maxOccupancy || 2,
        baseRate: request.body.baseRate,
        description: request.body.description,
        sortOrder: request.body.sortOrder || 0,
      })
      .returning();

    return reply.status(201).send(roomType);
  });

  // Update room type
  app.put<{
    Params: { id: string };
    Body: {
      code?: string;
      name?: string;
      maxOccupancy?: number;
      baseRate?: string;
      description?: string;
      sortOrder?: number;
    };
  }>("/api/room-types/:id", async (request, reply) => {
    const [updated] = await app.db
      .update(roomTypes)
      .set({ ...request.body, updatedAt: new Date() })
      .where(eq(roomTypes.id, request.params.id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });

  // Delete room type
  app.delete<{ Params: { id: string } }>(
    "/api/room-types/:id",
    async (request, reply) => {
      // Проверить наличие комнат этого типа
      const roomCount = await app.db
        .select({ count: sql<number>`count(*)` })
        .from(rooms)
        .where(eq(rooms.roomTypeId, request.params.id));

      if (Number(roomCount[0].count) > 0) {
        return reply.status(400).send({
          error: `Нельзя удалить: к этому типу привязано ${roomCount[0].count} номеров.`,
          code: "HAS_DEPENDENCIES",
        });
      }

      // Проверить наличие активных бронирований
      const bookingCount = await app.db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(
          eq(bookings.roomTypeId, request.params.id),
          or(eq(bookings.status, "confirmed"), eq(bookings.status, "checked_in"))
        ));

      if (Number(bookingCount[0].count) > 0) {
        return reply.status(400).send({
          error: `Нельзя удалить: есть ${bookingCount[0].count} активных бронирований этого типа.`,
          code: "HAS_ACTIVE_BOOKINGS",
        });
      }

      const [deleted] = await app.db
        .delete(roomTypes)
        .where(eq(roomTypes.id, request.params.id))
        .returning();

      if (!deleted) return reply.status(404).send({ error: "Not found" });
      return { success: true };
    }
  );
};
