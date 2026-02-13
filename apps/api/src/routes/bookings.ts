import type { FastifyPluginAsync } from "fastify";
import { bookings, guests, rooms, roomTypes, ratePlans } from "@pms/db";
import { eq, and, or, ne, lte, gte, lt, gt, sql } from "drizzle-orm";
import { validateBookingDates, validateOccupancy, checkRoomConflict } from "../lib/validation";

export const bookingsRoutes: FastifyPluginAsync = async (app) => {
  // List bookings with optional filters
  app.get<{
    Querystring: { propertyId: string; status?: string; roomId?: string };
  }>("/api/bookings", async (request) => {
    const { propertyId, status, roomId } = request.query;

    const conditions = [eq(bookings.propertyId, propertyId)];
    if (status) {
      conditions.push(eq(bookings.status, status));
    }
    if (roomId) {
      conditions.push(eq(bookings.roomId, roomId));
    }

    const result = await app.db
      .select({
        id: bookings.id,
        confirmationNumber: bookings.confirmationNumber,
        checkInDate: bookings.checkInDate,
        checkOutDate: bookings.checkOutDate,
        status: bookings.status,
        adults: bookings.adults,
        children: bookings.children,
        totalAmount: bookings.totalAmount,
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
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(and(...conditions))
      .orderBy(bookings.checkInDate);

    return result;
  });

  // Get single booking with full details
  app.get<{ Params: { id: string } }>(
    "/api/bookings/:id",
    async (request, reply) => {
      const [booking] = await app.db
        .select({
          id: bookings.id,
          confirmationNumber: bookings.confirmationNumber,
          checkInDate: bookings.checkInDate,
          checkOutDate: bookings.checkOutDate,
          status: bookings.status,
          adults: bookings.adults,
          children: bookings.children,
          rateAmount: bookings.rateAmount,
          totalAmount: bookings.totalAmount,
          paymentMethod: bookings.paymentMethod,
          actualCheckIn: bookings.actualCheckIn,
          actualCheckOut: bookings.actualCheckOut,
          notes: bookings.notes,
          createdAt: bookings.createdAt,
          updatedAt: bookings.updatedAt,
          guest: {
            id: guests.id,
            firstName: guests.firstName,
            lastName: guests.lastName,
            email: guests.email,
            phone: guests.phone,
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
          ratePlan: {
            id: ratePlans.id,
            name: ratePlans.name,
            code: ratePlans.code,
          },
        })
        .from(bookings)
        .innerJoin(guests, eq(bookings.guestId, guests.id))
        .innerJoin(roomTypes, eq(bookings.roomTypeId, roomTypes.id))
        .leftJoin(rooms, eq(bookings.roomId, rooms.id))
        .leftJoin(ratePlans, eq(bookings.ratePlanId, ratePlans.id))
        .where(eq(bookings.id, request.params.id));

      if (!booking) return reply.status(404).send({ error: "Not found" });
      return booking;
    },
  );

  // Create booking
  app.post<{
    Body: {
      propertyId: string;
      guestId: string;
      roomId?: string;
      roomTypeId: string;
      ratePlanId?: string;
      checkInDate: string;
      checkOutDate: string;
      adults?: number;
      children?: number;
      rateAmount?: string;
      totalAmount?: string;
      paymentMethod?: string;
      notes?: string;
    };
  }>("/api/bookings", async (request, reply) => {
    // Валидация дат
    const dateError = validateBookingDates(request.body.checkInDate, request.body.checkOutDate);
    if (dateError) {
      return reply.status(400).send({ error: dateError, code: "INVALID_DATES" });
    }

    // Проверка вместимости
    if (request.body.roomTypeId) {
      const [rt] = await app.db.select().from(roomTypes).where(eq(roomTypes.id, request.body.roomTypeId));
      if (rt) {
        const adults = request.body.adults || 1;
        const children = request.body.children || 0;
        const occError = validateOccupancy(adults, children, rt.maxOccupancy);
        if (occError) {
          return reply.status(400).send({ error: occError, code: "EXCEEDS_OCCUPANCY" });
        }
      }
    }

    // Проверка конфликта комнаты
    if (request.body.roomId) {
      const conflict = await checkRoomConflict(app.db, request.body.roomId, request.body.checkInDate, request.body.checkOutDate);
      if (conflict) {
        return reply.status(400).send({ error: conflict, code: "ROOM_CONFLICT" });
      }
    }

    // Проверка существования и статуса комнаты
    if (request.body.roomId) {
      const [assignedRoom] = await app.db.select().from(rooms).where(eq(rooms.id, request.body.roomId));
      if (!assignedRoom) {
        return reply.status(400).send({ error: "Указанная комната не найдена.", code: "ROOM_NOT_FOUND" });
      }
      if (assignedRoom.roomTypeId !== request.body.roomTypeId) {
        return reply.status(400).send({ error: "Тип комнаты не совпадает с типом в бронировании.", code: "ROOM_TYPE_MISMATCH" });
      }
      if (assignedRoom.housekeepingStatus === "out_of_order" || assignedRoom.housekeepingStatus === "out_of_service") {
        return reply.status(400).send({
          error: `Комната ${assignedRoom.roomNumber} недоступна (${assignedRoom.housekeepingStatus === "out_of_order" ? "не в эксплуатации" : "временно недоступна"}).`,
          code: "ROOM_UNAVAILABLE",
        });
      }
    }

    // Последовательная нумерация confirmation number
    const [lastBooking] = await app.db
      .select({ confirmationNumber: bookings.confirmationNumber })
      .from(bookings)
      .where(eq(bookings.propertyId, request.body.propertyId))
      .orderBy(sql`CAST(confirmation_number AS BIGINT) DESC`)
      .limit(1);

    const lastNum = lastBooking ? parseInt(lastBooking.confirmationNumber, 10) : 100000;
    const confNum = String(isNaN(lastNum) ? Date.now() : lastNum + 1);

    // Авторасчёт totalAmount если не указан
    let calcTotalAmount = request.body.totalAmount;
    if (!calcTotalAmount && request.body.rateAmount) {
      const checkIn = new Date(request.body.checkInDate);
      const checkOut = new Date(request.body.checkOutDate);
      const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
      calcTotalAmount = String(Number(request.body.rateAmount) * nights);
    }

    const [booking] = await app.db
      .insert(bookings)
      .values({
        propertyId: request.body.propertyId,
        guestId: request.body.guestId,
        roomId: request.body.roomId || null,
        roomTypeId: request.body.roomTypeId,
        ratePlanId: request.body.ratePlanId || null,
        checkInDate: request.body.checkInDate,
        checkOutDate: request.body.checkOutDate,
        adults: request.body.adults || 1,
        children: request.body.children || 0,
        rateAmount: request.body.rateAmount || null,
        totalAmount: calcTotalAmount || null,
        paymentMethod: request.body.paymentMethod || null,
        notes: request.body.notes || null,
        confirmationNumber: confNum,
        status: "confirmed",
      })
      .returning();

    return reply.status(201).send(booking);
  });

  // Update booking
  app.put<{
    Params: { id: string };
    Body: {
      guestId?: string;
      roomId?: string;
      roomTypeId?: string;
      ratePlanId?: string;
      checkInDate?: string;
      checkOutDate?: string;
      adults?: number;
      children?: number;
      rateAmount?: string;
      totalAmount?: string;
      paymentMethod?: string;
      notes?: string;
    };
  }>("/api/bookings/:id", async (request, reply) => {
    // Валидация дат при обновлении
    if (request.body.checkInDate && request.body.checkOutDate) {
      const dateError = validateBookingDates(request.body.checkInDate, request.body.checkOutDate);
      if (dateError) {
        return reply.status(400).send({ error: dateError, code: "INVALID_DATES" });
      }
    }

    // Проверка конфликта комнаты при обновлении
    if (request.body.roomId && request.body.checkInDate && request.body.checkOutDate) {
      const conflict = await checkRoomConflict(app.db, request.body.roomId, request.body.checkInDate, request.body.checkOutDate, request.params.id);
      if (conflict) {
        return reply.status(400).send({ error: conflict, code: "ROOM_CONFLICT" });
      }
    }

    const [updated] = await app.db
      .update(bookings)
      .set({ ...request.body, updatedAt: new Date() })
      .where(eq(bookings.id, request.params.id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not found" });
    return updated;
  });

  // Check-in with business logic validation
  app.post<{ Params: { id: string }; Body: { roomId?: string } }>(
    "/api/bookings/:id/check-in",
    async (request, reply) => {
      // Get the booking
      const [booking] = await app.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, request.params.id));

      if (!booking) {
        return reply.status(404).send({
          error: "Booking not found",
          code: "BOOKING_NOT_FOUND"
        });
      }

      if (booking.status !== "confirmed") {
        return reply.status(400).send({
          error: `Cannot check in: booking status is "${booking.status}". Only confirmed bookings can be checked in.`,
          code: "INVALID_STATUS",
          currentStatus: booking.status
        });
      }

      // Validate check-in date — cannot check in before arrival date
      const today = new Date().toISOString().split("T")[0];
      if (booking.checkInDate > today) {
        return reply.status(400).send({
          error: `Cannot check in: arrival date is ${booking.checkInDate}, but today is ${today}. Check-in is only allowed on or after the arrival date.`,
          code: "EARLY_CHECKIN",
          checkInDate: booking.checkInDate,
          today
        });
      }

      // Determine room to use
      const roomId = request.body?.roomId || booking.roomId;
      if (!roomId) {
        return reply.status(400).send({
          error: "Room must be assigned before check-in. Please assign a room first.",
          code: "NO_ROOM_ASSIGNED"
        });
      }

      // Validate room
      const [room] = await app.db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId));

      if (!room) {
        return reply.status(400).send({
          error: "Selected room not found in the system",
          code: "ROOM_NOT_FOUND"
        });
      }

      // Check room type matches
      if (room.roomTypeId !== booking.roomTypeId) {
        return reply.status(400).send({
          error: `Room type mismatch: the selected room is a different type than what was booked. Please select a room of the correct type.`,
          code: "ROOM_TYPE_MISMATCH"
        });
      }

      // Check room is vacant
      if (room.occupancyStatus !== "vacant") {
        return reply.status(400).send({
          error: `Room ${room.roomNumber} is currently occupied. Please select a vacant room.`,
          code: "ROOM_OCCUPIED",
          roomNumber: room.roomNumber
        });
      }

      // Check room is clean or inspected (not dirty, out of order, etc.)
      if (
        room.housekeepingStatus !== "clean" &&
        room.housekeepingStatus !== "inspected"
      ) {
        return reply.status(400).send({
          error: `Room ${room.roomNumber} is not ready for check-in (status: ${room.housekeepingStatus}). Please wait for housekeeping or select another room.`,
          code: "ROOM_NOT_READY",
          roomNumber: room.roomNumber,
          housekeepingStatus: room.housekeepingStatus
        });
      }

      // Check for conflicting bookings on this room
      const conflictingBookings = await app.db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.roomId, roomId),
            eq(bookings.status, "checked_in"),
            ne(bookings.id, booking.id)
          )
        )
        .limit(1);

      if (conflictingBookings.length > 0) {
        return reply.status(400).send({
          error: `Room ${room.roomNumber} already has a checked-in guest. The previous guest must check out first.`,
          code: "ROOM_HAS_GUEST",
          roomNumber: room.roomNumber
        });
      }

      // All validations passed - perform check-in
      const result = await app.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(bookings)
          .set({
            status: "checked_in",
            actualCheckIn: new Date(),
            roomId: roomId,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, request.params.id))
          .returning();

        await tx
          .update(rooms)
          .set({ occupancyStatus: "occupied", updatedAt: new Date() })
          .where(eq(rooms.id, roomId));

        return updated;
      });

      return result;
    }
  );

  // Check-out with date validation
  app.post<{ Params: { id: string }; Body: { force?: boolean } }>(
    "/api/bookings/:id/check-out",
    async (request, reply) => {
      const [booking] = await app.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, request.params.id));

      if (!booking) {
        return reply.status(404).send({
          error: "Booking not found",
          code: "BOOKING_NOT_FOUND"
        });
      }

      if (booking.status !== "checked_in") {
        return reply.status(400).send({
          error: `Cannot check out: booking status is "${booking.status}". Only checked-in bookings can be checked out.`,
          code: "INVALID_STATUS"
        });
      }

      // Validate checkout date
      const today = new Date().toISOString().split("T")[0];
      const checkOutDate = booking.checkOutDate;

      if (checkOutDate > today && !request.body?.force) {
        return reply.status(400).send({
          error: `Early checkout: departure date is ${checkOutDate}, but today is ${today}. Use force=true for early checkout.`,
          code: "EARLY_CHECKOUT",
          checkOutDate,
          today
        });
      }

      // Проверка позднего выезда
      if (checkOutDate < today && !request.body?.force) {
        return reply.status(400).send({
          error: `Поздний выезд: дата выезда была ${checkOutDate}, сегодня ${today}. Возможно, бронь нужно продлить. Используйте force=true для подтверждения.`,
          code: "LATE_CHECKOUT",
          checkOutDate,
          today
        });
      }

      const result = await app.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(bookings)
          .set({
            status: "checked_out",
            actualCheckOut: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, request.params.id))
          .returning();

        if (booking.roomId) {
          await tx
            .update(rooms)
            .set({
              occupancyStatus: "vacant",
              housekeepingStatus: "dirty",
              updatedAt: new Date(),
            })
            .where(eq(rooms.id, booking.roomId));
        }

        return updated;
      });

      return result;
    },
  );

  // Cancel check-in (undo check-in)
  app.post<{ Params: { id: string } }>(
    "/api/bookings/:id/cancel-check-in",
    async (request, reply) => {
      const [booking] = await app.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, request.params.id));

      if (!booking) {
        return reply.status(404).send({
          error: "Booking not found",
          code: "BOOKING_NOT_FOUND"
        });
      }

      if (booking.status !== "checked_in") {
        return reply.status(400).send({
          error: `Cannot cancel check-in: booking status is "${booking.status}". Only checked-in bookings can have check-in cancelled.`,
          code: "INVALID_STATUS"
        });
      }

      const result = await app.db.transaction(async (tx) => {
        if (booking.roomId) {
          // Keep room clean so the same booking can re-check-in immediately.
          // The guest hasn't actually used the room if we're undoing a check-in.
          await tx
            .update(rooms)
            .set({
              occupancyStatus: "vacant",
              updatedAt: new Date(),
            })
            .where(eq(rooms.id, booking.roomId));
        }

        const [updated] = await tx
          .update(bookings)
          .set({
            status: "confirmed",
            actualCheckIn: null,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, request.params.id))
          .returning();

        return updated;
      });

      return result;
    },
  );

  // Reinstate booking (restore from cancelled/no_show/checked_out)
  app.post<{ Params: { id: string } }>(
    "/api/bookings/:id/reinstate",
    async (request, reply) => {
      const [booking] = await app.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, request.params.id));

      if (!booking) {
        return reply.status(404).send({
          error: "Booking not found",
          code: "BOOKING_NOT_FOUND"
        });
      }

      const allowedStatuses = ["cancelled", "no_show", "checked_out"];
      if (!allowedStatuses.includes(booking.status)) {
        return reply.status(400).send({
          error: `Cannot reinstate: booking status is "${booking.status}". Can only reinstate cancelled, no-show, or checked-out bookings.`,
          code: "INVALID_STATUS"
        });
      }

      // Проверка актуальности дат для cancelled/no_show
      if (booking.status === "cancelled" || booking.status === "no_show") {
        const today = new Date().toISOString().split("T")[0];
        if (booking.checkOutDate <= today) {
          return reply.status(400).send({
            error: `Нельзя восстановить: дата выезда (${booking.checkOutDate}) уже прошла.`,
            code: "DATES_EXPIRED",
          });
        }
      }

      // Проверка конфликта комнаты при восстановлении checked_out
      if (booking.status === "checked_out" && booking.roomId) {
        const conflict = await checkRoomConflict(app.db, booking.roomId, booking.checkInDate, booking.checkOutDate, booking.id);
        if (conflict) {
          return reply.status(400).send({
            error: `Нельзя восстановить: ${conflict}`,
            code: "ROOM_CONFLICT",
          });
        }
      }

      // Determine target status
      let targetStatus = "confirmed";
      let updates: Record<string, unknown> = {
        status: targetStatus,
        updatedAt: new Date(),
      };

      // If reinstating from checked_out, reopen the stay
      if (booking.status === "checked_out") {
        targetStatus = "checked_in";
        updates = {
          status: targetStatus,
          actualCheckOut: null,
          updatedAt: new Date(),
        };

        // Re-occupy the room if still assigned
        if (booking.roomId) {
          // Check if room is still available
          const [room] = await app.db
            .select()
            .from(rooms)
            .where(eq(rooms.id, booking.roomId));

          if (!room || room.occupancyStatus !== "vacant") {
            return reply.status(400).send({
              error: "Cannot reinstate: the room is no longer available. Please assign a new room.",
              code: "ROOM_NOT_AVAILABLE"
            });
          }
        }
      }

      // Clear cancellation-related fields when reinstating from cancelled
      if (booking.status === "cancelled" || booking.status === "no_show") {
        updates.actualCheckIn = null;
        updates.actualCheckOut = null;
      }

      const result = await app.db.transaction(async (tx) => {
        if (booking.status === "checked_out" && booking.roomId) {
          await tx
            .update(rooms)
            .set({
              occupancyStatus: "occupied",
              updatedAt: new Date(),
            })
            .where(eq(rooms.id, booking.roomId));
        }

        const [updated] = await tx
          .update(bookings)
          .set(updates)
          .where(eq(bookings.id, request.params.id))
          .returning();

        return updated;
      });

      return result;
    },
  );

  // Cancel booking
  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    "/api/bookings/:id/cancel",
    async (request, reply) => {
      const [booking] = await app.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, request.params.id));

      if (!booking) {
        return reply.status(404).send({
          error: "Booking not found",
          code: "BOOKING_NOT_FOUND"
        });
      }

      const allowedStatuses = ["confirmed", "no_show"];
      if (!allowedStatuses.includes(booking.status)) {
        let suggestion = "";
        if (booking.status === "checked_in") {
          suggestion = " The guest must check out first, or use 'Cancel Check-in' to undo the check-in.";
        } else if (booking.status === "checked_out") {
          suggestion = " The stay is already completed.";
        } else if (booking.status === "cancelled") {
          suggestion = " The booking is already cancelled.";
        }

        return reply.status(400).send({
          error: `Cannot cancel: booking status is "${booking.status}".${suggestion}`,
          code: "INVALID_STATUS",
          currentStatus: booking.status
        });
      }

      const [updated] = await app.db
        .update(bookings)
        .set({
          status: "cancelled",
          notes: request.body?.reason
            ? `${booking.notes || ""}\nCancelled: ${request.body.reason}`.trim()
            : booking.notes,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, request.params.id))
        .returning();

      return updated;
    },
  );
};
