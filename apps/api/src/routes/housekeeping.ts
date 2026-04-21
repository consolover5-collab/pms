import type { FastifyPluginAsync } from "fastify";
import { hkTasks, rooms, bookings, businessDates, profiles } from "@pms/db";
import { eq, and, sql, desc } from "drizzle-orm";

export const housekeepingRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/housekeeping/tasks?propertyId=...&assignedTo=...&status=...
  app.get<{
    Querystring: { propertyId: string; assignedTo?: string; status?: string };
  }>("/api/housekeeping/tasks", async (request) => {
    const { propertyId, assignedTo, status } = request.query;

    const [bizDate] = await app.db
      .select()
      .from(businessDates)
      .where(and(eq(businessDates.propertyId, propertyId), eq(businessDates.status, "open")));

    if (!bizDate) {
      return { data: [], businessDate: null };
    }

    const conditions = [
      eq(hkTasks.propertyId, propertyId),
      eq(hkTasks.businessDateId, bizDate.id),
    ];
    if (assignedTo) conditions.push(eq(hkTasks.assignedTo, assignedTo));
    if (status) conditions.push(eq(hkTasks.status, status));

    const data = await app.db
      .select({
        id: hkTasks.id,
        taskType: hkTasks.taskType,
        assignedTo: hkTasks.assignedTo,
        priority: hkTasks.priority,
        status: hkTasks.status,
        startedAt: hkTasks.startedAt,
        completedAt: hkTasks.completedAt,
        notes: hkTasks.notes,
        room: {
          id: rooms.id,
          roomNumber: rooms.roomNumber,
          floor: rooms.floor,
          housekeepingStatus: rooms.housekeepingStatus,
          occupancyStatus: rooms.occupancyStatus,
        },
      })
      .from(hkTasks)
      .innerJoin(rooms, eq(hkTasks.roomId, rooms.id))
      .where(and(...conditions))
      .orderBy(desc(hkTasks.priority), rooms.roomNumber);

    return { data, businessDate: bizDate.date };
  });

  // POST /api/housekeeping/generate — генерировать задачи на текущий день
  app.post<{
    Body: { propertyId: string };
  }>("/api/housekeeping/generate", async (request, reply) => {
    const { propertyId } = request.body;

    const [bizDate] = await app.db
      .select()
      .from(businessDates)
      .where(and(eq(businessDates.propertyId, propertyId), eq(businessDates.status, "open")));

    if (!bizDate) {
      return reply.status(400).send({ error: "No open business date", code: "NO_OPEN_BUSINESS_DATE" });
    }

    // Occupied rooms → stayover_clean
    const occupiedRooms = await app.db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(eq(rooms.propertyId, propertyId), eq(rooms.occupancyStatus, "occupied")));

    // Rooms from today's departures → checkout_clean
    const departureRooms = await app.db
      .select({ roomId: bookings.roomId })
      .from(bookings)
      .where(and(
        eq(bookings.propertyId, propertyId),
        eq(bookings.checkOutDate, bizDate.date),
        eq(bookings.status, "checked_out"),
      ));

    // VIP arrivals → inspection
    const vipArrivals = await app.db
      .select({ roomId: bookings.roomId })
      .from(bookings)
      .innerJoin(profiles, eq(bookings.guestProfileId, profiles.id))
      .where(and(
        eq(bookings.propertyId, propertyId),
        eq(bookings.checkInDate, bizDate.date),
        sql`${profiles.vipStatus} IS NOT NULL AND ${profiles.vipStatus} != ''`,
      ));

    let created = 0;

    // Stayover clean
    for (const room of occupiedRooms) {
      const inserted = await app.db
        .insert(hkTasks)
        .values({
          propertyId,
          roomId: room.id,
          businessDateId: bizDate.id,
          taskType: "stayover_clean",
        })
        .onConflictDoNothing()
        .returning({ id: hkTasks.id });
      if (inserted.length > 0) created++;
    }

    // Checkout clean
    for (const b of departureRooms) {
      if (!b.roomId) continue;
      const inserted = await app.db
        .insert(hkTasks)
        .values({
          propertyId,
          roomId: b.roomId,
          businessDateId: bizDate.id,
          taskType: "checkout_clean",
        })
        .onConflictDoNothing()
        .returning({ id: hkTasks.id });
      if (inserted.length > 0) created++;
    }

    // VIP inspection
    for (const b of vipArrivals) {
      if (!b.roomId) continue;
      const inserted = await app.db
        .insert(hkTasks)
        .values({
          propertyId,
          roomId: b.roomId,
          businessDateId: bizDate.id,
          taskType: "inspection",
          priority: 1,
        })
        .onConflictDoNothing()
        .returning({ id: hkTasks.id });
      if (inserted.length > 0) created++;
    }

    return { created, businessDate: bizDate.date };
  });

  // PATCH /api/housekeeping/tasks/:id — обновить статус задачи
  app.patch<{
    Params: { id: string };
    Body: { status?: string; assignedTo?: string; notes?: string };
  }>("/api/housekeeping/tasks/:id", async (request, reply) => {
    const { status, assignedTo, notes } = request.body;
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (status) {
      updates.status = status;
      if (status === "in_progress") updates.startedAt = new Date();
      if (status === "completed") updates.completedAt = new Date();
    }
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (notes !== undefined) updates.notes = notes;

    const [updated] = await app.db
      .update(hkTasks)
      .set(updates)
      .where(eq(hkTasks.id, request.params.id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Task not found", code: "TASK_NOT_FOUND" });

    // При завершении — обновить HK статус комнаты
    if (status === "completed") {
      const newHkStatus = updated.taskType === "inspection" ? "inspected" : "clean";
      await app.db
        .update(rooms)
        .set({ housekeepingStatus: newHkStatus, updatedAt: new Date() })
        .where(eq(rooms.id, updated.roomId));
    }

    return updated;
  });
};
