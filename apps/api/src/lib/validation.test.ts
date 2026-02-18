import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateBookingDates,
  validateOccupancy,
  isValidUuid,
  validateReinstateCheckedOut,
  validateRoomMove,
} from "./validation.js";

describe("isValidUuid", () => {
  it("accepts a valid UUID v4", () => {
    assert.equal(isValidUuid("550e8400-e29b-41d4-a716-446655440000"), true);
  });

  it("accepts uppercase UUID", () => {
    assert.equal(isValidUuid("550E8400-E29B-41D4-A716-446655440000"), true);
  });

  it("rejects empty string", () => {
    assert.equal(isValidUuid(""), false);
  });

  it("rejects plain string", () => {
    assert.equal(isValidUuid("not-a-uuid"), false);
  });

  it("rejects UUID with missing segment", () => {
    assert.equal(isValidUuid("550e8400-e29b-41d4-a716"), false);
  });
});

describe("validateBookingDates", () => {
  it("returns null for valid dates", () => {
    assert.equal(validateBookingDates("2026-03-01", "2026-03-05"), null);
  });

  it("returns null for 1-night stay", () => {
    assert.equal(validateBookingDates("2026-03-01", "2026-03-02"), null);
  });

  it("returns error when checkOut equals checkIn (0 nights)", () => {
    const result = validateBookingDates("2026-03-01", "2026-03-01");
    assert.ok(result !== null, "should return error message");
    assert.ok(result!.includes("2026-03-01"), "error should mention the date");
  });

  it("returns error when checkOut is before checkIn", () => {
    const result = validateBookingDates("2026-03-05", "2026-03-01");
    assert.ok(result !== null, "should return error message");
  });

  it("returns null when either date is empty", () => {
    assert.equal(validateBookingDates("", "2026-03-05"), null);
    assert.equal(validateBookingDates("2026-03-01", ""), null);
  });

  it("accepts dates far in the future", () => {
    assert.equal(validateBookingDates("2030-01-01", "2030-12-31"), null);
  });

  it("accepts past check-in with future check-out (pure validation, no business date)", () => {
    // validateBookingDates is a pure date-range check — business date enforcement is in the route
    assert.equal(validateBookingDates("2020-01-01", "2030-12-31"), null);
  });
});

describe("validateOccupancy", () => {
  it("returns null for valid occupancy", () => {
    assert.equal(validateOccupancy(2, 1, 4), null);
  });

  it("returns null when total equals maxOccupancy", () => {
    assert.equal(validateOccupancy(2, 2, 4), null);
  });

  it("returns error when total exceeds maxOccupancy", () => {
    const result = validateOccupancy(3, 2, 4);
    assert.ok(result !== null, "should return error message");
  });

  it("returns error when adults is 0", () => {
    const result = validateOccupancy(0, 1, 4);
    assert.ok(result !== null, "should return error message");
  });

  it("returns error when adults < 0", () => {
    const result = validateOccupancy(-1, 0, 4);
    assert.ok(result !== null, "should return error message");
  });

  it("allows children = 0", () => {
    assert.equal(validateOccupancy(1, 0, 2), null);
  });
});

describe("validateReinstateCheckedOut", () => {
  it("returns null when checkOutDate is after businessDate", () => {
    assert.equal(validateReinstateCheckedOut("2026-03-01", "2026-02-18"), null);
  });

  it("returns error when checkOutDate equals businessDate", () => {
    const result = validateReinstateCheckedOut("2026-02-18", "2026-02-18");
    assert.ok(result !== null, "should return error when checkOut = businessDate");
    assert.ok(result!.includes("2026-02-18"), "error should mention the date");
  });

  it("returns error when checkOutDate is before businessDate", () => {
    const result = validateReinstateCheckedOut("2026-02-10", "2026-02-18");
    assert.ok(result !== null, "should return error when checkOut is in the past");
  });
});

const validBooking = { status: "checked_in", roomId: "room-1", roomTypeId: "type-A" };
const validNewRoom = { id: "room-2", roomTypeId: "type-A", occupancyStatus: "vacant", housekeepingStatus: "clean" };

describe("validateRoomMove", () => {
  it("returns null for a valid room move", () => {
    assert.equal(validateRoomMove(validBooking, validNewRoom), null);
  });

  it("accepts inspected room as move target", () => {
    assert.equal(validateRoomMove(validBooking, { ...validNewRoom, housekeepingStatus: "inspected" }), null);
  });

  it("returns error when booking is not checked_in", () => {
    const result = validateRoomMove({ ...validBooking, status: "confirmed" }, validNewRoom);
    assert.ok(result !== null);
    assert.ok(result!.toLowerCase().includes("заселен") || result!.toLowerCase().includes("checked_in"));
  });

  it("returns error when new room is same as current room", () => {
    const result = validateRoomMove(validBooking, { ...validNewRoom, id: "room-1" });
    assert.ok(result !== null);
  });

  it("returns error when new room is occupied", () => {
    const result = validateRoomMove(validBooking, { ...validNewRoom, occupancyStatus: "occupied" });
    assert.ok(result !== null);
  });

  it("returns error when new room is dirty", () => {
    const result = validateRoomMove(validBooking, { ...validNewRoom, housekeepingStatus: "dirty" });
    assert.ok(result !== null);
  });

  it("returns error when new room is out_of_order", () => {
    const result = validateRoomMove(validBooking, { ...validNewRoom, housekeepingStatus: "out_of_order" });
    assert.ok(result !== null);
  });

  it("returns error when room type does not match booking", () => {
    const result = validateRoomMove(validBooking, { ...validNewRoom, roomTypeId: "type-B" });
    assert.ok(result !== null);
  });
});
