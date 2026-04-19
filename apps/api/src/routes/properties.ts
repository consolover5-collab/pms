import type { FastifyPluginAsync } from "fastify";
import { properties, rooms } from "@pms/db";
import { eq, count } from "drizzle-orm";

export const propertiesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/properties", async () => {
    return app.db.select().from(properties);
  });

  app.get<{ Params: { id: string } }>(
    "/api/properties/:id",
    async (request, reply) => {
      const [property] = await app.db
        .select()
        .from(properties)
        .where(eq(properties.id, request.params.id));
      if (!property) return reply.status(404).send({ error: "Not found" });
      return property;
    },
  );

  // Update property
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      code?: string;
      address?: string;
      city?: string;
      country?: string;
      timezone?: string;
      currency?: string;
      checkInTime?: string;
      checkOutTime?: string;
      numberOfRooms?: number;
      numberOfFloors?: number;
      taxRate?: string;
    };
  }>("/api/properties/:id", async (request, reply) => {
    if (request.body.numberOfRooms !== undefined) {
      const [roomCount] = await app.db
        .select({ count: count() })
        .from(rooms)
        .where(eq(rooms.propertyId, request.params.id));
      if (request.body.numberOfRooms < Number(roomCount.count)) {
        return reply.status(400).send({
          error: `Cannot set number of rooms to ${request.body.numberOfRooms}: system already has ${roomCount.count} rooms. Delete excess rooms or increase the value.`, code: "INVALID_ROOM_COUNT",
        });
      }
    }

    const [updated] = await app.db
      .update(properties)
      .set({ ...request.body, updatedAt: new Date() })
      .where(eq(properties.id, request.params.id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });
};
