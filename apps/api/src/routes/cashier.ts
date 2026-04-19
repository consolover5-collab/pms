import type { FastifyPluginAsync } from "fastify";
import { cashierSessions, folioTransactions } from "@pms/db";
import { eq, and, sql, desc } from "drizzle-orm";

export const cashierRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/cashier/open — открыть смену
  app.post<{
    Body: { propertyId: string; cashierNumber: number; openingBalance?: string };
  }>("/api/cashier/open", async (request, reply) => {
    const userId = (request as any).user?.id || null;

    const { propertyId, cashierNumber, openingBalance } = request.body;
    if (!propertyId || !cashierNumber) {
      return reply.status(400).send({ error: "propertyId and cashierNumber are required", code: "MISSING_FIELDS" });
    }

    // Проверить нет ли уже открытой смены на этом кассире
    const [existing] = await app.db
      .select()
      .from(cashierSessions)
      .where(
        and(
          eq(cashierSessions.propertyId, propertyId),
          eq(cashierSessions.cashierNumber, cashierNumber),
          eq(cashierSessions.status, "open"),
        ),
      );

    if (existing) {
      return reply.status(400).send({
        error: `Cashier #${cashierNumber} is already open. Close it first.`,
        code: "ALREADY_OPEN",
      });
    }

    try {
      const [session] = await app.db
        .insert(cashierSessions)
        .values({
          propertyId,
          userId,
          cashierNumber,
          openingBalance: openingBalance || "0",
        })
        .returning();
      return reply.status(201).send(session);
    } catch (err: any) {
      if (err.code === "23505") {
        return reply.status(400).send({
          error: `Cashier #${cashierNumber} is already in use by another user.`,
          code: "CASHIER_BUSY",
        });
      }
      throw err;
    }
  });

  // POST /api/cashier/close — закрыть смену
  app.post<{
    Body: { closingBalance?: string };
  }>("/api/cashier/close", async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ error: "Authorization required", code: "UNAUTHORIZED" });
    }

    const [session] = await app.db
      .select()
      .from(cashierSessions)
      .where(
        and(
          eq(cashierSessions.userId, userId),
          eq(cashierSessions.status, "open"),
        ),
      );

    if (!session) {
      return reply.status(400).send({ error: "No open session", code: "NO_OPEN_SESSION" });
    }

    const [closed] = await app.db
      .update(cashierSessions)
      .set({
        status: "closed",
        closedAt: new Date(),
        closingBalance: request.body.closingBalance || null,
      })
      .where(eq(cashierSessions.id, session.id))
      .returning();

    return closed;
  });

  // GET /api/cashier/current — текущая смена пользователя
  app.get("/api/cashier/current", async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({ error: "Authorization required", code: "UNAUTHORIZED" });
    }

    const [session] = await app.db
      .select()
      .from(cashierSessions)
      .where(
        and(
          eq(cashierSessions.userId, userId),
          eq(cashierSessions.status, "open"),
        ),
      );

    if (!session) {
      return { session: null };
    }

    // Посчитать итоги по транзакциям за эту смену
    const [summary] = await app.db
      .select({
        totalDebit: sql<string>`COALESCE(SUM(debit), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(credit), 0)`,
        transactionCount: sql<number>`count(*)`,
      })
      .from(folioTransactions)
      .where(eq(folioTransactions.cashierSessionId, session.id));

    return { session, summary };
  });

  // GET /api/cashier/sessions?propertyId=...
  app.get<{
    Querystring: { propertyId: string; limit?: string };
  }>("/api/cashier/sessions", async (request) => {
    const { propertyId } = request.query;
    const maxResults = Math.min(Number(request.query.limit) || 20, 100);

    const data = await app.db
      .select()
      .from(cashierSessions)
      .where(eq(cashierSessions.propertyId, propertyId))
      .orderBy(desc(cashierSessions.openedAt))
      .limit(maxResults);

    return { data };
  });
};
