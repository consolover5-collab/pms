import type { FastifyPluginAsync } from "fastify";
import { bookings, guests, rooms, roomTypes } from "@pms/db";
import { eq, and, lt, gt, inArray } from "drizzle-orm";
import { isValidUuid } from "../lib/validation";

export const tapeChartRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: { propertyId?: string; from?: string; to?: string };
  }>("/api/tape-chart", async (request, reply) => {
    const { propertyId, from, to } = request.query;

    // Validation
    if (!propertyId) {
      return reply.status(400).send({ error: "propertyId is required" });
    }
    if (!isValidUuid(propertyId)) {
      return reply.status(400).send({ error: "Invalid propertyId format" });
    }
    if (!from || !to) {
      return reply
        .status(400)
        .send({ error: "from and to date parameters are required" });
    }
    if (from >= to) {
      return reply.status(400).send({ error: "from must be before to" });
    }

    // Query rooms with roomType join, sorted by sortOrder + roomNumber
    const roomList = await app.db
      .select({
        id: rooms.id,
        roomNumber: rooms.roomNumber,
        floor: rooms.floor,
        roomTypeName: roomTypes.name,
        roomTypeCode: roomTypes.code,
      })
      .from(rooms)
      .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(eq(rooms.propertyId, propertyId))
      .orderBy(roomTypes.sortOrder, rooms.roomNumber);

    // Generate dates array [from, to)
    const dates: string[] = [];
    const current = new Date(from + "T00:00:00Z");
    const end = new Date(to + "T00:00:00Z");
    while (current < end) {
      dates.push(current.toISOString().split("T")[0]);
      current.setUTCDate(current.getUTCDate() + 1);
    }

    // Query bookings overlapping the date range (checkInDate < to AND checkOutDate > from)
    const bookingRows = await app.db
      .select({
        id: bookings.id,
        confirmationNumber: bookings.confirmationNumber,
        guestFirstName: guests.firstName,
        guestLastName: guests.lastName,
        roomId: bookings.roomId,
        roomTypeId: bookings.roomTypeId,
        checkInDate: bookings.checkInDate,
        checkOutDate: bookings.checkOutDate,
        status: bookings.status,
      })
      .from(bookings)
      .innerJoin(guests, eq(bookings.guestId, guests.id))
      .where(
        and(
          eq(bookings.propertyId, propertyId),
          lt(bookings.checkInDate, to),
          gt(bookings.checkOutDate, from),
          inArray(bookings.status, [
            "confirmed",
            "checked_in",
            "checked_out",
          ]),
        ),
      );

    // Map bookings to combine guest name
    const bookingList = bookingRows.map((b) => ({
      id: b.id,
      confirmationNumber: b.confirmationNumber,
      guestName: `${b.guestFirstName} ${b.guestLastName}`,
      roomId: b.roomId,
      roomTypeId: b.roomTypeId,
      checkInDate: b.checkInDate,
      checkOutDate: b.checkOutDate,
      status: b.status,
    }));

    return { rooms: roomList, dates, bookings: bookingList };
  });
};
