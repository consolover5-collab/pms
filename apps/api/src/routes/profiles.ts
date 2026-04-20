import type { FastifyPluginAsync } from "fastify";
import { profiles, bookings } from "@pms/db";
import { eq, ilike, or, and, count, sql } from "drizzle-orm";

export const profilesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: {
      propertyId: string;
      type?: string;
      q?: string;
      limit?: string;
      offset?: string;
    };
  }>("/api/profiles", async (request) => {
    const { propertyId, type, q, limit, offset } = request.query;
    if (!propertyId) {
      return { data: [], total: 0 };
    }

    const maxResults = Math.min(Number(limit) || 50, 100);
    const skip = Math.max(Number(offset) || 0, 0);

    const conditions = [eq(profiles.propertyId, propertyId)];

    if (type) {
      conditions.push(eq(profiles.type, type as any));
    }

    if (q && q.trim().length > 0) {
      conditions.push(
        or(
          ilike(profiles.name, `%${q.trim()}%`),
          ilike(profiles.email, `%${q.trim()}%`),
          ilike(profiles.phone, `%${q.trim()}%`),
          ilike(profiles.firstName, `%${q.trim()}%`),
          ilike(profiles.lastName, `%${q.trim()}%`),
          ilike(profiles.iataCode, `%${q.trim()}%`),
          ilike(profiles.sourceCode, `%${q.trim()}%`),
        )!,
      );
    }

    const where = and(...conditions);

    const [totalResult] = await app.db
      .select({ count: count() })
      .from(profiles)
      .where(where);

    const data = await app.db
      .select()
      .from(profiles)
      .where(where)
      .orderBy(profiles.name)
      .limit(maxResults)
      .offset(skip);

    return { data, total: totalResult.count };
  });

  app.get<{ Params: { id: string } }>(
    "/api/profiles/:id",
    async (request, reply) => {
      const [profile] = await app.db
        .select()
        .from(profiles)
        .where(eq(profiles.id, request.params.id));
      if (!profile) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });
      return profile;
    },
  );

  app.post<{
    Body: {
      propertyId: string;
      type: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      notes?: string;
      dateOfBirth?: string;
      nationality?: string;
      gender?: string;
      language?: string;
      passportNumber?: string;
      documentType?: string;
      vipStatus?: string;
      shortName?: string;
      taxId?: string;
      registrationNumber?: string;
      address?: string;
      creditLimit?: string;
      paymentTermDays?: number;
      arAccountNumber?: string;
      iataCode?: string;
      commissionPercent?: string;
      sourceCode?: string;
      channelType?: string;
      contactPerson?: string;
      contactTitle?: string;
      force?: boolean;
    };
  }>("/api/profiles", async (request, reply) => {
    const { propertyId, type, force, channelType, ...rest } = request.body;

    if (!propertyId || !type) {
      return reply.status(400).send({ error: "propertyId and type are required", code: "MISSING_FIELDS" });
    }

    const validTypes = ["individual", "company", "travel_agent", "source", "contact"];
    if (!validTypes.includes(type)) {
      return reply.status(400).send({ error: `Invalid profile type: ${type}`, code: "INVALID_PROFILE_TYPE" });
    }

    let name = rest.name || "";
    if (type === "individual" && !name) {
      name = [rest.firstName, rest.lastName].filter(Boolean).join(" ") || "Unknown";
    }
    if (!name) {
      return reply.status(400).send({ error: "name is required", code: "MISSING_NAME" });
    }

    if (type === "individual" && rest.firstName && rest.lastName && !force) {
      const possibleDuplicates = await app.db
        .select({ id: profiles.id, name: profiles.name, email: profiles.email })
        .from(profiles)
        .where(
          and(
            eq(profiles.propertyId, propertyId),
            eq(profiles.type, "individual" as any),
            ilike(profiles.firstName, rest.firstName),
            ilike(profiles.lastName, rest.lastName),
          ),
        )
        .limit(3);

      if (possibleDuplicates.length > 0) {
        return reply.status(409).send({
          error: `Found similar profile(s): ${possibleDuplicates.map((d) => `${d.name} (${d.email || "no email"})`).join(", ")}. Use force=true to create.`,
          code: "POSSIBLE_DUPLICATE",
          duplicates: possibleDuplicates,
        });
      }
    }

    const [profile] = await app.db
      .insert(profiles)
      .values({
        propertyId,
        type: type as any,
        name,
        ...rest,
        ...(channelType ? { channelType: channelType as any } : {}),
      })
      .returning();

    return reply.status(201).send(profile);
  });

  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      notes?: string;
      dateOfBirth?: string;
      nationality?: string;
      gender?: string;
      language?: string;
      passportNumber?: string;
      documentType?: string;
      vipStatus?: string;
      shortName?: string;
      taxId?: string;
      registrationNumber?: string;
      address?: string;
      creditLimit?: string;
      paymentTermDays?: number;
      arAccountNumber?: string;
      iataCode?: string;
      commissionPercent?: string;
      sourceCode?: string;
      channelType?: string;
      contactPerson?: string;
      contactTitle?: string;
      isActive?: boolean;
    };
  }>("/api/profiles/:id", async (request, reply) => {
    const { channelType: ctBody, ...restBody } = request.body;
    const [updated] = await app.db
      .update(profiles)
      .set({
        ...restBody,
        ...(ctBody ? { channelType: ctBody as any } : {}),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, request.params.id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });
    return updated;
  });

  app.delete<{
    Params: { id: string };
    Querystring: { propertyId: string };
  }>("/api/profiles/:id", async (request, reply) => {
    const { propertyId } = request.query;
    if (!propertyId) return reply.status(400).send({ error: "propertyId is required", code: "MISSING_PROPERTY_ID" });

    const [existing] = await app.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, request.params.id));
    if (!existing) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });

    const bookingCount = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(
        or(
          eq(bookings.guestProfileId, request.params.id),
          eq(bookings.companyProfileId, request.params.id),
          eq(bookings.agentProfileId, request.params.id),
          eq(bookings.sourceProfileId, request.params.id),
        ),
      );

    const countNum = Number(bookingCount[0].count);
    if (countNum > 0) {
      return reply.status(400).send({
        error: `Cannot delete profile: ${countNum} bookings are linked to this profile.`,
        code: "HAS_BOOKINGS",
        count: countNum,
      });
    }

    await app.db
      .update(profiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(profiles.id, request.params.id));

    return { success: true };
  });
};
