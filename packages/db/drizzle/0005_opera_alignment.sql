-- Opera Alignment Migration
-- Fixes: B-02 (OOO dates), B-04 (totalAmount), B-05 validation prep, P-01 (guaranteeCode), P-02 (channel), P-04 (vipStatus)
-- Note: B-03 (folio constraint) resolved separately via ON CONFLICT DO NOTHING, index kept

-- 1. bookings: добавить guarantee/market/source/channel
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS guarantee_code VARCHAR(30),
  ADD COLUMN IF NOT EXISTS market_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS source_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS channel VARCHAR(40);

-- 2. bookings: убрать total_amount (вычисляется из folio)
ALTER TABLE bookings DROP COLUMN IF EXISTS total_amount;

-- 3. rooms: добавить OOO диапазон дат
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS ooo_from_date DATE,
  ADD COLUMN IF NOT EXISTS ooo_to_date DATE,
  ADD COLUMN IF NOT EXISTS return_status VARCHAR(20);

-- 4. guests: vipStatus integer -> varchar
ALTER TABLE guests
  ALTER COLUMN vip_status TYPE VARCHAR(20) USING vip_status::VARCHAR;
