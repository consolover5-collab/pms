import type { FastifyPluginAsync } from "fastify";
import { users, sessions } from "@pms/db";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

const SESSION_COOKIE = "pms_session";
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/auth/login
  app.post<{
    Body: { username?: string; password?: string };
  }>("/api/auth/login", async (request, reply) => {
    const { username, password } = request.body || {};

    if (!username || !password) {
      return reply
        .status(400)
        .send({ error: "Username and password are required", code: "MISSING_CREDENTIALS" });
    }

    // Find user
    const [user] = await app.db
      .select()
      .from(users)
      .where(and(eq(users.username, username), eq(users.isActive, true)));

    if (!user) {
      return reply
        .status(401)
        .send({ error: "Invalid username or password", code: "INVALID_CREDENTIALS" });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply
        .status(401)
        .send({ error: "Invalid username or password", code: "INVALID_CREDENTIALS" });
    }

    // Create session
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

    await app.db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt,
    });

    // Set cookie
    reply.setCookie(SESSION_COOKIE, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });

    return { id: user.id, username: user.username, role: user.role };
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      await app.db.delete(sessions).where(eq(sessions.token, token));
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
    }
    return { ok: true };
  });

  // GET /api/auth/me
  app.get("/api/auth/me", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) {
      return reply.status(401).send({ error: "Not authenticated", code: "NOT_AUTHENTICATED" });
    }

    const [session] = await app.db
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())),
      );

    if (!session) {
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return reply.status(401).send({ error: "Session expired", code: "SESSION_EXPIRED" });
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
      return reply.status(401).send({ error: "User not found", code: "USER_NOT_FOUND" });
    }

    return user;
  });
};
