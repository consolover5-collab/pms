import type { FastifyPluginAsync } from "fastify";
import { businessDates } from "@pms/db";
import { eq, and } from "drizzle-orm";
import { isValidUuid } from "../lib/validation";

export const businessDateRoutes: FastifyPluginAsync = async (app) => {
  // Get current open business date
  app.get<{
    Querystring: { propertyId?: string };
  }>("/api/business-date", async (request, reply) => {
    const { propertyId } = request.query;
    if (!propertyId) {
      return reply.status(400).send({ error: "propertyId is required", code: "MISSING_PROPERTY_ID" });
    }
    if (!isValidUuid(propertyId)) {
      return reply.status(400).send({ error: "Invalid propertyId format", code: "INVALID_PROPERTY_ID" });
    }

    const [current] = await app.db
      .select({
        id: businessDates.id,
        propertyId: businessDates.propertyId,
        date: businessDates.date,
        status: businessDates.status,
      })
      .from(businessDates)
      .where(
        and(
          eq(businessDates.propertyId, propertyId),
          eq(businessDates.status, "open"),
        ),
      );

    if (!current) {
      return reply
        .status(404)
        .send({ error: "No open business date found", code: "NO_OPEN_BUSINESS_DATE" });
    }

    return current;
  });

  // Initialize first business date
  app.post<{
    Body: { propertyId: string; date: string };
  }>("/api/business-date/initialize", async (request, reply) => {
    const { propertyId, date } = request.body;
    if (!propertyId || !date) {
      return reply
        .status(400)
        .send({ error: "propertyId and date are required", code: "MISSING_FIELDS" });
    }
    if (!isValidUuid(propertyId)) {
      return reply.status(400).send({ error: "Invalid propertyId format", code: "INVALID_PROPERTY_ID" });
    }

    // Validate date format: YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({
        error: `Invalid date format: "${date}". Expected YYYY-MM-DD.`,
        code: "INVALID_DATE_FORMAT",
      });
    }

    // Validate it's a real date (not Feb 30, etc.)
    const parsed = new Date(date + "T00:00:00");
    if (
      isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    ) {
      return reply.status(400).send({
        error: `Invalid date: "${date}" is not a valid calendar date.`,
        code: "INVALID_DATE",
      });
    }

    // Check if open date already exists
    const [existing] = await app.db
      .select({ id: businessDates.id })
      .from(businessDates)
      .where(
        and(
          eq(businessDates.propertyId, propertyId),
          eq(businessDates.status, "open"),
        ),
      );

    if (existing) {
      return reply
        .status(409)
        .send({ error: "Business date already initialized", code: "ALREADY_INITIALIZED" });
    }

    const [created] = await app.db
      .insert(businessDates)
      .values({ propertyId, date, status: "open" })
      .returning();

    return reply.status(201).send(created);
  });
};
