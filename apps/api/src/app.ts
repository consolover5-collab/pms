import Fastify from "fastify";
import cors from "@fastify/cors";
import { dbPlugin } from "./db";
import { healthRoutes } from "./routes/health";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(dbPlugin);
  await app.register(healthRoutes);

  return app;
}
