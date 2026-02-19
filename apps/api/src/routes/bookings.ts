import type { FastifyPluginAsync } from "fastify";
import { bookings, guests, rooms, roomTypes, ratePlans, properties, folioTransactions, businessDates } from "@pms/db";
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
    throw { statusCode: 500, code: "NO_OPEN_BUSINESS_DATE", message: "Открытая бизнес-дата не найдена. Выполните ночной аудит." };
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
          ilike(guests.firstName, pattern),
          ilike(guests.lastName, pattern),
          ilike(bookings.confirmationNumber, pattern),
        )!,
      );
    }

    const whereCondition = and(...conditions);

    const [totalResult] = await app.db
      .select({ count: count() })
      .from(bookings)
      .innerJoin(guests, eq(bookings.guestId, guests.id))
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

      if (!booking) return reply.status(404).send({ error: "Бронирование не найдено" });
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
    // Проверка существования гостя
    const [guest] = await app.db.select({ id: guests.id }).from(guests).where(eq(guests.id, request.body.guestId));
    if (!guest) {
      return reply.status(400).send({ error: "Гость не найден.", code: "GUEST_NOT_FOUND" });
    }

    // Проверка существования типа комнаты
    const [rt] = await app.db.select().from(roomTypes).where(eq(roomTypes.id, request.body.roomTypeId));
    if (!rt) {
      return reply.status(400).send({ error: "Тип комнаты не найден.", code: "ROOM_TYPE_NOT_FOUND" });
    }

    // Проверка существования тарифного плана
    if (request.body.ratePlanId) {
      const [rp] = await app.db.select({ id: ratePlans.id }).from(ratePlans).where(eq(ratePlans.id, request.body.ratePlanId));
      if (!rp) {
        return reply.status(400).send({ error: "Тарифный план не найден.", code: "RATE_PLAN_NOT_FOUND" });
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
        error: `Дата заезда (${request.body.checkInDate}) не может быть раньше текущей бизнес-даты (${createBizDate}).`,
        code: "PAST_CHECKIN_DATE",
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

    // Sequential confirmation number: PROPERTY_CODE-NNNNNN
    // Wrapped in transaction to prevent duplicate confirmation numbers
    const [property] = await app.db
      .select({ code: properties.code })
      .from(properties)
      .where(eq(properties.id, request.body.propertyId));

    const propertyCode = property?.code || "PMS";

    // Авторасчёт totalAmount если не указан
    let calcTotalAmount = request.body.totalAmount;
    if (!calcTotalAmount && request.body.rateAmount) {
      const checkIn = new Date(request.body.checkInDate);
      const checkOut = new Date(request.body.checkOutDate);
      const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
      calcTotalAmount = String(Math.round(Number(request.body.rateAmount) * nights * 100) / 100);
    }

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

      return created;
    });

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
    // Загрузить текущее бронирование для merge с обновляемыми полями
    const [existing] = await app.db.select().from(bookings).where(eq(bookings.id, request.params.id));
    if (!existing) return reply.status(404).send({ error: "Бронирование не найдено" });

    // У заселённых броней можно только продлить выезд (checkOutDate), дата заезда заблокирована
    if (existing.status === "checked_in") {
      if (request.body.checkInDate) {
        return reply.status(400).send({
          error: `Нельзя изменить дату заезда: гость уже заселён. Можно только изменить дату выезда для продления проживания.`,
          code: "DATES_LOCKED",
        });
      }
      // Нельзя продлить на дату в прошлом
      if (request.body.checkOutDate) {
        const bizDateExtend = await getBusinessDate(app.db, existing.propertyId);
        if (request.body.checkOutDate <= bizDateExtend) {
          return reply.status(400).send({
            error: `Нельзя установить дату выезда (${request.body.checkOutDate}): она должна быть позже текущей бизнес-даты (${bizDateExtend}).`,
            code: "DATES_EXPIRED",
          });
        }
      }
    }
    // У выехавших броней даты не меняются совсем
    if (existing.status === "checked_out" && (request.body.checkInDate || request.body.checkOutDate)) {
      return reply.status(400).send({
        error: `Нельзя изменить даты бронирования со статусом "checked_out". Проживание завершено.`,
        code: "DATES_LOCKED",
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
          error: "Бронирование не найдено",
          code: "BOOKING_NOT_FOUND"
        });
      }

      if (booking.status !== "confirmed") {
        return reply.status(400).send({
          error: `Нельзя заселить: статус бронирования «${booking.status}». Заселить можно только подтверждённые брони.`,
          code: "INVALID_STATUS",
          currentStatus: booking.status
        });
      }

      // Validate check-in date — cannot check in before arrival date
      const bizDate = await getBusinessDate(app.db, booking.propertyId);
      if (booking.checkInDate > bizDate) {
        return reply.status(400).send({
          error: `Нельзя заселить: дата заезда (${booking.checkInDate}) ещё не наступила. Текущая бизнес-дата: ${bizDate}.`,
          code: "EARLY_CHECKIN",
          checkInDate: booking.checkInDate,
          businessDate: bizDate,
        });
      }

      // Determine room to use
      const roomId = request.body?.roomId || booking.roomId;
      if (!roomId) {
        return reply.status(400).send({
          error: "Комнату необходимо назначить перед заездом. Пожалуйста, назначьте комнату.",
          code: "NO_ROOM_ASSIGNED"
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
          throw Object.assign(new Error("Выбранная комната не найдена в системе"), {
            statusCode: 400, code: "ROOM_NOT_FOUND"
          });
        }

        // Check room type matches
        if (room.roomTypeId !== booking.roomTypeId) {
          throw Object.assign(new Error("Несоответствие типа комнаты: выбранная комната отличается от забронированного типа. Пожалуйста, выберите комнату нужного типа."), {
            statusCode: 400, code: "ROOM_TYPE_MISMATCH"
          });
        }

        // Check room is vacant
        if (room.occupancyStatus !== "vacant") {
          throw Object.assign(new Error(`Комната ${room.roomNumber} занята. Пожалуйста, выберите свободную комнату.`), {
            statusCode: 400, code: "ROOM_OCCUPIED", roomNumber: room.roomNumber
          });
        }

        // Check room is clean or inspected (not dirty, out of order, etc.)
        if (
          room.housekeepingStatus !== "clean" &&
          room.housekeepingStatus !== "inspected"
        ) {
          throw Object.assign(new Error(`Комната ${room.roomNumber} не готова к заселению (статус уборки: ${room.housekeepingStatus}). Дождитесь уборки или выберите другую комнату.`), {
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
          throw Object.assign(new Error(`В комнате ${room.roomNumber} уже проживает гость. Предыдущий гость должен выехать.`), {
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
          error: "Бронирование не найдено",
          code: "BOOKING_NOT_FOUND"
        });
      }

      if (booking.status !== "checked_in") {
        return reply.status(400).send({
          error: `Нельзя выселить: статус бронирования «${booking.status}». Выселить можно только заселённые брони.`,
          code: "INVALID_STATUS"
        });
      }

      // Validate checkout date against business date
      const bizDateOut = await getBusinessDate(app.db, booking.propertyId);
      const checkOutDate = booking.checkOutDate;

      if (checkOutDate > bizDateOut && !request.body?.force) {
        return reply.status(400).send({
          error: `Ранний выезд: дата выезда по брони ${checkOutDate}, текущая бизнес-дата ${bizDateOut}. Используйте force=true для досрочного выезда.`,
          code: "EARLY_CHECKOUT",
          checkOutDate,
          businessDate: bizDateOut,
        });
      }

      // Поздний выезд
      if (checkOutDate < bizDateOut && !request.body?.force) {
        return reply.status(400).send({
          error: `Поздний выезд: дата выезда была ${checkOutDate}, текущая бизнес-дата ${bizDateOut}. Возможно, нужно продлить бронь. Используйте force=true для подтверждения.`,
          code: "LATE_CHECKOUT",
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
          error: `Нельзя выехать: у гостя открытый баланс ${balance.toFixed(2)}. Примите оплату перед выездом.`,
          code: "UNPAID_BALANCE",
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
          error: "Бронирование не найдено",
          code: "BOOKING_NOT_FOUND"
        });
      }

      if (booking.status !== "checked_in") {
        return reply.status(400).send({
          error: `Нельзя отменить заезд: статус бронирования «${booking.status}». Отменить заезд можно только для заселённых броней.`,
          code: "INVALID_STATUS"
        });
      }

      // Отменить заезд можно только в дату заезда. Если гость уже ночевал — только выезд.
      const bizDateCancel = await getBusinessDate(app.db, booking.propertyId);
      if (booking.checkInDate !== bizDateCancel) {
        return reply.status(400).send({
          error: `Нельзя отменить заезд: гость уже проживает (заехал ${booking.checkInDate}, текущая бизнес-дата ${bizDateCancel}). Используйте «Check Out».`,
          code: "CANCEL_CHECKIN_TOO_LATE",
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
          error: "Бронирование не найдено",
          code: "BOOKING_NOT_FOUND"
        });
      }

      const allowedStatuses = ["cancelled", "no_show", "checked_out"];
      if (!allowedStatuses.includes(booking.status)) {
        return reply.status(400).send({
          error: `Нельзя восстановить: статус бронирования «${booking.status}». Восстановить можно только отменённые, незаехавшие или выехавшие брони.`,
          code: "INVALID_STATUS"
        });
      }

      // Проверка актуальности дат для cancelled
      if (booking.status === "cancelled") {
        const bizDateReinstate = await getBusinessDate(app.db, booking.propertyId);
        if (booking.checkOutDate <= bizDateReinstate) {
          return reply.status(400).send({
            error: `Нельзя восстановить: дата выезда (${booking.checkOutDate}) уже прошла (бизнес-дата: ${bizDateReinstate}).`,
            code: "DATES_EXPIRED",
          });
        }
        if (booking.checkInDate < bizDateReinstate) {
          return reply.status(400).send({
            error: `Нельзя восстановить: дата заезда (${booking.checkInDate}) уже прошла (бизнес-дата: ${bizDateReinstate}). Создайте новое бронирование с актуальными датами.`,
            code: "DATES_EXPIRED",
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
            error: `Нельзя восстановить: дата выезда (${booking.checkOutDate}) уже прошла (бизнес-дата: ${bizDateNoShow}).`,
            code: "DATES_EXPIRED",
          });
        }
        noShowNewCheckInDate = bizDateNoShow;
        // Проверяем конфликт комнаты по новой дате заезда
        if (booking.roomId) {
          const conflict = await checkRoomConflict(app.db, booking.roomId, bizDateNoShow, booking.checkOutDate, booking.id);
          if (conflict) {
            return reply.status(400).send({
              error: `Нельзя восстановить: ${conflict}`,
              code: "ROOM_CONFLICT",
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
            error: `Нельзя восстановить: ${conflict}`,
            code: "ROOM_CONFLICT",
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
            throw Object.assign(new Error("Нельзя восстановить: комната больше недоступна. Назначьте другую комнату."), {
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
        return reply.status(400).send({ error: "newRoomId обязателен", code: "MISSING_ROOM_ID" });
      }

      const [booking] = await app.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, request.params.id));

      if (!booking) {
        return reply.status(404).send({ error: "Бронирование не найдено", code: "BOOKING_NOT_FOUND" });
      }

      const [newRoom] = await app.db
        .select()
        .from(rooms)
        .where(and(eq(rooms.id, newRoomId), eq(rooms.propertyId, booking.propertyId)));

      if (!newRoom) {
        return reply.status(404).send({ error: "Комната не найдена", code: "ROOM_NOT_FOUND" });
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
          throw Object.assign(new Error("Комната уже занята. Выберите другую комнату."), {
            statusCode: 409, code: "ROOM_NOT_AVAILABLE",
          });
        }
        if (lockedNew.housekeepingStatus !== "clean" && lockedNew.housekeepingStatus !== "inspected") {
          throw Object.assign(new Error(`Комната не готова к заселению (статус уборки: ${lockedNew.housekeepingStatus}).`), {
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
          error: "Бронирование не найдено",
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
          error: `Нельзя отменить бронирование: в фолио ${txCount.n} транзакций. Гость уже проживал или оплачивал услуги.`,
          code: "HAS_FOLIO_TRANSACTIONS",
        });
      }

      const allowedStatuses = ["confirmed"];
      if (!allowedStatuses.includes(booking.status)) {
        let suggestion = "";
        if (booking.status === "checked_in") {
          suggestion = " Гость должен сначала выехать, или используйте «Отменить заезд» для отмены заселения.";
        } else if (booking.status === "checked_out") {
          suggestion = " Проживание уже завершено.";
        } else if (booking.status === "cancelled") {
          suggestion = " Бронирование уже отменено.";
        }

        return reply.status(400).send({
          error: `Нельзя отменить: статус бронирования «${booking.status}».${suggestion}`,
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
