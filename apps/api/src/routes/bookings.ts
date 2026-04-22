import type { FastifyPluginAsync } from "fastify";
import { bookings, profiles, rooms, roomTypes, ratePlans, properties, folioTransactions, businessDates, folioWindows } from "@pms/db";
import { eq, and, or, ne, lte, gte, lt, gt, sql, ilike, count } from "drizzle-orm";
import { validateBookingDates, validateOccupancy, checkRoomConflict, validateReinstateCheckedOut, validateRoomMove } from "../lib/validation";
import { calculateFolioBalance } from "@pms/domain";

/** Возвращает текущую открытую бизнес-дату отеля. Выбрасывает ошибку если открытой даты нет. */
async function getBusinessDate(db: any, propertyId: string): Promise<string> {
  const [bizDate] = await db
    .select({ date: businessDates.date })
    .from(businessDates)
    .where(and(eq(businessDates.propertyId, propertyId), eq(businessDates.status, "open")))
    .limit(1);
  if (!bizDate) {
    throw { statusCode: 500, code: "NO_OPEN_BUSINESS_DATE", message: "Open business date not found. Run night audit." };
  }
  return bizDate.date;
}

export const bookingsRoutes: FastifyPluginAsync = async (app) => {
  // List bookings with optional filters
  app.get<{
    Querystring: {
      propertyId: string;
      status?: string;
      roomId?: string;
      search?: string;
      limit?: string;
      offset?: string;
      view?: string;
      checkInDate?: string;
      checkOutDate?: string;
    };
  }>("/api/bookings", async (request) => {
    const { propertyId, status, roomId, search, limit, offset, view, checkInDate, checkOutDate } = request.query;
    const maxResults = Math.min(Number(limit) || 50, 100);
    const skip = Math.max(Number(offset) || 0, 0);

    const conditions = [eq(bookings.propertyId, propertyId)];

    if (view === "arrivals") {
      const bizDate = await getBusinessDate(app.db, propertyId);
      conditions.push(eq(bookings.checkInDate, bizDate));
      conditions.push(or(eq(bookings.status, "confirmed"), eq(bookings.status, "checked_in"))!);
    } else if (view === "departures") {
      const bizDate = await getBusinessDate(app.db, propertyId);
      conditions.push(eq(bookings.checkOutDate, bizDate));
      conditions.push(or(eq(bookings.status, "checked_in"), eq(bookings.status, "checked_out"))!);
    } else if (view === "inhouse") {
      conditions.push(eq(bookings.status, "checked_in"));
    } else {
      if (status) {
        conditions.push(eq(bookings.status, status));
      }
      if (checkInDate) {
        conditions.push(gte(bookings.checkInDate, checkInDate));
      }
      if (checkOutDate) {
        conditions.push(lte(bookings.checkOutDate, checkOutDate));
      }
    }

    if (roomId) {
      conditions.push(eq(bookings.roomId, roomId));
    }
    if (search && search.trim().length > 0) {
      const pattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(profiles.firstName, pattern),
          ilike(profiles.lastName, pattern),
          ilike(bookings.confirmationNumber, pattern),
        )!,
      );
    }

    const whereCondition = and(...conditions);

    const [totalResult] = await app.db
      .select({ count: count() })
      .from(bookings)
      .innerJoin(profiles, eq(bookings.guestProfileId, profiles.id))
      .where(whereCondition);

    const data = await app.db
      .select({
        id: bookings.id,
        confirmationNumber: bookings.confirmationNumber,
        checkInDate: bookings.checkInDate,
        checkOutDate: bookings.checkOutDate,
        status: bookings.status,
        adults: bookings.adults,
        children: bookings.children,
        guest: {
          id: profiles.id,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
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
      .innerJoin(profiles, eq(bookings.guestProfileId, profiles.id))
      .innerJoin(roomTypes, eq(bookings.roomTypeId, roomTypes.id))
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(whereCondition)
      .orderBy(bookings.checkInDate)
      .limit(maxResults)
      .offset(skip);

    return { data, total: totalResult.count };
  });

  // Get single booking with full details
  app.get<{ Params: { id: string } }>(
    "/api/bookings/:id",
    async (request, reply) => {
      const [booking] = await app.db
        .select({
          id: bookings.id,
          propertyId: bookings.propertyId,
          confirmationNumber: bookings.confirmationNumber,
          checkInDate: bookings.checkInDate,
          checkOutDate: bookings.checkOutDate,
          status: bookings.status,
          adults: bookings.adults,
          children: bookings.children,
          rateAmount: bookings.rateAmount,
          paymentMethod: bookings.paymentMethod,
          actualCheckIn: bookings.actualCheckIn,
          actualCheckOut: bookings.actualCheckOut,
          companyProfileId: bookings.companyProfileId,
          agentProfileId: bookings.agentProfileId,
          sourceProfileId: bookings.sourceProfileId,
          notes: bookings.notes,
          createdAt: bookings.createdAt,
          updatedAt: bookings.updatedAt,
          guest: {
            id: profiles.id,
            firstName: profiles.firstName,
            lastName: profiles.lastName,
            email: profiles.email,
            phone: profiles.phone,
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
        .innerJoin(profiles, eq(bookings.guestProfileId, profiles.id))
        .innerJoin(roomTypes, eq(bookings.roomTypeId, roomTypes.id))
        .leftJoin(rooms, eq(bookings.roomId, rooms.id))
        .leftJoin(ratePlans, eq(bookings.ratePlanId, ratePlans.id))
        .where(eq(bookings.id, request.params.id));

      if (!booking) return reply.status(404).send({ error: "Booking not found", code: "BOOKING_NOT_FOUND" });
      return booking;
    },
  );

  // Create booking
  app.post<{
    Body: {
      propertyId: string;
      guestProfileId: string;
      companyProfileId?: string;
      agentProfileId?: string;
      sourceProfileId?: string;
      roomId?: string;
      roomTypeId: string;
      ratePlanId?: string;
      checkInDate: string;
      checkOutDate: string;
      adults?: number;
      children?: number;
      rateAmount?: string;
      paymentMethod?: string;
      notes?: string;
      guaranteeCode?: string;
      marketCode?: string;
      sourceCode?: string;
      channel?: string;
    };
  }>("/api/bookings", async (request, reply) => {
    // Проверка существования гостя
    const [guestProfile] = await app.db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, request.body.guestProfileId));
    if (!guestProfile) {
      return reply.status(400).send({ error: "Guest profile not found.", code: "GUEST_NOT_FOUND" });
    }

    // Проверка существования типа комнаты
    const [rt] = await app.db.select().from(roomTypes).where(eq(roomTypes.id, request.body.roomTypeId));
    if (!rt) {
      return reply.status(400).send({ error: "Room type not found.", code: "ROOM_TYPE_NOT_FOUND" });
    }

    // Проверка существования тарифного плана
    if (request.body.ratePlanId) {
      const [rp] = await app.db.select({ id: ratePlans.id }).from(ratePlans).where(eq(ratePlans.id, request.body.ratePlanId));
      if (!rp) {
        return reply.status(400).send({ error: "Rate plan not found.", code: "RATE_PLAN_NOT_FOUND" });
      }
    }

    // Валидация дат
    const dateError = validateBookingDates(request.body.checkInDate, request.body.checkOutDate);
    if (dateError) {
      return reply.status(400).send({ error: dateError, code: "INVALID_DATES" });
    }

    // Дата заезда не может быть раньше текущей бизнес-даты
    const createBizDate = await getBusinessDate(app.db, request.body.propertyId);
    if (request.body.checkInDate < createBizDate) {
      return reply.status(400).send({
        error: `Check-in date (${request.body.checkInDate}) cannot be before current business date (${createBizDate}).`, code: "PAST_CHECKIN_DATE",
      });
    }

    // Проверка вместимости
    const adults = request.body.adults || 1;
    const children = request.body.children || 0;
    const occError = validateOccupancy(adults, children, rt.maxOccupancy);
    if (occError) {
      return reply.status(400).send({ error: occError, code: "EXCEEDS_OCCUPANCY" });
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
        return reply.status(400).send({ error: "Specified room not found.", code: "ROOM_NOT_FOUND" });
      }
      if (assignedRoom.roomTypeId !== request.body.roomTypeId) {
        return reply.status(400).send({ error: "Room type does not match booking type.", code: "ROOM_TYPE_MISMATCH" });
      }
      if (assignedRoom.housekeepingStatus === "out_of_order" || assignedRoom.housekeepingStatus === "out_of_service") {
        return reply.status(400).send({
          error: `Room ${assignedRoom.roomNumber} is unavailable (${assignedRoom.housekeepingStatus === "out_of_order" ? "out of order" : "out of service"}).`, code: "ROOM_UNAVAILABLE",
        });
      }
    }

    // Sequential confirmation number: PROPERTY_CODE-NNNNNN
    // Wrapped in transaction to prevent duplicate confirmation numbers
    const [property] = await app.db
      .select({ code: properties.code })
      .from(properties)
      .where(eq(properties.id, request.body.propertyId));

    const propertyCode = property?.code || "PMS";

    const booking = await app.db.transaction(async (tx) => {
      const prefix = propertyCode + "-";
      // Lock bookings table for this property to prevent concurrent inserts
      await tx.execute(sql`SELECT 1 FROM bookings WHERE property_id = ${request.body.propertyId} ORDER BY confirmation_number DESC LIMIT 1 FOR UPDATE`);

      const [lastBooking] = await tx
        .select({ confirmationNumber: bookings.confirmationNumber })
        .from(bookings)
        .where(
          and(
            eq(bookings.propertyId, request.body.propertyId),
            sql`confirmation_number LIKE ${prefix + "%"}`,
          ),
        )
        .orderBy(sql`confirmation_number DESC`)
        .limit(1);

      let nextSeq = 1;
      if (lastBooking) {
        const lastSeqStr = lastBooking.confirmationNumber.replace(prefix, "");
        const lastSeq = parseInt(lastSeqStr, 10);
        if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
      }

      const confNum = prefix + String(nextSeq).padStart(6, "0");

      const [created] = await tx
        .insert(bookings)
        .values({
          propertyId: request.body.propertyId,
          guestProfileId: request.body.guestProfileId,
          companyProfileId: request.body.companyProfileId || null,
          agentProfileId: request.body.agentProfileId || null,
          sourceProfileId: request.body.sourceProfileId || null,
          roomId: request.body.roomId || null,
          roomTypeId: request.body.roomTypeId,
          ratePlanId: request.body.ratePlanId || null,
          checkInDate: request.body.checkInDate,
          checkOutDate: request.body.checkOutDate,
          adults: request.body.adults || 1,
          children: request.body.children || 0,
          rateAmount: request.body.rateAmount || null,
          paymentMethod: request.body.paymentMethod || null,
          guaranteeCode: request.body.guaranteeCode || null,
          marketCode: request.body.marketCode || null,
          sourceCode: request.body.sourceCode || null,
          channel: request.body.channel || null,
          notes: request.body.notes || null,
          confirmationNumber: confNum,
          status: "confirmed",
        })
        .returning();

      // Create Folio Window 1 (Guest)
      const [guestProfile] = await tx
        .select({ name: profiles.name })
        .from(profiles)
        .where(eq(profiles.id, request.body.guestProfileId));

      await tx.insert(folioWindows).values({
        bookingId: created.id,
        windowNumber: 1,
        label: guestProfile?.name || "Guest",
        profileId: request.body.guestProfileId,
      });

      // Create Folio Window 2 (Company) if exists
      if (request.body.companyProfileId) {
        const [companyProfile] = await tx
          .select({ name: profiles.name })
          .from(profiles)
          .where(eq(profiles.id, request.body.companyProfileId));

        if (companyProfile) {
          await tx.insert(folioWindows).values({
            bookingId: created.id,
            windowNumber: 2,
            label: companyProfile.name,
            profileId: request.body.companyProfileId,
          });
        }
      }

      return created;
    });

    return reply.status(201).send(booking);
  });

  // Update booking
  app.put<{
    Params: { id: string };
    Body: {
      guestProfileId?: string;
      companyProfileId?: string;
      agentProfileId?: string;
      sourceProfileId?: string;
      roomId?: string;
      roomTypeId?: string;
      ratePlanId?: string;
      checkInDate?: string;
      checkOutDate?: string;
      adults?: number;
      children?: number;
      rateAmount?: string;
      paymentMethod?: string;
      notes?: string;
      guaranteeCode?: string;
      marketCode?: string;
      sourceCode?: string;
      channel?: string;
    };
  }>("/api/bookings/:id", async (request, reply) => {
    // Загрузить текущее бронирование для merge с обновляемыми полями
    const [existing] = await app.db.select().from(bookings).where(eq(bookings.id, request.params.id));
    if (!existing) return reply.status(404).send({ error: "Booking not found", code: "BOOKING_NOT_FOUND" });

    // У заселённых броней можно только продлить выезд (checkOutDate), дата заезда заблокирована
    if (existing.status === "checked_in") {
      if (request.body.checkInDate) {
        return reply.status(400).send({
          error: `Cannot change check-in date: guest is already checked in. You can only change the check-out date to extend the stay.`, code: "DATES_LOCKED",
        });
      }
      // Нельзя продлить на дату в прошлом (checkOut = bizDate разрешено — due out today)
      if (request.body.checkOutDate) {
        const bizDateExtend = await getBusinessDate(app.db, existing.propertyId);
        if (request.body.checkOutDate < bizDateExtend) {
          return reply.status(400).send({
            error: `Cannot set check-out date to (${request.body.checkOutDate}): it cannot be before current business date (${bizDateExtend}).`, code: "DATES_EXPIRED",
          });
        }
      }
    }
    // У выехавших броней даты не меняются совсем
    if (existing.status === "checked_out" && (request.body.checkInDate || request.body.checkOutDate)) {
      return reply.status(400).send({
        error: `Cannot change dates for booking with status "checked_out". Stay is completed.`, code: "DATES_LOCKED",
      });
    }

    const effectiveCheckIn = request.body.checkInDate || existing.checkInDate;
    const effectiveCheckOut = request.body.checkOutDate || existing.checkOutDate;
    const effectiveRoomId = request.body.roomId !== undefined ? request.body.roomId : existing.roomId;

    // Валидация дат при обновлении
    if (request.body.checkInDate || request.body.checkOutDate) {
      const dateError = validateBookingDates(effectiveCheckIn, effectiveCheckOut);
      if (dateError) {
        return reply.status(400).send({ error: dateError, code: "INVALID_DATES" });
      }
    }

    // Проверка конфликта комнаты при обновлении дат ИЛИ комнаты
    if (effectiveRoomId && (request.body.roomId || request.body.checkInDate || request.body.checkOutDate)) {
      const conflict = await checkRoomConflict(app.db, effectiveRoomId, effectiveCheckIn, effectiveCheckOut, request.params.id);
      if (conflict) {
        return reply.status(400).send({ error: conflict, code: "ROOM_CONFLICT" });
      }
    }

    const [updated] = await app.db
      .update(bookings)
      .set({ ...request.body, updatedAt: new Date() })
      .where(eq(bookings.id, request.params.id))
      .returning();

    return updated;
  });

  // Check-in with business logic validation
  app.post<{ Params: { id: string }; Body: { roomId?: string; force?: boolean } }>(
    "/api/bookings/:id/check-in",
    async (request, reply) => {
      const forceCheckIn = request.body?.force === true;
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
          error: `Cannot check in: booking status is "${booking.status}". Only confirmed bookings can be checked in.`, code: "INVALID_STATUS",
          currentStatus: booking.status
        });
      }

      // Validate check-in date — cannot check in before arrival date
      const bizDate = await getBusinessDate(app.db, booking.propertyId);
      if (booking.checkInDate > bizDate) {
        return reply.status(400).send({
          error: `Cannot check in: arrival date (${booking.checkInDate}) has not been reached. Current business date: ${bizDate}.`, code: "EARLY_CHECKIN",
          checkInDate: booking.checkInDate,
          businessDate: bizDate,
        });
      }

      // Determine room to use
      const roomId = request.body?.roomId || booking.roomId;
      if (!roomId) {
        return reply.status(400).send({
          error: "A room must be assigned before check-in. Please assign a room.", code: "NO_ROOM_ASSIGNED"
        });
      }

      // Wrap entire check-in in a transaction with SELECT ... FOR UPDATE to prevent race conditions
      const result = await app.db.transaction(async (tx) => {
        // Lock the room row to prevent concurrent check-ins
        await tx.execute(sql`SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE`);

        // Validate room inside the transaction (after locking)
        const [room] = await tx
          .select()
          .from(rooms)
          .where(eq(rooms.id, roomId));

        if (!room) {
          throw Object.assign(new Error("Selected room not found in the system"), {
            statusCode: 400, code: "ROOM_NOT_FOUND"
          });
        }

        // Check room type matches
        if (room.roomTypeId !== booking.roomTypeId) {
          throw Object.assign(new Error("Room type mismatch: selected room differs from booked type. Please choose a room of the correct type."), {
            statusCode: 400, code: "ROOM_TYPE_MISMATCH"
          });
        }

        // Check room is vacant
        if (room.occupancyStatus !== "vacant") {
          throw Object.assign(new Error(`Room ${room.roomNumber} is occupied. Please choose a vacant room.`), {
            statusCode: 400, code: "ROOM_OCCUPIED", roomNumber: room.roomNumber
          });
        }

        // Check room is clean or inspected (not dirty, out of order, etc.)
        // force=true allows override for dirty/pickup rooms (operator takes responsibility),
        // but OOO/OOS still block — those are physical unavailability, not a cleanliness gate.
        const hkClean =
          room.housekeepingStatus === "clean" ||
          room.housekeepingStatus === "inspected";
        const hkForceable =
          room.housekeepingStatus === "dirty" ||
          room.housekeepingStatus === "pickup";
        if (!hkClean && !(forceCheckIn && hkForceable)) {
          throw Object.assign(new Error(`Room ${room.roomNumber} is not ready for check-in (status: ${room.housekeepingStatus}). Wait for housekeeping or choose another room.`), {
            statusCode: 400, code: "ROOM_NOT_READY", roomNumber: room.roomNumber,
            housekeepingStatus: room.housekeepingStatus
          });
        }

        // Check for conflicting bookings on this room
        const conflictingBookings = await tx
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
          throw Object.assign(new Error(`Room ${room.roomNumber} already has a guest. Previous guest must check out.`), {
            statusCode: 400, code: "ROOM_HAS_GUEST", roomNumber: room.roomNumber
          });
        }

        // All validations passed - perform check-in
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
      }).catch((err: any) => {
        if (err.statusCode) {
          reply.status(err.statusCode).send({
            error: err.message,
            code: err.code,
            ...(err.roomNumber ? { roomNumber: err.roomNumber } : {}),
            ...(err.housekeepingStatus ? { housekeepingStatus: err.housekeepingStatus } : {}),
          });
          return null;
        }
        throw err;
      });

      if (result === null) return; // already sent error reply
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
          error: `Cannot check out: booking status is "${booking.status}". Only checked-in bookings can be checked out.`, code: "INVALID_STATUS"
        });
      }

      // Validate checkout date against business date
      const bizDateOut = await getBusinessDate(app.db, booking.propertyId);
      const checkOutDate = booking.checkOutDate;

      if (checkOutDate > bizDateOut && !request.body?.force) {
        return reply.status(400).send({
          error: `Early checkout: booking departure date ${checkOutDate}, current business date ${bizDateOut}. Use force=true for early checkout.`, code: "EARLY_CHECKOUT",
          checkOutDate,
          businessDate: bizDateOut,
        });
      }

      // Поздний выезд
      if (checkOutDate < bizDateOut && !request.body?.force) {
        return reply.status(400).send({
          error: `Late checkout: departure date was ${checkOutDate}, current business date ${bizDateOut}. Booking may need extension. Use force=true to confirm.`, code: "LATE_CHECKOUT",
          checkOutDate,
          businessDate: bizDateOut,
        });
      }

      // Проверка баланса фолио: нельзя выезжать с положительным балансом
      const folioTxs = await app.db
        .select({ debit: folioTransactions.debit, credit: folioTransactions.credit })
        .from(folioTransactions)
        .where(eq(folioTransactions.bookingId, request.params.id));

      const balance = calculateFolioBalance(folioTxs);
      if (balance > 0) {
        return reply.status(400).send({
          error: `Cannot check out: guest has open balance of ${balance.toFixed(2)}. Accept payment before checkout.`, code: "UNPAID_BALANCE",
          balance,
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
            .where(and(eq(rooms.id, booking.roomId), eq(rooms.propertyId, booking.propertyId)));
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
          error: `Cannot cancel check-in: booking status is "${booking.status}". Only checked-in bookings can be canceled.`, code: "INVALID_STATUS"
        });
      }

      // Отменить заезд можно только в дату заезда. Если гость уже ночевал — только выезд.
      const bizDateCancel = await getBusinessDate(app.db, booking.propertyId);
      if (booking.checkInDate !== bizDateCancel) {
        return reply.status(400).send({
          error: `Cannot cancel check-in: guest is already staying (arrived ${booking.checkInDate}, current business date ${bizDateCancel}). Use "Check Out".`, code: "CANCEL_CHECKIN_TOO_LATE",
          checkInDate: booking.checkInDate,
          businessDate: bizDateCancel,
        });
      }

      const result = await app.db.transaction(async (tx) => {
        if (booking.roomId) {
          await tx
            .update(rooms)
            .set({
              occupancyStatus: "vacant",
              updatedAt: new Date(),
            })
            .where(and(eq(rooms.id, booking.roomId), eq(rooms.propertyId, booking.propertyId)));
        }

        const [updated] = await tx
          .update(bookings)
          .set({
            status: "confirmed",
            roomId: null,
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
          error: `Cannot reinstate: booking status is "${booking.status}". Only cancelled, no-show or checked-out bookings can be reinstated.`, code: "INVALID_STATUS"
        });
      }

      // Проверка актуальности дат для cancelled
      if (booking.status === "cancelled") {
        const bizDateReinstate = await getBusinessDate(app.db, booking.propertyId);
        if (booking.checkOutDate <= bizDateReinstate) {
          return reply.status(400).send({
            error: `Cannot reinstate: check-out date (${booking.checkOutDate}) has already passed (business date: ${bizDateReinstate}).`, code: "DATES_EXPIRED",
          });
        }
        if (booking.checkInDate < bizDateReinstate) {
          return reply.status(400).send({
            error: `Cannot reinstate: check-in date (${booking.checkInDate}) has already passed (business date: ${bizDateReinstate}). Create a new booking with valid dates.`, code: "DATES_EXPIRED",
          });
        }
      }

      // Для no_show: дата заезда переносится на текущую бизнес-дату (гость приехал после аудита).
      // Блокируем только если дата выезда уже прошла — переселять некуда.
      let noShowNewCheckInDate: string | null = null;
      if (booking.status === "no_show") {
        const bizDateNoShow = await getBusinessDate(app.db, booking.propertyId);
        if (booking.checkOutDate <= bizDateNoShow) {
          return reply.status(400).send({
            error: `Cannot reinstate: check-out date (${booking.checkOutDate}) has already passed (business date: ${bizDateNoShow}).`, code: "DATES_EXPIRED",
          });
        }
        noShowNewCheckInDate = bizDateNoShow;
        // Проверяем конфликт комнаты по новой дате заезда
        if (booking.roomId) {
          const conflict = await checkRoomConflict(app.db, booking.roomId, bizDateNoShow, booking.checkOutDate, booking.id);
          if (conflict) {
            return reply.status(400).send({
              error: `Cannot reinstate: ${conflict}`, code: "ROOM_CONFLICT",
            });
          }
        }
      }

      // Проверка актуальности дат для checked_out
      if (booking.status === "checked_out") {
        const bizDateCheckedOut = await getBusinessDate(app.db, booking.propertyId);
        const dateError = validateReinstateCheckedOut(booking.checkOutDate, bizDateCheckedOut);
        if (dateError) {
          return reply.status(400).send({ error: dateError, code: "DATES_EXPIRED" });
        }
      }

      // Проверка конфликта комнаты при восстановлении checked_out
      if (booking.status === "checked_out" && booking.roomId) {
        const conflict = await checkRoomConflict(app.db, booking.roomId, booking.checkInDate, booking.checkOutDate, booking.id);
        if (conflict) {
          return reply.status(400).send({
            error: `Cannot reinstate: ${conflict}`, code: "ROOM_CONFLICT",
          });
        }
      }

      // Determine target status
      let targetStatus: string = "confirmed";
      let updates: Record<string, unknown> = {
        status: targetStatus,
        updatedAt: new Date(),
      };

      if (booking.status === "checked_out") {
        targetStatus = "checked_in";
        updates = {
          status: targetStatus,
          actualCheckOut: null,
          updatedAt: new Date(),
        };
      }

      // Clear cancellation-related fields when reinstating from cancelled/no_show
      if (booking.status === "cancelled" || booking.status === "no_show") {
        updates.actualCheckIn = null;
        updates.actualCheckOut = null;
      }

      // Перенос даты заезда на бизнес-дату при восстановлении из no_show
      if (noShowNewCheckInDate) {
        updates.checkInDate = noShowNewCheckInDate;
      }

      const result = await app.db.transaction(async (tx) => {
        // Re-occupy the room if reinstating from checked_out — atomically
        if (booking.status === "checked_out" && booking.roomId) {
          // Lock and check room availability inside transaction
          await tx.execute(sql`SELECT id FROM rooms WHERE id = ${booking.roomId} FOR UPDATE`);

          const [room] = await tx
            .select()
            .from(rooms)
            .where(and(eq(rooms.id, booking.roomId), eq(rooms.propertyId, booking.propertyId)));

          if (!room || room.occupancyStatus !== "vacant") {
            throw Object.assign(new Error("Cannot reinstate: room is no longer available. Assign a different room."), {
              statusCode: 400, code: "ROOM_NOT_AVAILABLE"
            });
          }

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
      }).catch((err: any) => {
        if (err.statusCode) {
          reply.status(err.statusCode).send({ error: err.message, code: err.code });
          return null;
        }
        throw err;
      });

      if (result === null) return;
      return result;
    },
  );

  // Room move: переселить заселённого гостя в другую комнату
  app.post<{ Params: { id: string }; Body: { newRoomId: string } }>(
    "/api/bookings/:id/room-move",
    async (request, reply) => {
      const { newRoomId } = request.body || {};

      if (!newRoomId) {
        return reply.status(400).send({ error: "newRoomId is required", code: "MISSING_ROOM_ID" });
      }

      const [booking] = await app.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, request.params.id));

      if (!booking) {
        return reply.status(404).send({ error: "Booking not found", code: "BOOKING_NOT_FOUND" });
      }

      const [newRoom] = await app.db
        .select()
        .from(rooms)
        .where(and(eq(rooms.id, newRoomId), eq(rooms.propertyId, booking.propertyId)));

      if (!newRoom) {
        return reply.status(404).send({ error: "Room not found", code: "ROOM_NOT_FOUND" });
      }

      const validationError = validateRoomMove(booking, newRoom);
      if (validationError) {
        return reply.status(400).send({ error: validationError, code: "ROOM_MOVE_INVALID" });
      }

      // Транзакция: блокируем обе комнаты в стабильном порядке (по ID) во избежание дедлоков
      const result = await app.db.transaction(async (tx) => {
        const lockIds = ([booking.roomId, newRoomId].filter(Boolean) as string[]).sort();
        for (const rid of lockIds) {
          await tx.execute(sql`SELECT id FROM rooms WHERE id = ${rid} FOR UPDATE`);
        }

        // Повторно проверяем статус новой комнаты внутри транзакции
        const [lockedNew] = await tx
          .select({ occupancyStatus: rooms.occupancyStatus, housekeepingStatus: rooms.housekeepingStatus })
          .from(rooms)
          .where(eq(rooms.id, newRoomId));

        if (!lockedNew || lockedNew.occupancyStatus !== "vacant") {
          throw Object.assign(new Error("Room is already occupied. Choose a different room."), {
            statusCode: 409, code: "ROOM_NOT_AVAILABLE",
          });
        }
        if (lockedNew.housekeepingStatus !== "clean" && lockedNew.housekeepingStatus !== "inspected") {
          throw Object.assign(new Error(`Room is not ready for check-in (housekeeping status: ${lockedNew.housekeepingStatus}).`), {
            statusCode: 409, code: "ROOM_NOT_READY",
          });
        }

        // Старая комната → свободна + грязная
        if (booking.roomId) {
          await tx.update(rooms)
            .set({ occupancyStatus: "vacant", housekeepingStatus: "dirty", updatedAt: new Date() })
            .where(eq(rooms.id, booking.roomId));
        }

        // Новая комната → занята
        await tx.update(rooms)
          .set({ occupancyStatus: "occupied", updatedAt: new Date() })
          .where(eq(rooms.id, newRoomId));

        // Обновляем бронь
        const [updated] = await tx
          .update(bookings)
          .set({ roomId: newRoomId, updatedAt: new Date() })
          .where(eq(bookings.id, request.params.id))
          .returning();

        return updated;
      }).catch((err: any) => {
        if (err.statusCode) {
          reply.status(err.statusCode).send({ error: err.message, code: err.code });
          return null;
        }
        throw err;
      });

      if (result === null) return;
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

      // Нельзя отменить бронирование с транзакциями в фолио (гость реально проживал)
      const [txCount] = await app.db
        .select({ n: count() })
        .from(folioTransactions)
        .where(eq(folioTransactions.bookingId, booking.id));
      if (txCount.n > 0) {
        return reply.status(400).send({
          error: `Cannot cancel booking: folio has ${txCount.n} transactions. Guest has already stayed or paid.`, code: "HAS_FOLIO_TRANSACTIONS",
        });
      }

      const allowedStatuses = ["confirmed"];
      if (!allowedStatuses.includes(booking.status)) {
        let suggestion = "";
        if (booking.status === "checked_in") {
          suggestion = " Guest must check out first, or use cancel check-in.";
        } else if (booking.status === "checked_out") {
          suggestion = " Stay is already completed.";
        } else if (booking.status === "cancelled") {
          suggestion = " Booking is already cancelled.";
        }

        return reply.status(400).send({
          error: `Cannot cancel: booking status is "${booking.status}".${suggestion}`, code: "INVALID_STATUS",
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
