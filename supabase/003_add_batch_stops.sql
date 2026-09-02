-- Adds the second delivery stop of a batch order to the orders table.
-- Run once in the Supabase dashboard: SQL Editor > New query > Run.
-- Safe to run more than once.

-- A batch is one drive and one shopping trip, so it stays a single row: the shared
-- metrics (item_count, estimated_minutes, distance_miles) describe the whole run and
-- must not be duplicated across two rows. The row's own address/region/confirmed_tip
-- belong to stop 1; stop 2 rides along in these columns.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stop2_address TEXT,
  ADD COLUMN IF NOT EXISTS stop2_region  TEXT,
  ADD COLUMN IF NOT EXISTS stop2_tip     NUMERIC(10, 2);

-- Existing rows are all single orders, so leaving these NULL is already correct.
