/**
 * Runtime state-probe for UI-audit section prep.
 *
 * Prints a single JSON snapshot of the GBH property state to stdout:
 *   rooms (hk/occ matrix), bookings by status (with checked-in folio
 *   distribution), transaction codes, and guest-profile counts.
 *
 * Invocation:
 *   pnpm --filter @pms/ui-audit probe-state > /tmp/probe-state.json
 *
 * On any failure: diagnostic to stderr, exit 1, nothing on stdout.
 */

import { SEED } from '../src/seed-refs.ts';

const API = process.env.AUDIT_API_URL ?? 'http://localhost:3001';
const PROPERTY_ID = SEED.property.GBH;

type Room = {
  id: string;
  housekeepingStatus: string;
  occupancyStatus: string;
};

type Booking = {
  id: string;
  status: string;
};

type BookingListResponse = {
  data: Booking[];
  total: number;
};

type FolioWindow = {
  id: string;
  balance: number;
};

type FolioResponse = {
  balance: number;
  windows: FolioWindow[];
};

type TransactionCode = {
  id: string;
  code: string;
  transactionType: string;
  isManualPostAllowed: boolean;
};

type ProfileListResponse = {
  total: number;
};

type BusinessDateResponse = {
  date: string;
};

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${API}${path}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`GET ${url} threw: ${(err as Error).message}`);
  }
  if (!res.ok) {
    let body = '';
    try {
      body = (await res.text()).slice(0, 500);
    } catch {
      /* ignore body read failures */
    }
    throw new Error(
      `GET ${url} → HTTP ${res.status} ${res.statusText}${body ? ` body=${body}` : ''}`,
    );
  }
  return (await res.json()) as T;
}

function bumpCount(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function balanceBucket(balance: number): string {
  if (balance < 0) return '<0 (credit)';
  if (balance === 0) return '=0';
  if (balance <= 100) return '0<b<=100';
  if (balance <= 500) return '100<b<=500';
  if (balance <= 1000) return '500<b<=1000';
  return '>1000';
}

async function collectRooms() {
  const ROOM_LIMIT = 1000;
  const rooms = await fetchJson<Room[]>(
    `/api/rooms?propertyId=${PROPERTY_ID}&limit=${ROOM_LIMIT}`,
  );
  if (rooms.length === ROOM_LIMIT) {
    throw new Error(
      `Rooms response hit limit=${ROOM_LIMIT} — probe may be truncated. Paginate or raise limit.`,
    );
  }
  const byHkStatus: Record<string, number> = {};
  const byOccStatus: Record<string, number> = {};
  const matrix: Record<string, Record<string, number>> = {};
  for (const r of rooms) {
    const hk = r.housekeepingStatus;
    const occ = r.occupancyStatus;
    bumpCount(byHkStatus, hk);
    bumpCount(byOccStatus, occ);
    if (!matrix[hk]) matrix[hk] = {};
    bumpCount(matrix[hk], occ);
  }
  return { total: rooms.length, byHkStatus, byOccStatus, matrix };
}

async function countBookingsByStatus(status: string): Promise<number> {
  // Use limit=1 — we only need total.
  const resp = await fetchJson<BookingListResponse>(
    `/api/bookings?propertyId=${PROPERTY_ID}&status=${status}&limit=1`,
  );
  return Number(resp.total);
}

async function collectCheckedIn() {
  // Fetch all checked_in bookings (limit capped at 100 server-side → paginate).
  const all: Booking[] = [];
  const pageSize = 100;
  let offset = 0;
  while (true) {
    const resp = await fetchJson<BookingListResponse>(
      `/api/bookings?propertyId=${PROPERTY_ID}&status=checked_in&limit=${pageSize}&offset=${offset}`,
    );
    all.push(...resp.data);
    if (resp.data.length < pageSize) break;
    offset += pageSize;
    if (offset > 10_000) throw new Error('pagination runaway: >10k checked_in');
  }

  let withPositive = 0;
  let withZero = 0;
  let withNegative = 0;
  let withMultipleWindows = 0;
  const histogram: Record<string, number> = {};

  // Sequential — spec requires no Promise.all (API can be slow).
  for (const b of all) {
    const folio = await fetchJson<FolioResponse>(
      `/api/bookings/${b.id}/folio`,
    );
    const balance = Number(folio.balance ?? 0);
    if (balance > 0) withPositive++;
    else if (balance < 0) withNegative++;
    else withZero++;
    if ((folio.windows?.length ?? 0) > 1) withMultipleWindows++;
    bumpCount(histogram, balanceBucket(balance));
  }

  const balanceHistogram = Object.entries(histogram)
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));

  return {
    total: all.length,
    withPositiveBalance: withPositive,
    withZeroBalance: withZero,
    withNegativeBalance: withNegative,
    withMultipleWindows,
    balanceHistogram,
  };
}

async function collectTransactionCodes() {
  const TXN_LIMIT = 200;
  const codes = await fetchJson<TransactionCode[]>(
    `/api/transaction-codes?propertyId=${PROPERTY_ID}&limit=${TXN_LIMIT}`,
  );
  if (codes.length === TXN_LIMIT) {
    throw new Error(
      `TransactionCodes response hit limit=${TXN_LIMIT} — probe may be truncated. Paginate or raise limit.`,
    );
  }
  const byType: Record<string, number> = {};
  const chargeCodes: {
    code: string;
    id: string;
    isManualPostAllowed: boolean;
  }[] = [];
  const paymentCodes: {
    code: string;
    id: string;
    isManualPostAllowed: boolean;
  }[] = [];
  for (const c of codes) {
    bumpCount(byType, c.transactionType);
    const slim = {
      code: c.code,
      id: c.id,
      isManualPostAllowed: Boolean(c.isManualPostAllowed),
    };
    if (c.transactionType === 'charge') chargeCodes.push(slim);
    else if (c.transactionType === 'payment') paymentCodes.push(slim);
  }
  return { total: codes.length, byType, chargeCodes, paymentCodes };
}

async function collectGuestProfiles() {
  const types = ['individual', 'company', 'travel_agent', 'source'] as const;
  const out: Record<string, number> = {};
  for (const t of types) {
    const resp = await fetchJson<ProfileListResponse>(
      `/api/profiles?propertyId=${PROPERTY_ID}&type=${t}&limit=1`,
    );
    out[t] = Number(resp.total);
  }
  return {
    individual: out.individual,
    company: out.company,
    travelAgent: out.travel_agent,
    source: out.source,
  };
}

async function main(): Promise<void> {
  const bizDate = await fetchJson<BusinessDateResponse>(
    `/api/business-date?propertyId=${PROPERTY_ID}`,
  );

  const rooms = await collectRooms();

  const [confirmed, checkedOut, cancelled, noShow] = await Promise.all([
    countBookingsByStatus('confirmed'),
    countBookingsByStatus('checked_out'),
    countBookingsByStatus('cancelled'),
    countBookingsByStatus('no_show'),
  ]);
  const checkedIn = await collectCheckedIn();

  const transactionCodes = await collectTransactionCodes();
  const guestProfiles = await collectGuestProfiles();

  const snapshot = {
    generatedAt: new Date().toISOString(),
    apiUrl: API,
    propertyId: PROPERTY_ID,
    businessDate: bizDate.date,
    rooms,
    bookings: {
      confirmed,
      checkedIn,
      checkedOut,
      cancelled,
      noShow,
    },
    transactionCodes,
    guestProfiles,
  };

  process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n');
}

main().catch((err: Error) => {
  console.error(`[probe-state] FAILED: ${err.message}`);
  process.exit(1);
});
