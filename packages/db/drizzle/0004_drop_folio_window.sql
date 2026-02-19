-- Remove unused folioWindow column from folio_transactions
-- This field was reserved for Opera-style folio window routing (window 1 = room, window 2 = incidentals)
-- but was never implemented. Removed per Opus architecture review to reduce cognitive overhead.
ALTER TABLE "folio_transactions" DROP COLUMN IF EXISTS "folio_window";
