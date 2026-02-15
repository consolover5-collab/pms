import type { FastifyPluginAsync } from "fastify";
import { transactionCodes } from "@pms/db";
import { eq, and } from "drizzle-orm";
import { isValidUuid } from "../lib/validation";

export const transactionCodesRoutes: FastifyPluginAsync = async (app) => {
  // List active transaction codes for a property
  app.get<{
    Querystring: { propertyId?: string };
  }>("/api/transaction-codes", async (request, reply) => {
    const { propertyId } = request.query;
    if (!propertyId) {
      return reply.status(400).send({ error: "propertyId is required" });
    }
    if (!isValidUuid(propertyId)) {
      return reply.status(400).send({ error: "Invalid propertyId format" });
    }

    const result = await app.db
      .select()
      .from(transactionCodes)
      .where(
        and(
          eq(transactionCodes.propertyId, propertyId),
          eq(transactionCodes.isActive, true),
        ),
      )
      .orderBy(transactionCodes.sortOrder);

    return result;
  });
};
