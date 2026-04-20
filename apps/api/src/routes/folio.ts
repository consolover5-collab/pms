import type { FastifyPluginAsync } from "fastify";
import {
  folioTransactions,
  transactionCodes,
  businessDates,
  bookings,
  folioWindows,
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
      return reply.status(400).send({ error: "Invalid bookingId format", code: "INVALID_BOOKING_ID" });
    }

    // Verify booking exists
    const [booking] = await app.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found", code: "BOOKING_NOT_FOUND" });
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
        folioWindowId: folioTransactions.folioWindowId,
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
    
    // Get folio windows
    const windows = await app.db
      .select({
        id: folioWindows.id,
        bookingId: folioWindows.bookingId,
        windowNumber: folioWindows.windowNumber,
        label: folioWindows.label,
        profileId: folioWindows.profileId,
        paymentMethod: folioWindows.paymentMethod,
        createdAt: folioWindows.createdAt,
      })
      .from(folioWindows)
      .where(eq(folioWindows.bookingId, bookingId))
      .orderBy(folioWindows.windowNumber);

    const windowBalances = windows.map(w => {
      const windowTx = transactions.filter(t => t.folioWindowId === w.id);
      let charges = 0, payments = 0;
      for (const t of windowTx) {
        charges += parseFloat(t.debit) || 0;
        payments += parseFloat(t.credit) || 0;
      }
      return {
        ...w,
        balance: Math.round((charges - payments) * 100) / 100,
        totalCharges: Math.round(charges * 100) / 100,
        totalPayments: Math.round(payments * 100) / 100,
      };
    });
    let totalCharges = 0;
    let totalPayments = 0;
    for (const t of transactions) {
      totalCharges += parseFloat(t.debit) || 0;
      totalPayments += parseFloat(t.credit) || 0;
    }

    return {
      balance: Math.round(balance * 100) / 100,
      transactions,
      windows: windowBalances,
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
      return reply.status(400).send({ error: "Invalid bookingId format", code: "INVALID_BOOKING_ID" });
    }
    const { transactionCodeId, amount, description } = request.body;

    if (!transactionCodeId || !amount || amount <= 0) {
      return reply
        .status(400)
        .send({ error: "transactionCodeId and positive amount are required", code: "MISSING_FIELDS" });
    }
    if (!isValidUuid(transactionCodeId)) {
      return reply.status(400).send({ error: "Invalid transactionCodeId format", code: "INVALID_TRANSACTION_CODE_ID" });
    }

    // Verify booking
    const [booking] = await app.db
      .select({ id: bookings.id, propertyId: bookings.propertyId, status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found", code: "BOOKING_NOT_FOUND" });
    }

    const allowedFolioStatuses = ["confirmed", "checked_in"];
    if (!allowedFolioStatuses.includes(booking.status)) {
      return reply.status(400).send({
        error: `Cannot post to booking with status "${booking.status}". Allowed statuses: confirmed, checked_in.`, code: "INVALID_BOOKING_STATUS",
      });
    }

    // Verify transaction code
    const [code] = await app.db
      .select()
      .from(transactionCodes)
      .where(eq(transactionCodes.id, transactionCodeId));

    if (!code) {
      return reply.status(404).send({ error: "Transaction code not found", code: "TRANSACTION_CODE_NOT_FOUND" });
    }

    if (!code.isManualPostAllowed) {
      return reply
        .status(400)
        .send({ error: "This transaction code is system-only", code: "SYSTEM_ONLY_CODE" });
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
        .send({ error: "No open business date", code: "NO_OPEN_BUSINESS_DATE" });
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
        postedBy: (request as any).user?.id || "system",
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
      return reply.status(400).send({ error: "Invalid bookingId format", code: "INVALID_BOOKING_ID" });
    }
    const { transactionCodeId, amount } = request.body;

    if (!transactionCodeId || !amount || amount <= 0) {
      return reply
        .status(400)
        .send({ error: "transactionCodeId and positive amount are required", code: "MISSING_FIELDS" });
    }
    if (!isValidUuid(transactionCodeId)) {
      return reply.status(400).send({ error: "Invalid transactionCodeId format", code: "INVALID_TRANSACTION_CODE_ID" });
    }

    const [booking] = await app.db
      .select({ id: bookings.id, propertyId: bookings.propertyId, status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found", code: "BOOKING_NOT_FOUND" });
    }

    const allowedPaymentStatuses = ["confirmed", "checked_in", "checked_out"];
    if (!allowedPaymentStatuses.includes(booking.status)) {
      return reply.status(400).send({
        error: `Cannot accept payment for booking with status "${booking.status}".`, code: "INVALID_BOOKING_STATUS",
      });
    }

    const [code] = await app.db
      .select()
      .from(transactionCodes)
      .where(eq(transactionCodes.id, transactionCodeId));

    if (!code || code.transactionType !== "payment") {
      return reply
        .status(400)
        .send({ error: "Invalid payment transaction code", code: "INVALID_PAYMENT_CODE" });
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
      return reply.status(400).send({ error: "No open business date", code: "NO_OPEN_BUSINESS_DATE" });
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
        postedBy: (request as any).user?.id || "system",
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
      return reply.status(400).send({ error: "Invalid bookingId format", code: "INVALID_BOOKING_ID" });
    }
    const { transactionId, reason } = request.body;

    if (!transactionId || !reason) {
      return reply
        .status(400)
        .send({ error: "transactionId and reason are required", code: "MISSING_FIELDS" });
    }
    if (!isValidUuid(transactionId)) {
      return reply.status(400).send({ error: "Invalid transactionId format", code: "INVALID_TRANSACTION_ID" });
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
      return reply.status(404).send({ error: "Transaction not found", code: "TRANSACTION_NOT_FOUND" });
    }

    // Prevent adjusting an adjustment (double reversal)
    if (original.parentTransactionId) {
      return reply.status(400).send({
        error: "Cannot adjust an adjustment. Adjust the original transaction instead.", code: "CANNOT_ADJUST_ADJUSTMENT",
      });
    }

    // Get original transaction's code and its adjustment code
    const [code] = await app.db
      .select()
      .from(transactionCodes)
      .where(eq(transactionCodes.id, original.transactionCodeId));

    if (!code?.adjustmentCodeId) {
      return reply
        .status(400)
        .send({ error: "This transaction type cannot be adjusted", code: "NOT_ADJUSTABLE" });
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
        .send({ error: "This transaction has already been adjusted", code: "ALREADY_ADJUSTED" });
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
      return reply.status(400).send({ error: "No open business date", code: "NO_OPEN_BUSINESS_DATE" });
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
        postedBy: (request as any).user?.id || "system",
      })
      .returning();

    return reply.status(201).send(created);
  });
};
