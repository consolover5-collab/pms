import type { FastifyPluginAsync } from "fastify";
import { ratePlans, bookings } from "@pms/db";
import { eq, and, ne, sql } from "drizzle-orm";

export const ratePlansRoutes: FastifyPluginAsync = async (app) => {
  // List rate plans for a property
  app.get<{
    Querystring: { propertyId: string };
  }>("/api/rate-plans", async (request) => {
    const { propertyId } = request.query;

    const result = await app.db
      .select()
      .from(ratePlans)
      .where(eq(ratePlans.propertyId, propertyId))
      .orderBy(ratePlans.name);

    return result;
  });

  // Get single rate plan
  app.get<{ Params: { id: string } }>(
    "/api/rate-plans/:id",
    async (request, reply) => {
      const [ratePlan] = await app.db
        .select()
        .from(ratePlans)
        .where(eq(ratePlans.id, request.params.id));

      if (!ratePlan) return reply.status(404).send({ error: "Not found" });
      return ratePlan;
    }
  );

  // Create rate plan
  app.post<{
    Body: {
      propertyId: string;
      code: string;
      name: string;
      description?: string;
      baseRate?: string;
      isDefault?: boolean;
      isActive?: boolean;
    };
  }>("/api/rate-plans", async (request, reply) => {
    const { propertyId, isDefault } = request.body;

    // If setting as default, unset all others for this property first
    if (isDefault) {
      await app.db
        .update(ratePlans)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(ratePlans.propertyId, propertyId), eq(ratePlans.isDefault, true)));
    }

    const [ratePlan] = await app.db
      .insert(ratePlans)
      .values({
        propertyId,
        code: request.body.code,
        name: request.body.name,
        description: request.body.description,
        baseRate: request.body.baseRate,
        isDefault: isDefault ?? false,
        isActive: request.body.isActive ?? true,
      })
      .returning();

    return reply.status(201).send(ratePlan);
  });

  // Update rate plan
  app.put<{
    Params: { id: string };
    Body: {
      code?: string;
      name?: string;
      description?: string;
      baseRate?: string;
      isDefault?: boolean;
      isActive?: boolean;
    };
  }>("/api/rate-plans/:id", async (request, reply) => {
    // If setting as default, look up propertyId and unset others
    if (request.body.isDefault) {
      const [existing] = await app.db
        .select({ propertyId: ratePlans.propertyId })
        .from(ratePlans)
        .where(eq(ratePlans.id, request.params.id));

      if (existing) {
        await app.db
          .update(ratePlans)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(ratePlans.propertyId, existing.propertyId),
              eq(ratePlans.isDefault, true),
              ne(ratePlans.id, request.params.id),
            )
          );
      }
    }

    const [updated] = await app.db
      .update(ratePlans)
      .set({ ...request.body, updatedAt: new Date() })
      .where(eq(ratePlans.id, request.params.id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });

  // Delete rate plan
  app.delete<{ Params: { id: string }; Querystring: { propertyId: string } }>(
    "/api/rate-plans/:id",
    async (request, reply) => {
      const { propertyId } = request.query;
      if (!propertyId) return reply.status(400).send({ error: "propertyId обязателен" });

      // Проверить наличие ЛЮБЫХ бронирований (включая историю)
      const bookingCount = await app.db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(eq(bookings.ratePlanId, request.params.id));

      const bookingCountNum = Number(bookingCount[0].count);
      if (bookingCountNum > 0) {
        return reply.status(400).send({
          error: `Нельзя удалить: ${bookingCountNum} бронирований ссылаются на этот тарифный план (Бронирования, Фолио)`,
          code: "HAS_BOOKINGS",
          count: bookingCountNum,
        });
      }

      const [deleted] = await app.db
        .delete(ratePlans)
        .where(and(eq(ratePlans.id, request.params.id), eq(ratePlans.propertyId, propertyId)))
        .returning();

      if (!deleted) return reply.status(404).send({ error: "Not found" });
      return { success: true };
    }
  );
};
