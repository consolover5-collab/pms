import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateBookingDates,
  validateOccupancy,
  isValidUuid,
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

  it("returns error when checkOut equals checkIn", () => {
    const result = validateBookingDates("2026-03-01", "2026-03-01");
    assert.ok(result !== null, "should return error message");
  });

  it("returns error when checkOut is before checkIn", () => {
    const result = validateBookingDates("2026-03-05", "2026-03-01");
    assert.ok(result !== null, "should return error message");
  });

  it("returns null when either date is empty", () => {
    assert.equal(validateBookingDates("", "2026-03-05"), null);
    assert.equal(validateBookingDates("2026-03-01", ""), null);
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
