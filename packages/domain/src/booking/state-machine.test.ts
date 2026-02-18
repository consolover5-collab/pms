import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionBooking,
  assertBookingTransition,
  canTransitionHousekeeping,
  assertHousekeepingTransition,
} from "./state-machine.js";

// --- Booking transitions ---

describe("canTransitionBooking — valid transitions", () => {
  it("confirmed → checked_in", () => {
    assert.equal(canTransitionBooking("confirmed", "checked_in"), true);
  });
  it("confirmed → cancelled", () => {
    assert.equal(canTransitionBooking("confirmed", "cancelled"), true);
  });
  it("confirmed → no_show", () => {
    assert.equal(canTransitionBooking("confirmed", "no_show"), true);
  });
  it("checked_in → checked_out", () => {
    assert.equal(canTransitionBooking("checked_in", "checked_out"), true);
  });
  it("checked_in → confirmed (cancel check-in)", () => {
    assert.equal(canTransitionBooking("checked_in", "confirmed"), true);
  });
  it("checked_out → checked_in (reinstate)", () => {
    assert.equal(canTransitionBooking("checked_out", "checked_in"), true);
  });
  it("cancelled → confirmed (reinstate)", () => {
    assert.equal(canTransitionBooking("cancelled", "confirmed"), true);
  });
  it("no_show → confirmed (reinstate)", () => {
    assert.equal(canTransitionBooking("no_show", "confirmed"), true);
  });
});

describe("canTransitionBooking — invalid transitions", () => {
  it("confirmed → checked_out", () => {
    assert.equal(canTransitionBooking("confirmed", "checked_out"), false);
  });
  it("checked_out → confirmed", () => {
    assert.equal(canTransitionBooking("checked_out", "confirmed"), false);
  });
  it("cancelled → checked_in", () => {
    assert.equal(canTransitionBooking("cancelled", "checked_in"), false);
  });
  it("no_show → cancelled", () => {
    assert.equal(canTransitionBooking("no_show", "cancelled"), false);
  });
  it("checked_out → cancelled", () => {
    assert.equal(canTransitionBooking("checked_out", "cancelled"), false);
  });
});

describe("assertBookingTransition", () => {
  it("does not throw on valid transition", () => {
    assert.doesNotThrow(() => assertBookingTransition("confirmed", "checked_in"));
  });

  it("throws on invalid transition", () => {
    assert.throws(
      () => assertBookingTransition("checked_out", "confirmed"),
      /Invalid booking status transition/,
    );
  });
});

// --- Housekeeping transitions ---

describe("canTransitionHousekeeping — valid transitions", () => {
  it("dirty → clean", () => {
    assert.equal(canTransitionHousekeeping("dirty", "clean"), true);
  });
  it("dirty → pickup", () => {
    assert.equal(canTransitionHousekeeping("dirty", "pickup"), true);
  });
  it("pickup → clean", () => {
    assert.equal(canTransitionHousekeeping("pickup", "clean"), true);
  });
  it("pickup → dirty", () => {
    assert.equal(canTransitionHousekeeping("pickup", "dirty"), true);
  });
  it("clean → inspected", () => {
    assert.equal(canTransitionHousekeeping("clean", "inspected"), true);
  });
  it("clean → dirty", () => {
    assert.equal(canTransitionHousekeeping("clean", "dirty"), true);
  });
  it("inspected → dirty", () => {
    assert.equal(canTransitionHousekeeping("inspected", "dirty"), true);
  });
  it("out_of_order → clean", () => {
    assert.equal(canTransitionHousekeeping("out_of_order", "clean"), true);
  });
  it("out_of_service → dirty", () => {
    assert.equal(canTransitionHousekeeping("out_of_service", "dirty"), true);
  });
});

describe("canTransitionHousekeeping — invalid transitions", () => {
  it("dirty → inspected", () => {
    assert.equal(canTransitionHousekeeping("dirty", "inspected"), false);
  });
  it("clean → pickup", () => {
    assert.equal(canTransitionHousekeeping("clean", "pickup"), false);
  });
  it("out_of_order → inspected", () => {
    assert.equal(canTransitionHousekeeping("out_of_order", "inspected"), false);
  });
});

describe("assertHousekeepingTransition", () => {
  it("does not throw on valid transition", () => {
    assert.doesNotThrow(() =>
      assertHousekeepingTransition("dirty", "clean"),
    );
  });

  it("throws on invalid transition", () => {
    assert.throws(
      () => assertHousekeepingTransition("dirty", "inspected"),
      /Invalid housekeeping status transition/,
    );
  });
});
