import type { FastifyPluginAsync } from "fastify";
import {
  folioTransactions,
  transactionCodes,
  businessDates,
  bookings,
} from "@pms/db";
import { eq, and, desc } from "drizzle-orm";
import { calculateFolioBalance } from "@pms/domain";
import { isValidUuid } from "../lib/validation";

export const folioRoutes: FastifyPluginAsync = async (app) => {
  // Get folio for a booking
  app.get<{
    Params: { bookingId: string };
  }>("/api/bookings/:bookingId/folio", async (request, reply) => {
    const { bookingId } = request.params;
    if (!isValidUuid(bookingId)) {
      return reply.status(400).send({ error: "Invalid bookingId format" });
    }

    // Verify booking exists
    const [booking] = await app.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    const transactions = await app.db
      .select({
        id: folioTransactions.id,
        date: businessDates.date,
        transactionCode: {
          code: transactionCodes.code,
          description: transactionCodes.description,
        },
        debit: folioTransactions.debit,
        credit: folioTransactions.credit,
        description: folioTransactions.description,
        isSystemGenerated: folioTransactions.isSystemGenerated,
        appliedTaxRate: folioTransactions.appliedTaxRate,
        postedBy: folioTransactions.postedBy,
        createdAt: folioTransactions.createdAt,
      })
      .from(folioTransactions)
      .innerJoin(
        businessDates,
        eq(folioTransactions.businessDateId, businessDates.id),
      )
      .innerJoin(
        transactionCodes,
        eq(folioTransactions.transactionCodeId, transactionCodes.id),
      )
      .where(eq(folioTransactions.bookingId, bookingId))
      .orderBy(desc(folioTransactions.createdAt));

    const balance = calculateFolioBalance(transactions);
    let totalCharges = 0;
    let totalPayments = 0;
    for (const t of transactions) {
      totalCharges += parseFloat(t.debit);
      totalPayments += parseFloat(t.credit);
    }

    return {
      balance: Math.round(balance * 100) / 100,
      transactions,
      summary: {
        totalCharges: Math.round(totalCharges * 100) / 100,
        totalPayments: Math.round(totalPayments * 100) / 100,
      },
    };
  });

  // Post a charge to a booking's folio
  app.post<{
    Params: { bookingId: string };
    Body: {
      transactionCodeId: string;
      amount: number;
      description?: string;
    };
  }>("/api/bookings/:bookingId/folio/post", async (request, reply) => {
    const { bookingId } = request.params;
    if (!isValidUuid(bookingId)) {
      return reply.status(400).send({ error: "Invalid bookingId format" });
    }
    const { transactionCodeId, amount, description } = request.body;

    if (!transactionCodeId || !amount || amount <= 0) {
      return reply
        .status(400)
        .send({ error: "transactionCodeId and positive amount are required" });
    }
    if (!isValidUuid(transactionCodeId)) {
      return reply.status(400).send({ error: "Invalid transactionCodeId format" });
    }

    // Verify booking
    const [booking] = await app.db
      .select({ id: bookings.id, propertyId: bookings.propertyId })
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    // Verify transaction code
    const [code] = await app.db
      .select()
      .from(transactionCodes)
      .where(eq(transactionCodes.id, transactionCodeId));

    if (!code) {
      return reply.status(404).send({ error: "Transaction code not found" });
    }

    if (!code.isManualPostAllowed) {
      return reply
        .status(400)
        .send({ error: "This transaction code is system-only" });
    }

    // Get open business date
    const [bizDate] = await app.db
      .select({ id: businessDates.id })
      .from(businessDates)
      .where(
        and(
          eq(businessDates.propertyId, booking.propertyId),
          eq(businessDates.status, "open"),
        ),
      );

    if (!bizDate) {
      return reply
        .status(400)
        .send({ error: "No open business date" });
    }

    const isPayment = code.transactionType === "payment";

    const [created] = await app.db
      .insert(folioTransactions)
      .values({
        propertyId: booking.propertyId,
        bookingId,
        businessDateId: bizDate.id,
        transactionCodeId,
        debit: isPayment ? "0" : String(amount),
        credit: isPayment ? String(amount) : "0",
        description: description || code.description,
        isSystemGenerated: false,
        postedBy: "user:front_desk",
      })
      .returning();

    return reply.status(201).send(created);
  });

  // Post a payment
  app.post<{
    Params: { bookingId: string };
    Body: { transactionCodeId: string; amount: number };
  }>("/api/bookings/:bookingId/folio/payment", async (request, reply) => {
    const { bookingId } = request.params;
    if (!isValidUuid(bookingId)) {
      return reply.status(400).send({ error: "Invalid bookingId format" });
    }
    const { transactionCodeId, amount } = request.body;

    if (!transactionCodeId || !amount || amount <= 0) {
      return reply
        .status(400)
        .send({ error: "transactionCodeId and positive amount are required" });
    }
    if (!isValidUuid(transactionCodeId)) {
      return reply.status(400).send({ error: "Invalid transactionCodeId format" });
    }

    const [booking] = await app.db
      .select({ id: bookings.id, propertyId: bookings.propertyId })
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    const [code] = await app.db
      .select()
      .from(transactionCodes)
      .where(eq(transactionCodes.id, transactionCodeId));

    if (!code || code.transactionType !== "payment") {
      return reply
        .status(400)
        .send({ error: "Invalid payment transaction code" });
    }

    const [bizDate] = await app.db
      .select({ id: businessDates.id })
      .from(businessDates)
      .where(
        and(
          eq(businessDates.propertyId, booking.propertyId),
          eq(businessDates.status, "open"),
        ),
      );

    if (!bizDate) {
      return reply.status(400).send({ error: "No open business date" });
    }

    const [created] = await app.db
      .insert(folioTransactions)
      .values({
        propertyId: booking.propertyId,
        bookingId,
        businessDateId: bizDate.id,
        transactionCodeId,
        debit: "0",
        credit: String(amount),
        description: code.description,
        isSystemGenerated: false,
        postedBy: "user:front_desk",
      })
      .returning();

    return reply.status(201).send(created);
  });

  // Adjust (reverse) a transaction
  app.post<{
    Params: { bookingId: string };
    Body: { transactionId: string; reason: string };
  }>("/api/bookings/:bookingId/folio/adjust", async (request, reply) => {
    const { bookingId } = request.params;
    if (!isValidUuid(bookingId)) {
      return reply.status(400).send({ error: "Invalid bookingId format" });
    }
    const { transactionId, reason } = request.body;

    if (!transactionId || !reason) {
      return reply
        .status(400)
        .send({ error: "transactionId and reason are required" });
    }
    if (!isValidUuid(transactionId)) {
      return reply.status(400).send({ error: "Invalid transactionId format" });
    }

    // Get original transaction
    const [original] = await app.db
      .select()
      .from(folioTransactions)
      .where(
        and(
          eq(folioTransactions.id, transactionId),
          eq(folioTransactions.bookingId, bookingId),
        ),
      );

    if (!original) {
      return reply.status(404).send({ error: "Transaction not found" });
    }

    // Get original transaction's code and its adjustment code
    const [code] = await app.db
      .select()
      .from(transactionCodes)
      .where(eq(transactionCodes.id, original.transactionCodeId));

    if (!code?.adjustmentCodeId) {
      return reply
        .status(400)
        .send({ error: "This transaction type cannot be adjusted" });
    }

    // Check if already adjusted
    const [existingAdjustment] = await app.db
      .select({ id: folioTransactions.id })
      .from(folioTransactions)
      .where(eq(folioTransactions.parentTransactionId, original.id))
      .limit(1);

    if (existingAdjustment) {
      return reply
        .status(409)
        .send({ error: "This transaction has already been adjusted" });
    }

    // Get open business date
    const [bizDate] = await app.db
      .select({ id: businessDates.id })
      .from(businessDates)
      .where(
        and(
          eq(businessDates.propertyId, original.propertyId),
          eq(businessDates.status, "open"),
        ),
      );

    if (!bizDate) {
      return reply.status(400).send({ error: "No open business date" });
    }

    // Create counter-entry: mirror debit/credit
    const [created] = await app.db
      .insert(folioTransactions)
      .values({
        propertyId: original.propertyId,
        bookingId,
        businessDateId: bizDate.id,
        transactionCodeId: code.adjustmentCodeId,
        debit: original.credit,
        credit: original.debit,
        description: reason,
        isSystemGenerated: false,
        parentTransactionId: original.id,
        postedBy: "user:front_desk",
      })
      .returning();

    return reply.status(201).send(created);
  });
};
