import type { FastifyPluginAsync } from "fastify";
import { bookings, guests, rooms, roomTypes } from "@pms/db";
import { eq, and, count } from "drizzle-orm";

// TODO: Replace with business date from business_dates table (Epic 7)
function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  // Today's arrivals: confirmed bookings with checkInDate = today
  app.get<{
    Querystring: { propertyId?: string };
  }>("/api/dashboard/arrivals", async (request, reply) => {
    const { propertyId } = request.query;
    if (!propertyId) {
      return reply.status(400).send({ error: "propertyId is required" });
    }
    if (!UUID_RE.test(propertyId)) {
      return reply.status(400).send({ error: "Invalid propertyId format" });
    }

    const today = getToday();

    const result = await app.db
      .select({
        id: bookings.id,
        confirmationNumber: bookings.confirmationNumber,
        checkInDate: bookings.checkInDate,
        checkOutDate: bookings.checkOutDate,
        status: bookings.status,
        adults: bookings.adults,
        children: bookings.children,
        guest: {
          id: guests.id,
          firstName: guests.firstName,
          lastName: guests.lastName,
        },
        roomType: {
          id: roomTypes.id,
          name: roomTypes.name,
          code: roomTypes.code,
        },
        room: {
          id: rooms.id,
          roomNumber: rooms.roomNumber,
        },
      })
      .from(bookings)
      .innerJoin(guests, eq(bookings.guestId, guests.id))
      .innerJoin(roomTypes, eq(bookings.roomTypeId, roomTypes.id))
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(
        and(
          eq(bookings.propertyId, propertyId),
          eq(bookings.checkInDate, today),
          eq(bookings.status, "confirmed"),
        ),
      );

    return result;
  });

  // Today's departures: checked_in bookings with checkOutDate = today
  app.get<{
    Querystring: { propertyId?: string };
  }>("/api/dashboard/departures", async (request, reply) => {
    const { propertyId } = request.query;
    if (!propertyId) {
      return reply.status(400).send({ error: "propertyId is required" });
    }
    if (!UUID_RE.test(propertyId)) {
      return reply.status(400).send({ error: "Invalid propertyId format" });
    }

    const today = getToday();

    const result = await app.db
      .select({
        id: bookings.id,
        confirmationNumber: bookings.confirmationNumber,
        checkOutDate: bookings.checkOutDate,
        guest: {
          id: guests.id,
          firstName: guests.firstName,
          lastName: guests.lastName,
        },
        room: {
          id: rooms.id,
          roomNumber: rooms.roomNumber,
        },
        roomType: {
          id: roomTypes.id,
          name: roomTypes.name,
          code: roomTypes.code,
        },
      })
      .from(bookings)
      .innerJoin(guests, eq(bookings.guestId, guests.id))
      .innerJoin(roomTypes, eq(bookings.roomTypeId, roomTypes.id))
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(
        and(
          eq(bookings.propertyId, propertyId),
          eq(bookings.checkOutDate, today),
          eq(bookings.status, "checked_in"),
        ),
      );

    return result;
  });

  // In-house guests: all checked_in bookings, sorted by checkout date
  app.get<{
    Querystring: { propertyId?: string };
  }>("/api/dashboard/in-house", async (request, reply) => {
    const { propertyId } = request.query;
    if (!propertyId) {
      return reply.status(400).send({ error: "propertyId is required" });
    }
    if (!UUID_RE.test(propertyId)) {
      return reply.status(400).send({ error: "Invalid propertyId format" });
    }

    const result = await app.db
      .select({
        id: bookings.id,
        confirmationNumber: bookings.confirmationNumber,
        checkOutDate: bookings.checkOutDate,
        guest: {
          id: guests.id,
          firstName: guests.firstName,
          lastName: guests.lastName,
        },
        room: {
          id: rooms.id,
          roomNumber: rooms.roomNumber,
        },
        roomType: {
          id: roomTypes.id,
          name: roomTypes.name,
          code: roomTypes.code,
        },
      })
      .from(bookings)
      .innerJoin(guests, eq(bookings.guestId, guests.id))
      .innerJoin(roomTypes, eq(bookings.roomTypeId, roomTypes.id))
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(
        and(
          eq(bookings.propertyId, propertyId),
          eq(bookings.status, "checked_in"),
        ),
      )
      .orderBy(bookings.checkOutDate);

    return result;
  });

  // Summary: room counts + booking counts + business date
  app.get<{
    Querystring: { propertyId?: string };
  }>("/api/dashboard/summary", async (request, reply) => {
    const { propertyId } = request.query;
    if (!propertyId) {
      return reply.status(400).send({ error: "propertyId is required" });
    }
    if (!UUID_RE.test(propertyId)) {
      return reply.status(400).send({ error: "Invalid propertyId format" });
    }

    const today = getToday();

    // Room status counts — single pass reduce
    const allRooms = await app.db
      .select({
        housekeepingStatus: rooms.housekeepingStatus,
        occupancyStatus: rooms.occupancyStatus,
      })
      .from(rooms)
      .where(eq(rooms.propertyId, propertyId));

    const rc = allRooms.reduce(
      (acc, r) => {
        if (r.occupancyStatus === "occupied") acc.occupied++;
        else acc.vacant++;

        switch (r.housekeepingStatus) {
          case "clean":
            acc.clean++;
            break;
          case "dirty":
            acc.dirty++;
            break;
          case "pickup":
            acc.pickup++;
            break;
          case "inspected":
            acc.inspected++;
            break;
          case "out_of_order":
            acc.outOfOrder++;
            break;
          case "out_of_service":
            acc.outOfService++;
            break;
        }
        return acc;
      },
      {
        occupied: 0,
        vacant: 0,
        clean: 0,
        dirty: 0,
        pickup: 0,
        inspected: 0,
        outOfOrder: 0,
        outOfService: 0,
      },
    );

    // Booking counts via SQL COUNT
    const [arrivalsResult] = await app.db
      .select({ value: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.propertyId, propertyId),
          eq(bookings.checkInDate, today),
          eq(bookings.status, "confirmed"),
        ),
      );

    const [departuresResult] = await app.db
      .select({ value: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.propertyId, propertyId),
          eq(bookings.checkOutDate, today),
          eq(bookings.status, "checked_in"),
        ),
      );

    const [inHouseResult] = await app.db
      .select({ value: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.propertyId, propertyId),
          eq(bookings.status, "checked_in"),
        ),
      );

    return {
      totalRooms: allRooms.length,
      occupiedRooms: rc.occupied,
      vacantRooms: rc.vacant,
      outOfOrderRooms: rc.outOfOrder,
      outOfServiceRooms: rc.outOfService,
      dirtyRooms: rc.dirty,
      cleanRooms: rc.clean,
      pickupRooms: rc.pickup,
      inspectedRooms: rc.inspected,
      arrivalsCount: arrivalsResult.value,
      departuresCount: departuresResult.value,
      inHouseCount: inHouseResult.value,
      currentBusinessDate: today,
    };
  });
};
