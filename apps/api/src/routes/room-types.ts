import type { FastifyPluginAsync } from "fastify";
import { roomTypes, rooms, bookings } from "@pms/db";
import { eq, and, sql } from "drizzle-orm";

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
      baseRate?: string;
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
  app.delete<{ Params: { id: string }; Querystring: { propertyId: string } }>(
    "/api/room-types/:id",
    async (request, reply) => {
      const { propertyId } = request.query;
      if (!propertyId) return reply.status(400).send({ error: "propertyId обязателен" });
      // Проверить наличие комнат этого типа
      const roomCount = await app.db
        .select({ count: sql<number>`count(*)` })
        .from(rooms)
        .where(eq(rooms.roomTypeId, request.params.id));

      const roomCountNum = Number(roomCount[0].count);
      if (roomCountNum > 0) {
        return reply.status(400).send({
          error: `Cannot delete: ${roomCountNum} rooms of this type exist`,
          code: "HAS_DEPENDENCIES",
          count: roomCountNum,
        });
      }

      // Проверить наличие ЛЮБЫХ бронирований (включая историю)
      const bookingCount = await app.db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(eq(bookings.roomTypeId, request.params.id));

      const bookingCountNum = Number(bookingCount[0].count);
      if (bookingCountNum > 0) {
        return reply.status(400).send({
          error: `Нельзя удалить: ${bookingCountNum} бронирований ссылаются на этот тип комнаты (Бронирования, Фолио)`,
          code: "HAS_BOOKINGS",
          count: bookingCountNum,
        });
      }

      const [deleted] = await app.db
        .delete(roomTypes)
        .where(and(eq(roomTypes.id, request.params.id), eq(roomTypes.propertyId, propertyId)))
        .returning();

      if (!deleted) return reply.status(404).send({ error: "Not found" });
      return { success: true };
    }
  );
};
