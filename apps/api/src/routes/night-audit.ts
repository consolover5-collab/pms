import type { FastifyPluginAsync } from "fastify";
import { bookings, rooms } from "@pms/db";
import { eq, and, lt } from "drizzle-orm";

export const nightAuditRoutes: FastifyPluginAsync = async (app) => {
  // Пометить прошлые confirmed-брони как no_show
  app.post<{ Body: { propertyId: string } }>(
    "/api/night-audit/no-shows",
    async (request) => {
      const today = new Date().toISOString().split("T")[0];

      const updated = await app.db
        .update(bookings)
        .set({
          status: "no_show",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bookings.propertyId, request.body.propertyId),
            eq(bookings.status, "confirmed"),
            lt(bookings.checkInDate, today)
          )
        )
        .returning({ id: bookings.id, confirmationNumber: bookings.confirmationNumber });

      return {
        processed: updated.length,
        bookings: updated,
        message: `Помечено ${updated.length} бронирований как no-show.`,
      };
    }
  );

  // Синхронизация occupancyStatus комнат с бронированиями
  app.post<{ Body: { propertyId: string } }>(
    "/api/night-audit/sync-room-status",
    async (request) => {
      // Найти все checked_in брони с назначенной комнатой
      const checkedInBookings = await app.db
        .select({ roomId: bookings.roomId })
        .from(bookings)
        .where(
          and(
            eq(bookings.propertyId, request.body.propertyId),
            eq(bookings.status, "checked_in"),
          )
        );

      const occupiedRoomIds = checkedInBookings
        .map((b) => b.roomId)
        .filter((id): id is string => id !== null);

      let fixed = 0;

      // Пометить occupied комнаты с checked_in бронями
      for (const roomId of occupiedRoomIds) {
        const result = await app.db
          .update(rooms)
          .set({ occupancyStatus: "occupied", updatedAt: new Date() })
          .where(and(eq(rooms.id, roomId), eq(rooms.occupancyStatus, "vacant")))
          .returning();
        fixed += result.length;
      }

      // Пометить vacant комнаты БЕЗ checked_in броней
      const allOccupied = await app.db
        .select({ id: rooms.id })
        .from(rooms)
        .where(and(
          eq(rooms.propertyId, request.body.propertyId),
          eq(rooms.occupancyStatus, "occupied")
        ));

      for (const room of allOccupied) {
        if (!occupiedRoomIds.includes(room.id)) {
          await app.db
            .update(rooms)
            .set({ occupancyStatus: "vacant", updatedAt: new Date() })
            .where(eq(rooms.id, room.id));
          fixed++;
        }
      }

      return { fixed, message: `Исправлено ${fixed} комнат.` };
    }
  );
};
