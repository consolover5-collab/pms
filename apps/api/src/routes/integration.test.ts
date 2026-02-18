/**
 * Integration tests — requires running API at http://localhost:3001
 * Run: pnpm --filter @pms/api test:integration
 *
 * Covers recent features:
 *   - roomCount in GET /api/room-types
 *   - roomTypeId filter in GET /api/rooms
 *   - PUT /api/rooms/:id (edit room properties)
 *   - propertyId in GET /api/bookings/:id
 *   - Extend stay (checkOutDate editable for checked_in)
 *   - DATES_LOCKED (checkInDate blocked for checked_in)
 *   - CANCEL_CHECKIN_TOO_LATE guard
 *   - Room Move validations
 *   - Night Audit preview structure
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.API_URL ?? "http://localhost:3001";
const PROP = "ff1d9135-dfb9-4baa-be46-0e739cd26dad"; // Grand Baltic Hotel (seed)

async function api<T = unknown>(
  path: string,
  init?: RequestInit & { body?: unknown },
): Promise<{ status: number; data: T }> {
  const options: RequestInit = { ...init };
  if (init?.body !== undefined) {
    options.body = JSON.stringify(init.body);
    options.headers = { "Content-Type": "application/json", ...(init.headers ?? {}) };
  }
  const res = await fetch(`${BASE}${path}`, options);
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

// ── Room Types ────────────────────────────────────────────────────────────

describe("GET /api/room-types — roomCount", () => {
  test("every type has numeric roomCount", async () => {
    const { status, data } = await api<any[]>(`/api/room-types?propertyId=${PROP}`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    for (const rt of data) {
      assert.ok("roomCount" in rt, `${rt.code} missing roomCount`);
      assert.equal(typeof rt.roomCount, "number", `${rt.code} roomCount must be number`);
    }
  });

  test("STD has rooms, PRE (0 rooms) has roomCount=0", async () => {
    const { data } = await api<any[]>(`/api/room-types?propertyId=${PROP}`);
    const std = data.find((rt) => rt.code === "STD");
    const pre = data.find((rt) => rt.code === "PRE");
    assert.ok(std, "STD room type missing from seed");
    assert.ok(std.roomCount > 0, "STD should have rooms");
    if (pre) assert.equal(pre.roomCount, 0, "PRE should have 0 rooms");
  });
});

// ── Rooms filter ──────────────────────────────────────────────────────────

describe("GET /api/rooms — roomTypeId filter", () => {
  let stdTypeId: string;

  before(async () => {
    const { data } = await api<any[]>(`/api/room-types?propertyId=${PROP}`);
    stdTypeId = data.find((rt) => rt.code === "STD")!.id;
  });

  test("returns only rooms of the specified type", async () => {
    const { status, data } = await api<any[]>(
      `/api/rooms?propertyId=${PROP}&roomTypeId=${stdTypeId}`,
    );
    assert.equal(status, 200);
    assert.ok(Array.isArray(data) && data.length > 0, "STD should have rooms");
    for (const room of data) {
      assert.equal(room.roomTypeId, stdTypeId, "all rooms must be STD type");
    }
  });
});

// ── PUT /api/rooms/:id ────────────────────────────────────────────────────

describe("PUT /api/rooms/:id", () => {
  let vacantRoomId: string;
  let origFloor: number | null;

  before(async () => {
    const { data } = await api<any[]>(
      `/api/rooms?propertyId=${PROP}&occupancyStatus=vacant&housekeepingStatus=clean`,
    );
    vacantRoomId = data[0].id;
    origFloor = data[0].floor;
  });

  after(async () => {
    await api(`/api/rooms/${vacantRoomId}`, { method: "PUT", body: { floor: origFloor } });
  });

  test("updates floor for vacant room", async () => {
    const { status, data } = await api<any>(`/api/rooms/${vacantRoomId}`, {
      method: "PUT",
      body: { floor: 9 },
    });
    assert.equal(status, 200);
    assert.equal(data.floor, 9);
  });

  test("returns 400 ROOM_OCCUPIED for occupied room", async () => {
    const { data: occupied } = await api<any[]>(
      `/api/rooms?propertyId=${PROP}&occupancyStatus=occupied`,
    );
    const { status, data } = await api<any>(`/api/rooms/${occupied[0].id}`, {
      method: "PUT",
      body: { floor: 5 },
    });
    assert.equal(status, 400);
    assert.equal(data.code, "ROOM_OCCUPIED");
  });

  test("returns 400 ROOM_TYPE_NOT_FOUND for invalid roomTypeId", async () => {
    const { status, data } = await api<any>(`/api/rooms/${vacantRoomId}`, {
      method: "PUT",
      body: { roomTypeId: "00000000-0000-0000-0000-000000000000" },
    });
    assert.equal(status, 400);
    assert.equal(data.code, "ROOM_TYPE_NOT_FOUND");
  });
});

// ── GET /api/bookings/:id — propertyId ───────────────────────────────────

describe("GET /api/bookings/:id", () => {
  test("includes propertyId in booking detail", async () => {
    const { data: list } = await api<any>(`/api/bookings?propertyId=${PROP}&status=checked_in`);
    const bookingId = list.data[0].id;
    const { status, data } = await api<any>(`/api/bookings/${bookingId}`);
    assert.equal(status, 200);
    assert.ok("propertyId" in data, "booking detail must have propertyId");
    assert.equal(data.propertyId, PROP);
  });
});

// ── PUT /api/bookings/:id — extend stay ───────────────────────────────────

describe("PUT /api/bookings/:id — extend stay for checked_in", () => {
  let bookingId: string;
  let origCheckOut: string;

  before(async () => {
    const { data } = await api<any>(`/api/bookings?propertyId=${PROP}&status=checked_in`);
    bookingId = data.data[0].id;
    origCheckOut = data.data[0].checkOutDate;
  });

  after(async () => {
    await api(`/api/bookings/${bookingId}`, {
      method: "PUT",
      body: { checkOutDate: origCheckOut },
    });
  });

  test("allows changing checkOutDate for checked_in booking", async () => {
    const newDate = "2026-12-31";
    const { status, data } = await api<any>(`/api/bookings/${bookingId}`, {
      method: "PUT",
      body: { checkOutDate: newDate },
    });
    assert.equal(status, 200);
    assert.equal(data.checkOutDate, newDate);
  });

  test("blocks changing checkInDate for checked_in booking (DATES_LOCKED)", async () => {
    const { status, data } = await api<any>(`/api/bookings/${bookingId}`, {
      method: "PUT",
      body: { checkInDate: "2026-12-01" },
    });
    assert.equal(status, 400);
    assert.equal(data.code, "DATES_LOCKED");
  });
});

// ── POST /api/bookings/:id/cancel-check-in ────────────────────────────────

describe("POST /api/bookings/:id/cancel-check-in", () => {
  test("returns CANCEL_CHECKIN_TOO_LATE when checkIn date != business date", async () => {
    const { data: biz } = await api<any>(`/api/business-date?propertyId=${PROP}`);
    const bizDate = biz.date;
    const { data: list } = await api<any>(
      `/api/bookings?propertyId=${PROP}&status=checked_in`,
    );
    const booking = list.data.find((b: any) => b.checkInDate !== bizDate);
    if (!booking) {
      // All checked_in bookings checked in today — skip gracefully
      return;
    }
    const { status, data } = await api<any>(
      `/api/bookings/${booking.id}/cancel-check-in`,
      { method: "POST" },
    );
    assert.equal(status, 400);
    assert.equal(data.code, "CANCEL_CHECKIN_TOO_LATE");
  });
});

// ── POST /api/bookings/:id/room-move ─────────────────────────────────────

describe("POST /api/bookings/:id/room-move", () => {
  let bookingId: string;
  let bookingTypeId: string;

  before(async () => {
    const { data: list } = await api<any>(
      `/api/bookings?propertyId=${PROP}&status=checked_in`,
    );
    const b = list.data[0];
    bookingId = b.id;
    bookingTypeId = b.roomType.id;
  });

  test("returns ROOM_MOVE_INVALID when target room is occupied", async () => {
    const { data: detail } = await api<any>(`/api/bookings/${bookingId}`);
    const currentRoomId = detail.room?.id;
    const { data: occupied } = await api<any[]>(
      `/api/rooms?propertyId=${PROP}&occupancyStatus=occupied`,
    );
    const target = occupied.find((r: any) => r.id !== currentRoomId) ?? occupied[0];
    const { status, data } = await api<any>(
      `/api/bookings/${bookingId}/room-move`,
      { method: "POST", body: { newRoomId: target.id } },
    );
    assert.equal(status, 400);
    assert.equal(data.code, "ROOM_MOVE_INVALID");
  });

  test("returns ROOM_MOVE_INVALID when target room is a different type", async () => {
    const { data: rooms } = await api<any[]>(
      `/api/rooms?propertyId=${PROP}&occupancyStatus=vacant&housekeepingStatus=clean`,
    );
    const wrongType = rooms.find((r: any) => r.roomTypeId !== bookingTypeId);
    if (!wrongType) return; // skip if no different-type clean room in seed
    const { status, data } = await api<any>(
      `/api/bookings/${bookingId}/room-move`,
      { method: "POST", body: { newRoomId: wrongType.id } },
    );
    assert.equal(status, 400);
    assert.equal(data.code, "ROOM_MOVE_INVALID");
  });
});

// ── Night Audit ───────────────────────────────────────────────────────────

describe("POST /api/night-audit/preview", () => {
  test("response includes roomDetails and pendingNoShowDetails arrays", async () => {
    const { status, data } = await api<any>("/api/night-audit/preview", {
      method: "POST",
      body: { propertyId: PROP },
    });
    assert.equal(status, 200);
    assert.ok("roomDetails" in data, "missing roomDetails");
    assert.ok("pendingNoShowDetails" in data, "missing pendingNoShowDetails");
    assert.ok(Array.isArray(data.roomDetails), "roomDetails must be array");
    assert.ok(Array.isArray(data.pendingNoShowDetails), "pendingNoShowDetails must be array");
    assert.ok("businessDate" in data, "missing businessDate");
    assert.ok("roomsToCharge" in data, "missing roomsToCharge");
  });
});
