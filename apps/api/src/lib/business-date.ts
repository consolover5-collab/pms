import type { Database } from "@pms/db";
import { businessDates } from "@pms/db";
import { eq, and } from "drizzle-orm";

export async function getBusinessDate(
  db: Database,
  propertyId: string
): Promise<{ id: string; date: string }> {
  const [bizDate] = await db
    .select({ id: businessDates.id, date: businessDates.date })
    .from(businessDates)
    .where(and(eq(businessDates.propertyId, propertyId), eq(businessDates.status, "open")))
    .limit(1);
  if (!bizDate) {
    throw { statusCode: 500, code: "NO_OPEN_BUSINESS_DATE",
            message: "No open business date found. Please run night audit." };
  }
  return bizDate;
}
