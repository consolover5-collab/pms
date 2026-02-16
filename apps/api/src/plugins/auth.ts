import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { sessions, users } from "@pms/db";
import { eq, and, gt } from "drizzle-orm";

const SESSION_COOKIE = "pms_session";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; username: string; role: string };
  }
}

// Routes that don't require authentication
function isPublicRoute(method: string, path: string): boolean {
  if (method === "GET" && path === "/health") return true;
  if (method === "POST" && path === "/api/auth/login") return true;
  return false;
}

// Role-based access control
function hasAccess(role: string, method: string, path: string): boolean {
  if (role === "admin") return true;

  if (role === "front_desk") {
    // Deny admin-only mutations
    if (path.startsWith("/api/rate-plans") && method !== "GET") return false;
    if (path.startsWith("/api/room-types") && method !== "GET") return false;
    if (path.startsWith("/api/properties") && method !== "GET") return false;
    if (path === "/api/business-date/initialize" && method === "POST")
      return false;
    return true;
  }

  if (role === "housekeeping") {
    if (path.startsWith("/api/rooms")) return true;
    if (path.startsWith("/api/auth")) return true;
    if (path === "/health") return true;
    return false;
  }

  return false;
}

const plugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("user", undefined);

  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0];
    const method = request.method;

    if (isPublicRoute(method, path)) return;

    const token = request.cookies[SESSION_COOKIE];
    if (!token) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const [session] = await app.db
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())),
      );

    if (!session) {
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return reply.status(401).send({ error: "Authentication required" });
    }

    const [user] = await app.db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.id, session.userId), eq(users.isActive, true)));

    if (!user) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    request.user = user;

    if (!hasAccess(user.role, method, path)) {
      return reply.status(403).send({ error: "Insufficient permissions" });
    }
  });
};

export const authPlugin = fp(plugin, {
  name: "auth-plugin",
  dependencies: ["db-plugin"],
});
