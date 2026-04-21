import { API_URL, GBH_PROPERTY_ID } from './shared.ts';
import { SEED } from './seed-refs.ts';

/**
 * Minimal fixture helpers. Used by pre-flight remediation when seed data is short.
 * Each function is idempotent-ish: it creates only if counts are insufficient.
 */

type ProfilesPage = { data: unknown[]; total: number };

export async function ensureGuests(minCount = 3): Promise<number> {
  const res = await fetch(
    `${API_URL}/api/profiles?propertyId=${GBH_PROPERTY_ID}&type=individual`,
  );
  const page = (await res.json()) as ProfilesPage;
  if (page.total >= minCount) return page.total;

  const toCreate = minCount - page.total;
  const names = [
    { firstName: 'Audit', lastName: 'Fixture-A' },
    { firstName: 'Audit', lastName: 'Fixture-B' },
    { firstName: 'Audit', lastName: 'Fixture-C' },
  ];
  for (let i = 0; i < toCreate; i++) {
    const body = {
      propertyId: GBH_PROPERTY_ID,
      type: 'individual',
      ...names[i],
      email: `audit-fixture-${Date.now()}-${i}@example.test`,
      force: true,
    };
    const r = await fetch(`${API_URL}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      throw new Error(`POST /api/profiles failed: ${r.status} ${await r.text()}`);
    }
  }
  return minCount;
}

async function ensureProfilesOfType(
  type: 'company' | 'travel_agent' | 'source',
  minCount: number,
  prefix: string,
): Promise<number> {
  const res = await fetch(
    `${API_URL}/api/profiles?propertyId=${GBH_PROPERTY_ID}&type=${type}`,
  );
  const page = (await res.json()) as ProfilesPage;
  if (page.total >= minCount) return page.total;

  const toCreate = minCount - page.total;
  for (let i = 0; i < toCreate; i++) {
    const body = {
      propertyId: GBH_PROPERTY_ID,
      type,
      name: `${prefix}-${Date.now()}-${i}`,
      email: `${prefix.toLowerCase()}-${Date.now()}-${i}@example.test`,
      force: true,
    };
    const r = await fetch(`${API_URL}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      throw new Error(`POST /api/profiles (${type}) failed: ${r.status} ${await r.text()}`);
    }
  }
  return minCount;
}

export const ensureCompanies     = (min = 1) => ensureProfilesOfType('company',      min, 'AuditCo');
export const ensureTravelAgents  = (min = 1) => ensureProfilesOfType('travel_agent', min, 'AuditTA');
export const ensureSources       = (min = 1) => ensureProfilesOfType('source',       min, 'AuditSrc');

export async function ensureActiveBusinessDate(): Promise<string> {
  const res = await fetch(
    `${API_URL}/api/business-date?propertyId=${GBH_PROPERTY_ID}`,
  );
  if (!res.ok) {
    throw new Error(`GET /api/business-date failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { date?: string };
  if (!body.date) {
    throw new Error(`GET /api/business-date returned no date: ${JSON.stringify(body)}`);
  }
  return body.date;
}

// ============================================================================
// Booking + folio fixtures — shared by sections 06 (checkin/checkout) and 10
// (folio). Unified contract: fetchers that may not find a match return null
// rather than throwing, so callers decide whether a missing match is fatal or
// skip-worthy. See commit message for Phase 1.5 Task B retro context.
// ============================================================================

export type FolioWindow = {
  id: string;
  windowNumber: number;
  label: string;
  balance: number;
  totalCharges: number;
  totalPayments: number;
};

export type FolioData = {
  balance: number;
  transactions: { id: string; folioWindowId: string }[];
  summary: { totalCharges: number; totalPayments: number };
  windows: FolioWindow[];
};

export type TxnCode = {
  id: string;
  code: string;
  transactionType: string;
  isManualPostAllowed: boolean;
};

/**
 * Returns the id of the first individual profile in the property. Throws if
 * the property has no individual profiles — callers rely on this for booking
 * creation, where a missing guest is unrecoverable.
 */
export async function fetchFirstGuestProfileId(): Promise<string> {
  const r = await fetch(
    `${API_URL}/api/profiles?propertyId=${GBH_PROPERTY_ID}&type=individual&limit=1`,
  );
  if (!r.ok) {
    throw new Error(`GET /api/profiles failed: ${r.status} ${await r.text()}`);
  }
  const page = (await r.json()) as { data: { id: string }[] };
  if (!page.data?.length) throw new Error('No individual profiles available');
  return page.data[0].id;
}

/**
 * Creates a confirmed booking. Returns the new booking id.
 *
 * `opts.roomId = null` → backend "assign later" (no room pre-allocated).
 * `opts.marker` → written to booking.notes; pair with `cleanupAuditBookings`
 * to sweep orphans left by interrupted runs.
 */
export async function createConfirmedBooking(opts: {
  roomId: string | null;
  bizDate: string;
  nights?: number;
  guestProfileId?: string;
  roomTypeId?: string;
  marker?: string;
}): Promise<string> {
  const guestProfileId = opts.guestProfileId ?? (await fetchFirstGuestProfileId());
  const roomTypeId = opts.roomTypeId ?? SEED.roomType.standardDouble;
  const nights = opts.nights ?? 1;
  const checkOutDate = new Date(opts.bizDate);
  checkOutDate.setUTCDate(checkOutDate.getUTCDate() + nights);
  const body: Record<string, unknown> = {
    propertyId: GBH_PROPERTY_ID,
    guestProfileId,
    roomTypeId,
    ...(opts.roomId ? { roomId: opts.roomId } : {}),
    checkInDate: opts.bizDate,
    checkOutDate: checkOutDate.toISOString().slice(0, 10),
  };
  if (opts.marker) body.notes = opts.marker;
  const r = await fetch(`${API_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(`POST /api/bookings failed: ${r.status} ${await r.text()}`);
  }
  const created = (await r.json()) as { id: string };
  return created.id;
}

export async function getBookingStatus(id: string): Promise<{
  status: string;
  roomId: string | null;
}> {
  const r = await fetch(`${API_URL}/api/bookings/${id}`);
  if (!r.ok) {
    throw new Error(`GET /api/bookings/${id} failed: ${r.status} ${await r.text()}`);
  }
  const b = (await r.json()) as { status: string; room?: { id: string | null } | null };
  return { status: b.status, roomId: b.room?.id ?? null };
}

/**
 * Finds one checked_in booking matching the filters. Returns `null` if none
 * matches. Callers that REQUIRE a match should throw at the call site;
 * centralizing the nullable contract here avoids the 06/10 divergence where
 * one variant returned null and another threw.
 */
export async function fetchCheckedInBooking(opts?: {
  minWindows?: number;
  balancePredicate?: 'positive' | 'zero' | 'any';
  excludeIds?: string[];
}): Promise<{ bookingId: string; balance: number; windows: FolioWindow[] } | null> {
  const minWindows = opts?.minWindows ?? 1;
  const balancePredicate = opts?.balancePredicate ?? 'any';
  const excludeIds = opts?.excludeIds ?? [];
  const r = await fetch(
    `${API_URL}/api/bookings?propertyId=${GBH_PROPERTY_ID}&status=checked_in&limit=20`,
  );
  if (!r.ok) {
    throw new Error(`GET /api/bookings (checked_in) failed: ${r.status} ${await r.text()}`);
  }
  const page = (await r.json()) as { data: { id: string }[] };
  for (const b of page.data ?? []) {
    if (excludeIds.includes(b.id)) continue;
    const f = await getFolio(b.id);
    if (f.windows.length < minWindows) continue;
    if (balancePredicate === 'positive' && !(f.balance > 0)) continue;
    if (balancePredicate === 'zero' && f.balance !== 0) continue;
    return { bookingId: b.id, balance: f.balance, windows: f.windows };
  }
  return null;
}

export async function getFolio(bookingId: string): Promise<FolioData> {
  const r = await fetch(`${API_URL}/api/bookings/${bookingId}/folio`);
  if (!r.ok) {
    throw new Error(`GET /api/bookings/${bookingId}/folio failed: ${r.status} ${await r.text()}`);
  }
  return (await r.json()) as FolioData;
}

// Thin wrapper so callers that only need balance don't have to remember the
// destructure. Defined as getFolio(...).then(...) to eliminate the dead-code
// pattern code-reviewer flagged on section 10.
export async function getFolioBalance(bookingId: string): Promise<number> {
  return getFolio(bookingId).then((f) => f.balance);
}

/**
 * Picks a transaction code of the requested type that is marked
 * `isManualPostAllowed === true`. If `preferCode` is given and eligible, it
 * wins; otherwise the first eligible code wins. Throws if no eligible code
 * is found for the type.
 *
 * The `isManualPostAllowed` gate reflects section 10's empirical finding:
 * the backend rejects posts against codes where the flag is false, even if
 * the transactionType matches.
 */
export async function fetchTransactionCode(
  type: 'charge' | 'payment',
  preferCode?: string,
): Promise<{ id: string; code: string }> {
  const r = await fetch(`${API_URL}/api/transaction-codes?propertyId=${GBH_PROPERTY_ID}`);
  if (!r.ok) {
    throw new Error(`GET /api/transaction-codes failed: ${r.status} ${await r.text()}`);
  }
  const codes = (await r.json()) as TxnCode[];
  const eligible = codes.filter(
    (c) => c.transactionType === type && c.isManualPostAllowed === true,
  );
  if (!eligible.length) {
    throw new Error(`No manual-postable ${type} transaction codes available`);
  }
  if (preferCode) {
    const found = eligible.find((c) => c.code === preferCode);
    if (found) return { id: found.id, code: found.code };
  }
  return { id: eligible[0].id, code: eligible[0].code };
}

export async function postFolioCharge(
  bookingId: string,
  opts: {
    transactionCodeId: string;
    amount: number;
    description?: string;
    folioWindowId?: string;
  },
): Promise<void> {
  const body: Record<string, unknown> = {
    transactionCodeId: opts.transactionCodeId,
    amount: opts.amount,
  };
  if (opts.description !== undefined) body.description = opts.description;
  if (opts.folioWindowId !== undefined) body.folioWindowId = opts.folioWindowId;
  const r = await fetch(`${API_URL}/api/bookings/${bookingId}/folio/post`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(
      `POST /api/bookings/${bookingId}/folio/post failed: ${r.status} ${await r.text()}`,
    );
  }
}

export async function postFolioPayment(
  bookingId: string,
  opts: {
    transactionCodeId: string;
    amount: number;
    folioWindowId?: string;
  },
): Promise<void> {
  const body: Record<string, unknown> = {
    transactionCodeId: opts.transactionCodeId,
    amount: opts.amount,
  };
  if (opts.folioWindowId !== undefined) body.folioWindowId = opts.folioWindowId;
  const r = await fetch(`${API_URL}/api/bookings/${bookingId}/folio/payment`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(
      `POST /api/bookings/${bookingId}/folio/payment failed: ${r.status} ${await r.text()}`,
    );
  }
}

/**
 * Cancels all confirmed bookings whose notes field starts with markerPrefix.
 * Returns the number of bookings cancelled. Tolerant of cancellation failures
 * (logs and continues) so one bad record doesn't break the full sweep.
 *
 * Pair with `createConfirmedBooking({marker})` — writing the marker into
 * notes at creation time is the contract this sweep depends on.
 *
 * Implementation note: the list endpoint `GET /api/bookings` does NOT return
 * the `notes` column, so we fan out to `GET /api/bookings/:id` per candidate
 * to read it. Cost is ~N+1 per sweep with current audit sizes (<=100 confirmed
 * bookings); acceptable for a once-per-suite teardown.
 */
export async function cleanupAuditBookings(markerPrefix: string): Promise<number> {
  const r = await fetch(
    `${API_URL}/api/bookings?propertyId=${GBH_PROPERTY_ID}&status=confirmed&limit=100`,
  );
  if (!r.ok) {
    throw new Error(
      `GET /api/bookings (confirmed) failed: ${r.status} ${await r.text()}`,
    );
  }
  const page = (await r.json()) as { data: { id: string }[] };
  let cancelled = 0;
  for (const b of page.data ?? []) {
    let notes = '';
    try {
      const dr = await fetch(`${API_URL}/api/bookings/${b.id}`);
      if (!dr.ok) continue;
      const detail = (await dr.json()) as { notes?: string | null };
      notes = detail.notes ?? '';
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[cleanupAuditBookings] detail ${b.id} threw:`, err);
      continue;
    }
    if (!notes.startsWith(markerPrefix)) continue;
    try {
      const cr = await fetch(`${API_URL}/api/bookings/${b.id}/cancel`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: `${markerPrefix}-cleanup` }),
      });
      if (cr.ok) {
        cancelled++;
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[cleanupAuditBookings] cancel ${b.id} failed: ${cr.status} ${await cr.text()}`,
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[cleanupAuditBookings] cancel ${b.id} threw:`, err);
    }
  }
  return cancelled;
}
