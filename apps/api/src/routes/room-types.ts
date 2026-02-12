import type { FastifyPluginAsync } from "fastify";
import { roomTypes } from "@pms/db";
import { eq } from "drizzle-orm";

export const roomTypesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { propertyId: string } }>(
    "/api/room-types",
    async (request) => {
      const { propertyId } = request.query;
      return app.db
        .select()
        .from(roomTypes)
        .where(eq(roomTypes.propertyId, propertyId))
        .orderBy(roomTypes.sortOrder);
    },
  );
};
