import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { dbPlugin } from "./db";
import { authPlugin } from "./plugins/auth";
import { healthRoutes } from "./routes/health";
import { propertiesRoutes } from "./routes/properties";
import { roomTypesRoutes } from "./routes/room-types";
import { roomsRoutes } from "./routes/rooms";
import { profilesRoutes } from "./routes/profiles";
import { bookingsRoutes } from "./routes/bookings";
import { ratePlansRoutes } from "./routes/rate-plans";
import { nightAuditRoutes } from "./routes/night-audit";
import { dashboardRoutes } from "./routes/dashboard";
import { businessDateRoutes } from "./routes/business-date";
import { transactionCodesRoutes } from "./routes/transaction-codes";
import { folioRoutes } from "./routes/folio";
import { tapeChartRoutes } from "./routes/tape-chart";
import { authRoutes } from "./routes/auth";
import { housekeepingRoutes } from "./routes/housekeeping";
import { cashierRoutes } from "./routes/cashier";
import { packagesRoutes } from "./routes/packages";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(dbPlugin);
  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(propertiesRoutes);
  await app.register(roomTypesRoutes);
  await app.register(roomsRoutes);
  await app.register(profilesRoutes);
  await app.register(bookingsRoutes);
  await app.register(ratePlansRoutes);
  await app.register(nightAuditRoutes);
  await app.register(dashboardRoutes);
  await app.register(businessDateRoutes);
  await app.register(transactionCodesRoutes);
  await app.register(folioRoutes);
  await app.register(tapeChartRoutes);
  await app.register(authRoutes);
  await app.register(housekeepingRoutes);
  await app.register(cashierRoutes);
  await app.register(packagesRoutes);

  return app;
}
