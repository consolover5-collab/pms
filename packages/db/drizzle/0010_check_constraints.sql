-- Add CHECK constraints for data integrity (BUG-002).
-- Idempotent via NOT VALID + VALIDATE pattern would work for large tables;
-- for GBH seed volume we add constraints directly since seed data already
-- satisfies all predicates.

-- bookings: date range, occupant counts, status enum
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_date_range_check"
    CHECK ("check_out_date" > "check_in_date"),
  ADD CONSTRAINT "bookings_adults_positive_check"
    CHECK ("adults" > 0),
  ADD CONSTRAINT "bookings_children_nonnegative_check"
    CHECK ("children" >= 0),
  ADD CONSTRAINT "bookings_status_enum_check"
    CHECK ("status" IN ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'));

-- rooms: HK/occupancy enums, OOO date consistency
ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_housekeeping_status_enum_check"
    CHECK ("housekeeping_status" IN ('clean', 'dirty', 'pickup', 'inspected', 'out_of_order', 'out_of_service')),
  ADD CONSTRAINT "rooms_occupancy_status_enum_check"
    CHECK ("occupancy_status" IN ('vacant', 'occupied')),
  ADD CONSTRAINT "rooms_ooo_dates_consistency_check"
    CHECK (("ooo_from_date" IS NULL) = ("ooo_to_date" IS NULL)),
  ADD CONSTRAINT "rooms_ooo_date_range_check"
    CHECK ("ooo_to_date" IS NULL OR "ooo_to_date" >= "ooo_from_date");

-- folio_transactions: non-negative amounts, debit/credit XOR, positive quantity
ALTER TABLE "folio_transactions"
  ADD CONSTRAINT "folio_transactions_debit_nonnegative_check"
    CHECK ("debit" >= 0),
  ADD CONSTRAINT "folio_transactions_credit_nonnegative_check"
    CHECK ("credit" >= 0),
  ADD CONSTRAINT "folio_transactions_debit_credit_xor_check"
    CHECK (("debit" > 0 AND "credit" = 0) OR ("debit" = 0 AND "credit" > 0)),
  ADD CONSTRAINT "folio_transactions_quantity_positive_check"
    CHECK ("quantity" > 0);
