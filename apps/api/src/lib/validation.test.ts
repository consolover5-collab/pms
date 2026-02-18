import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateBookingDates,
  validateOccupancy,
  isValidUuid,
  validateReinstateCheckedOut,
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
