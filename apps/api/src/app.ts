import Fastify from "fastify";
import cors from "@fastify/cors";
import { dbPlugin } from "./db";
import { healthRoutes } from "./routes/health";
import { propertiesRoutes } from "./routes/properties";
import { roomTypesRoutes } from "./routes/room-types";
import { roomsRoutes } from "./routes/rooms";
import { guestsRoutes } from "./routes/guests";
import { bookingsRoutes } from "./routes/bookings";
import { ratePlansRoutes } from "./routes/rate-plans";
import { nightAuditRoutes } from "./routes/night-audit";
import { dashboardRoutes } from "./routes/dashboard";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(dbPlugin);
  await app.register(healthRoutes);
  await app.register(propertiesRoutes);
  await app.register(roomTypesRoutes);
  await app.register(roomsRoutes);
  await app.register(guestsRoutes);
  await app.register(bookingsRoutes);
  await app.register(ratePlansRoutes);
  await app.register(nightAuditRoutes);
  await app.register(dashboardRoutes);

  return app;
}
