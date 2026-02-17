import type { FastifyPluginAsync } from "fastify";
import {
  bookings,
  rooms,
  guests,
  properties,
  businessDates,
  transactionCodes,
  folioTransactions,
} from "@pms/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { calculateTax } from "@pms/domain";
import { isValidUuid } from "../lib/validation";

export const nightAuditRoutes: FastifyPluginAsync = async (app) => {
  // Preview — what will Night Audit do?
  app.post<{
    Querystring: { propertyId?: string };
  }>("/api/night-audit/preview", async (request, reply) => {
    const propertyId = (request.body as { propertyId?: string })?.propertyId;
    if (!propertyId) {
      return reply.status(400).send({ error: "propertyId is required" });
    }
    if (!isValidUuid(propertyId)) {
      return reply.status(400).send({ error: "Invalid propertyId format" });
    }

    // Get open business date
    const [bizDate] = await app.db
      .select()
      .from(businessDates)
      .where(
        and(
          eq(businessDates.propertyId, propertyId),
          eq(businessDates.status, "open"),
        ),
      );

    if (!bizDate) {
      return reply.status(404).send({ error: "No open business date" });
    }

    // Due outs: checked_in with checkOut <= business date
    const dueOuts = await app.db
      .select({
        id: bookings.id,
        confirmationNumber: bookings.confirmationNumber,
        checkOutDate: bookings.checkOutDate,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.propertyId, propertyId),
          eq(bookings.status, "checked_in"),
          sql`${bookings.checkOutDate} <= ${bizDate.date}`,
        ),
      );

    // Pending no-shows: confirmed with checkIn < business date
    const pendingNoShows = await app.db
      .select({
        id: bookings.id,
        confirmationNumber: bookings.confirmationNumber,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.propertyId, propertyId),
          eq(bookings.status, "confirmed"),
          lt(bookings.checkInDate, bizDate.date),
        ),
      );

    // Rooms to charge: all checked_in bookings with room + guest details
    const roomsToCharge = await app.db
      .select({
        id: bookings.id,
        rateAmount: bookings.rateAmount,
        roomNumber: rooms.roomNumber,
        guestFirstName: guests.firstName,
        guestLastName: guests.lastName,
      })
      .from(bookings)
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .innerJoin(guests, eq(bookings.guestId, guests.id))
      .where(
        and(
          eq(bookings.propertyId, propertyId),
          eq(bookings.status, "checked_in"),
        ),
      );

    // Get property tax rate
    const [property] = await app.db
      .select({ taxRate: properties.taxRate })
      .from(properties)
      .where(eq(properties.id, propertyId));

    const taxRate = parseFloat(property?.taxRate || "0");
    let estimatedRevenue = 0;
    const roomDetails = roomsToCharge.map((b) => {
      const rate = parseFloat(b.rateAmount || "0");
      const tax = calculateTax(rate, taxRate);
      estimatedRevenue += rate + tax;
      return {
        roomNumber: b.roomNumber || "—",
        guestName: `${b.guestFirstName} ${b.guestLastName}`,
        rateAmount: rate,
      };
    });

    const warnings: string[] = [];
    if (dueOuts.length > 0) {
      warnings.push(
        `${dueOuts.length} due-out guest(s) still checked in`,
      );
    }

    return {
      businessDate: bizDate.date,
      dueOuts: dueOuts.length,
      pendingNoShows: pendingNoShows.length,
      roomsToCharge: roomsToCharge.length,
      estimatedRevenue: Math.round(estimatedRevenue * 100) / 100,
      roomDetails,
      warnings,
    };
  });

  // Run Night Audit — single atomic transaction
  app.post<{
    Body: { propertyId: string };
  }>("/api/night-audit/run", async (request, reply) => {
    const { propertyId } = request.body;
    if (!propertyId) {
      return reply.status(400).send({ error: "propertyId is required" });
    }
    if (!isValidUuid(propertyId)) {
      return reply.status(400).send({ error: "Invalid propertyId format" });
    }

    // Get open business date
    const [bizDate] = await app.db
      .select()
      .from(businessDates)
      .where(
        and(
          eq(businessDates.propertyId, propertyId),
          eq(businessDates.status, "open"),
        ),
      );

    if (!bizDate) {
      return reply.status(404).send({ error: "No open business date" });
    }

    // Get property for tax rate
    const [property] = await app.db
      .select({ taxRate: properties.taxRate })
      .from(properties)
      .where(eq(properties.id, propertyId));

    const taxRate = parseFloat(property?.taxRate || "0");

    // Get ROOM and ROOM_TAX transaction codes
    const codes = await app.db
      .select()
      .from(transactionCodes)
      .where(eq(transactionCodes.propertyId, propertyId));

    const roomCode = codes.find((c) => c.code === "ROOM");
    const roomTaxCode = codes.find((c) => c.code === "ROOM_TAX");

    if (!roomCode) {
      return reply
        .status(400)
        .send({ error: "ROOM transaction code not found. Run seed first." });
    }

    if (taxRate > 0 && !roomTaxCode) {
      return reply
        .status(400)
        .send({ error: "ROOM_TAX transaction code not found but tax rate is set. Add ROOM_TAX code or set tax rate to 0." });
    }

    // Execute all steps in single DB transaction
    let result;
    try {
      result = await app.db.transaction(async (tx) => {
      // Step 1: Idempotency guard — check existing ROOM charges for this business date
      const [existingCharge] = await tx
        .select({ id: folioTransactions.id })
        .from(folioTransactions)
        .where(
          and(
            eq(folioTransactions.businessDateId, bizDate.id),
            eq(folioTransactions.transactionCodeId, roomCode.id),
            eq(folioTransactions.isSystemGenerated, true),
          ),
        )
        .limit(1);

      if (existingCharge) {
        throw new Error("ALREADY_RUN");
      }

      // Step 2: Mark no-shows
      const noShows = await tx
        .update(bookings)
        .set({ status: "no_show", updatedAt: new Date() })
        .where(
          and(
            eq(bookings.propertyId, propertyId),
            eq(bookings.status, "confirmed"),
            lt(bookings.checkInDate, bizDate.date),
          ),
        )
        .returning({ id: bookings.id });

      // Step 3 & 4: Post room charges + tax for each checked_in booking
      const checkedIn = await tx
        .select({
          id: bookings.id,
          rateAmount: bookings.rateAmount,
          roomId: bookings.roomId,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.propertyId, propertyId),
            eq(bookings.status, "checked_in"),
          ),
        );

      let roomChargesPosted = 0;
      let taxChargesPosted = 0;
      let skippedDuplicates = 0;
      let totalRevenue = 0;

      const postedBy = (request as any).user?.id || "system:night_audit";

      for (const booking of checkedIn) {
        // A2: Per-booking idempotency — skip if charge already exists for this booking + business date + ROOM code
        const [existingBookingCharge] = await tx
          .select({ id: folioTransactions.id })
          .from(folioTransactions)
          .where(
            and(
              eq(folioTransactions.bookingId, booking.id),
              eq(folioTransactions.businessDateId, bizDate.id),
              eq(folioTransactions.transactionCodeId, roomCode.id),
            ),
          )
          .limit(1);

        if (existingBookingCharge) {
          skippedDuplicates++;
          continue;
        }

        const rate = parseFloat(booking.rateAmount || "0");

        // Room charge
        const [roomCharge] = await tx
          .insert(folioTransactions)
          .values({
            propertyId,
            bookingId: booking.id,
            businessDateId: bizDate.id,
            transactionCodeId: roomCode.id,
            debit: String(rate),
            credit: "0",
            description: "Room Charge",
            isSystemGenerated: true,
            postedBy,
          })
          .returning();

        roomChargesPosted++;
        totalRevenue += rate;

        // Tax charge (if taxRate > 0)
        if (taxRate > 0 && roomTaxCode) {
          const taxAmount = calculateTax(rate, taxRate);
          await tx.insert(folioTransactions).values({
            propertyId,
            bookingId: booking.id,
            businessDateId: bizDate.id,
            transactionCodeId: roomTaxCode.id,
            debit: String(taxAmount),
            credit: "0",
            description: "Room Tax",
            isSystemGenerated: true,
            appliedTaxRate: String(taxRate),
            parentTransactionId: roomCharge.id,
            postedBy,
          });

          taxChargesPosted++;
          totalRevenue += taxAmount;
        }
      }

      // Step 5: Update HK — all occupied rooms → dirty
      const roomsUpdated = await tx
        .update(rooms)
        .set({ housekeepingStatus: "dirty", updatedAt: new Date() })
        .where(
          and(
            eq(rooms.propertyId, propertyId),
            eq(rooms.occupancyStatus, "occupied"),
          ),
        )
        .returning({ id: rooms.id });

      // Step 6: A3 — Sync room statuses: find orphaned occupied rooms
      // Query ALL checked_in bookings (not just from this run) to find rooms that should be occupied
      const allCheckedInBookings = await tx
        .select({ roomId: bookings.roomId })
        .from(bookings)
        .where(
          and(
            eq(bookings.propertyId, propertyId),
            eq(bookings.status, "checked_in"),
          ),
        );

      const activeRoomIds = new Set(
        allCheckedInBookings
          .map((b) => b.roomId)
          .filter((id): id is string => id !== null)
      );

      const allOccupied = await tx
        .select({ id: rooms.id })
        .from(rooms)
        .where(
          and(
            eq(rooms.propertyId, propertyId),
            eq(rooms.occupancyStatus, "occupied"),
          ),
        );

      let orphanedRoomsFixed = 0;
      for (const room of allOccupied) {
        if (!activeRoomIds.has(room.id)) {
          await tx
            .update(rooms)
            .set({ occupancyStatus: "vacant", updatedAt: new Date() })
            .where(eq(rooms.id, room.id));
          orphanedRoomsFixed++;
        }
      }

      // Step 7: Close business date
      await tx
        .update(businessDates)
        .set({ status: "closed", closedAt: new Date() })
        .where(eq(businessDates.id, bizDate.id));

      // Step 8: Open next business date
      const nextDate = new Date(bizDate.date + "T00:00:00");
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split("T")[0];

      await tx.insert(businessDates).values({
        propertyId,
        date: nextDateStr,
        status: "open",
      });

      return {
        businessDate: bizDate.date,
        nextBusinessDate: nextDateStr,
        noShows: noShows.length,
        roomChargesPosted,
        taxChargesPosted,
        skippedDuplicates,
        roomsUpdated: roomsUpdated.length,
        orphanedRoomsFixed,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      };
    });

    } catch (err: any) {
      if (err.message === "ALREADY_RUN") {
        return reply
          .status(409)
          .send({ error: "Night Audit already run for this business date" });
      }
      throw err;
    }

    return result;
  });
};
