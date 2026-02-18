import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateFolioBalance, canCheckOut, calculateTax, shouldPostRoomCharge } from "./folio.js";

describe("calculateFolioBalance", () => {
  it("returns 0 for empty array", () => {
    assert.equal(calculateFolioBalance([]), 0);
  });

  it("calculates pure debits", () => {
    const result = calculateFolioBalance([
      { debit: "100.00", credit: "0.00" },
      { debit: "50.00", credit: "0.00" },
    ]);
    assert.equal(result, 150);
  });

  it("calculates mixed debits and credits", () => {
    const result = calculateFolioBalance([
      { debit: "200.00", credit: "0.00" },
      { debit: "0.00", credit: "200.00" },
    ]);
    assert.equal(result, 0);
  });

  it("returns negative balance when credits exceed debits", () => {
    const result = calculateFolioBalance([
      { debit: "100.00", credit: "0.00" },
      { debit: "0.00", credit: "150.00" },
    ]);
    assert.equal(result, -50);
  });

  it("rounds to 2 decimal places", () => {
    const result = calculateFolioBalance([
      { debit: "100.10", credit: "0.00" },
      { debit: "0.00", credit: "0.05" },
    ]);
    assert.equal(result, 100.05);
  });
});

describe("canCheckOut", () => {
  it("allows check-out when balance is 0", () => {
    assert.equal(canCheckOut(0), true);
  });

  it("allows check-out when balance is negative (overpaid)", () => {
    assert.equal(canCheckOut(-10), true);
  });

  it("disallows check-out when balance is positive (owes money)", () => {
    assert.equal(canCheckOut(0.01), false);
  });

  it("disallows check-out with large positive balance", () => {
    assert.equal(canCheckOut(500), false);
  });
});

describe("calculateTax", () => {
  it("calculates 20% tax", () => {
    assert.equal(calculateTax(100, 20), 20);
  });

  it("calculates 0% tax", () => {
    assert.equal(calculateTax(100, 0), 0);
  });

  it("calculates fractional tax and rounds to 2 decimals", () => {
    // 99.99 * 20% = 19.998 → 20.00
    assert.equal(calculateTax(99.99, 20), 20);
  });

  it("calculates tax on fractional amount", () => {
    // 50.50 * 10% = 5.05
    assert.equal(calculateTax(50.5, 10), 5.05);
  });
});

describe("shouldPostRoomCharge", () => {
  it("returns true for positive rate", () => {
    assert.equal(shouldPostRoomCharge("150.00"), true);
  });

  it("returns true for minimal positive rate", () => {
    assert.equal(shouldPostRoomCharge("0.01"), true);
  });

  it("returns false for null rateAmount", () => {
    assert.equal(shouldPostRoomCharge(null), false);
  });

  it("returns false for '0'", () => {
    assert.equal(shouldPostRoomCharge("0"), false);
  });

  it("returns false for '0.00'", () => {
    assert.equal(shouldPostRoomCharge("0.00"), false);
  });
});
