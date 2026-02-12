import Fastify from "fastify";
import cors from "@fastify/cors";
import { dbPlugin } from "./db";
import { healthRoutes } from "./routes/health";
import { propertiesRoutes } from "./routes/properties";
import { roomTypesRoutes } from "./routes/room-types";
import { roomsRoutes } from "./routes/rooms";
import { guestsRoutes } from "./routes/guests";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(dbPlugin);
  await app.register(healthRoutes);
  await app.register(propertiesRoutes);
  await app.register(roomTypesRoutes);
  await app.register(roomsRoutes);
  await app.register(guestsRoutes);

  return app;
}
