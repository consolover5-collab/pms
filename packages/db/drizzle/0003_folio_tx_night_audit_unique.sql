CREATE UNIQUE INDEX "folio_tx_night_audit_unique" ON "folio_transactions" ("booking_id","business_date_id","transaction_code_id") WHERE is_system_generated = true;
