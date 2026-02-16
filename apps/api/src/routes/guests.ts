import type { FastifyPluginAsync } from "fastify";
import { guests } from "@pms/db";
import { eq, or, ilike, and } from "drizzle-orm";

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
      propertyId: string;
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
      force?: boolean;
    };
  }>("/api/guests", async (request, reply) => {
    // Проверка дубликатов
    const possibleDuplicates = await app.db
      .select({ id: guests.id, firstName: guests.firstName, lastName: guests.lastName, email: guests.email })
      .from(guests)
      .where(
        and(
          ilike(guests.firstName, request.body.firstName),
          ilike(guests.lastName, request.body.lastName),
        )
      )
      .limit(3);

    if (possibleDuplicates.length > 0 && !request.body.force) {
      return reply.status(409).send({
        error: `Найден(ы) похожий(е) профиль(и): ${possibleDuplicates.map(d => `${d.firstName} ${d.lastName} (${d.email || "без email"})`).join(", ")}. Используйте force=true для создания.`,
        code: "POSSIBLE_DUPLICATE",
        duplicates: possibleDuplicates,
      });
    }

    const { force: _force, ...guestData } = request.body;
    const [guest] = await app.db
      .insert(guests)
      .values(guestData)
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
