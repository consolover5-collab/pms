import type { FastifyPluginAsync } from "fastify";
import { guests } from "@pms/db";
import { eq, or, ilike } from "drizzle-orm";

export const guestsRoutes: FastifyPluginAsync = async (app) => {
  // Search guests by name, email, or phone
  app.get<{
    Querystring: { q?: string; limit?: string };
  }>("/api/guests", async (request) => {
    const { q, limit } = request.query;
    const maxResults = Math.min(Number(limit) || 50, 100);

    let query = app.db
      .select()
      .from(guests)
      .limit(maxResults)
      .orderBy(guests.lastName, guests.firstName);

    if (q && q.trim().length > 0) {
      const pattern = `%${q.trim()}%`;
      query = query.where(
        or(
          ilike(guests.firstName, pattern),
          ilike(guests.lastName, pattern),
          ilike(guests.email, pattern),
          ilike(guests.phone, pattern),
        ),
      ) as typeof query;
    }

    return query;
  });

  // Get single guest
  app.get<{ Params: { id: string } }>(
    "/api/guests/:id",
    async (request, reply) => {
      const [guest] = await app.db
        .select()
        .from(guests)
        .where(eq(guests.id, request.params.id));
      if (!guest) return reply.status(404).send({ error: "Not found" });
      return guest;
    },
  );

  // Create guest
  app.post<{
    Body: {
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      documentType?: string;
      documentNumber?: string;
      nationality?: string;
      gender?: string;
      language?: string;
      dateOfBirth?: string;
      vipStatus?: number;
      notes?: string;
    };
  }>("/api/guests", async (request, reply) => {
    const [guest] = await app.db
      .insert(guests)
      .values(request.body)
      .returning();
    return reply.status(201).send(guest);
  });

  // Update guest
  app.put<{
    Params: { id: string };
    Body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      documentType?: string;
      documentNumber?: string;
      nationality?: string;
      gender?: string;
      language?: string;
      dateOfBirth?: string;
      vipStatus?: number;
      notes?: string;
    };
  }>("/api/guests/:id", async (request, reply) => {
    const [updated] = await app.db
      .update(guests)
      .set({ ...request.body, updatedAt: new Date() })
      .where(eq(guests.id, request.params.id))
      .returning();
    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });
};
