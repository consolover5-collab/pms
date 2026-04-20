import type { FastifyPluginAsync } from "fastify";
import { packages as packagesTable, ratePlanPackages } from "@pms/db";
import { eq, and, ilike, sql, count } from "drizzle-orm";

export const packagesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: { propertyId: string; q?: string };
  }>("/api/packages", async (request) => {
    const { propertyId, q } = request.query;
    const conditions = [eq(packagesTable.propertyId, propertyId)];
    if (q && q.trim()) {
      conditions.push(ilike(packagesTable.name, `%${q.trim()}%`));
    }
    const data = await app.db
      .select()
      .from(packagesTable)
      .where(and(...conditions))
      .orderBy(packagesTable.name);
    return { data };
  });

  app.get<{ Params: { id: string } }>(
    "/api/packages/:id",
    async (request, reply) => {
      const [pkg] = await app.db
        .select()
        .from(packagesTable)
        .where(eq(packagesTable.id, request.params.id));
      if (!pkg) return reply.status(404).send({ error: "Package not found", code: "PACKAGE_NOT_FOUND" });
      return pkg;
    },
  );

  app.post<{
    Body: {
      propertyId: string;
      code: string;
      name: string;
      description?: string;
      transactionCodeId: string;
      calculationRule?: string;
      amount?: string;
      postingRhythm?: string;
    };
  }>("/api/packages", async (request, reply) => {
    const { propertyId, code, name, description, transactionCodeId, calculationRule, amount, postingRhythm } = request.body;
    const [pkg] = await app.db
      .insert(packagesTable)
      .values({ propertyId, code, name, description, transactionCodeId, calculationRule, amount, postingRhythm })
      .returning();
    return reply.status(201).send(pkg);
  });

  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string;
      transactionCodeId?: string;
      calculationRule?: string;
      amount?: string;
      postingRhythm?: string;
      isActive?: boolean;
    };
  }>("/api/packages/:id", async (request, reply) => {
    const { name, description, transactionCodeId, calculationRule, amount, postingRhythm, isActive } = request.body;
    const [updated] = await app.db
      .update(packagesTable)
      .set({ name, description, transactionCodeId, calculationRule, amount, postingRhythm, isActive, updatedAt: new Date() })
      .where(eq(packagesTable.id, request.params.id))
      .returning();
    if (!updated) return reply.status(404).send({ error: "Package not found", code: "PACKAGE_NOT_FOUND" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>(
    "/api/packages/:id",
    async (request, reply) => {
      const [linked] = await app.db
        .select({ count: count() })
        .from(ratePlanPackages)
        .where(eq(ratePlanPackages.packageId, request.params.id));
      if (linked.count > 0) {
        return reply.status(400).send({
          error: `Cannot delete: package is linked to ${linked.count} rate plans`,
          code: "HAS_RATE_PLANS",
        });
      }
      const [deleted] = await app.db
        .delete(packagesTable)
        .where(eq(packagesTable.id, request.params.id))
        .returning();
      if (!deleted) return reply.status(404).send({ error: "Package not found", code: "PACKAGE_NOT_FOUND" });
      return { success: true };
    },
  );

  // === Rate Plan ↔ Package связи ===

  app.get<{ Params: { id: string } }>(
    "/api/rate-plans/:id/packages",
    async (request) => {
      const data = await app.db
        .select({
          id: ratePlanPackages.id,
          packageId: ratePlanPackages.packageId,
          includedInRate: ratePlanPackages.includedInRate,
          code: packagesTable.code,
          name: packagesTable.name,
          amount: packagesTable.amount,
          calculationRule: packagesTable.calculationRule,
        })
        .from(ratePlanPackages)
        .innerJoin(packagesTable, eq(ratePlanPackages.packageId, packagesTable.id))
        .where(eq(ratePlanPackages.ratePlanId, request.params.id));
      return { data };
    },
  );

  app.post<{
    Params: { id: string };
    Body: { packageId: string; includedInRate?: boolean };
  }>("/api/rate-plans/:id/packages", async (request, reply) => {
    const { packageId, includedInRate } = request.body;
    const [link] = await app.db
      .insert(ratePlanPackages)
      .values({
        ratePlanId: request.params.id,
        packageId,
        includedInRate: includedInRate ?? true,
      })
      .returning();
    return reply.status(201).send(link);
  });

  app.delete<{ Params: { ratePlanId: string; packageId: string } }>(
    "/api/rate-plans/:ratePlanId/packages/:packageId",
    async (request, reply) => {
      const [deleted] = await app.db
        .delete(ratePlanPackages)
        .where(
          and(
            eq(ratePlanPackages.ratePlanId, request.params.ratePlanId),
            eq(ratePlanPackages.packageId, request.params.packageId),
          ),
        )
        .returning();
      if (!deleted) return reply.status(404).send({ error: "Link not found", code: "LINK_NOT_FOUND" });
      return { success: true };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/packages/:id/rate-plans",
    async (request) => {
      const data = await app.db
        .select({
          ratePlanId: ratePlanPackages.ratePlanId,
          includedInRate: ratePlanPackages.includedInRate,
        })
        .from(ratePlanPackages)
        .where(eq(ratePlanPackages.packageId, request.params.id));
      return { data };
    },
  );

  app.put<{
    Params: { id: string };
    Body: { ratePlans: { ratePlanId: string; includedInRate: boolean }[] };
  }>("/api/packages/:id/rate-plans", async (request, reply) => {
    const packageId = request.params.id;
    const newPlans = request.body.ratePlans;

    await app.db.transaction(async (tx) => {
      await tx.delete(ratePlanPackages).where(eq(ratePlanPackages.packageId, packageId));
      if (newPlans && newPlans.length > 0) {
        await tx.insert(ratePlanPackages).values(
          newPlans.map((p) => ({
            packageId,
            ratePlanId: p.ratePlanId,
            includedInRate: p.includedInRate,
          }))
        );
      }
    });
    return { success: true };
  });

};
