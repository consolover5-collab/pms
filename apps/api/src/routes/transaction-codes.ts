import type { FastifyPluginAsync } from "fastify";
import { transactionCodes, folioTransactions } from "@pms/db";
import { eq, and, count } from "drizzle-orm";
import { isValidUuid } from "../lib/validation";

export const transactionCodesRoutes: FastifyPluginAsync = async (app) => {
  // List transaction codes for a property (active only by default)
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

  // Create transaction code
  app.post<{
    Body: {
      propertyId: string;
      code: string;
      description: string;
      groupCode: string;
      transactionType?: string;
      isManualPostAllowed?: boolean;
      sortOrder?: number;
    };
  }>("/api/transaction-codes", async (request, reply) => {
    const { propertyId, code, description, groupCode, transactionType, isManualPostAllowed, sortOrder } = request.body;
    if (!propertyId || !code || !description || !groupCode) {
      return reply.status(400).send({ error: "propertyId, code, description, groupCode — обязательные поля" });
    }
    if (!isValidUuid(propertyId)) {
      return reply.status(400).send({ error: "Invalid propertyId format" });
    }
    const [created] = await app.db
      .insert(transactionCodes)
      .values({
        propertyId,
        code: code.toUpperCase(),
        description,
        groupCode,
        transactionType: transactionType || "charge",
        isManualPostAllowed: isManualPostAllowed ?? true,
        sortOrder: sortOrder ?? 0,
      })
      .returning();
    return reply.status(201).send(created);
  });

  // Update transaction code
  app.put<{
    Params: { id: string };
    Body: {
      code?: string;
      description?: string;
      groupCode?: string;
      transactionType?: string;
      isManualPostAllowed?: boolean;
      isActive?: boolean;
      sortOrder?: number;
    };
  }>("/api/transaction-codes/:id", async (request, reply) => {
    if (!isValidUuid(request.params.id)) {
      return reply.status(400).send({ error: "Invalid id format" });
    }
    const [existing] = await app.db
      .select({ id: transactionCodes.id })
      .from(transactionCodes)
      .where(eq(transactionCodes.id, request.params.id));
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const body: Record<string, unknown> = { ...request.body };
    if (body.code) body.code = (body.code as string).toUpperCase();

    const [updated] = await app.db
      .update(transactionCodes)
      .set(body)
      .where(eq(transactionCodes.id, request.params.id))
      .returning();
    return updated;
  });

  // Delete (soft-delete: set isActive = false, block if folio usage exists)
  app.delete<{
    Params: { id: string };
    Querystring: { propertyId: string };
  }>("/api/transaction-codes/:id", async (request, reply) => {
    const { id } = request.params;
    const { propertyId } = request.query;
    if (!isValidUuid(id)) return reply.status(400).send({ error: "Invalid id format" });
    if (!propertyId) return reply.status(400).send({ error: "propertyId is required" });

    // Check for folio transaction usage before deleting
    const [usage] = await app.db
      .select({ cnt: count() })
      .from(folioTransactions)
      .where(eq(folioTransactions.transactionCodeId, id));

    if (Number(usage.cnt) > 0) {
      return reply.status(400).send({
        error: `Нельзя удалить: код используется в ${usage.cnt} транзакциях фолио (Фолио)`,
        code: "HAS_FOLIO_TRANSACTIONS",
      });
    }

    const [deleted] = await app.db
      .update(transactionCodes)
      .set({ isActive: false })
      .where(and(eq(transactionCodes.id, id), eq(transactionCodes.propertyId, propertyId)))
      .returning({ id: transactionCodes.id });

    if (!deleted) return reply.status(404).send({ error: "Not found" });
    return reply.status(204).send();
  });
};
