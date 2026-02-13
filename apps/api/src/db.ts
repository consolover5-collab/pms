import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { createDb, type Database } from "@pms/db";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const db = createDb(url);
  app.decorate("db", db);
};

export const dbPlugin = fp(plugin, {
  name: "db-plugin",
});
