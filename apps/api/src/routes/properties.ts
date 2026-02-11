import type { FastifyPluginAsync } from "fastify";
import { properties } from "@pms/db";
import { eq } from "drizzle-orm";

export const propertiesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/properties", async () => {
    return app.db.select().from(properties);
  });

  app.get<{ Params: { id: string } }>(
    "/api/properties/:id",
    async (request, reply) => {
      const [property] = await app.db
        .select()
        .from(properties)
        .where(eq(properties.id, request.params.id));
      if (!property) return reply.status(404).send({ error: "Not found" });
      return property;
    },
  );
};
