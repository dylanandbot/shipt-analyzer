-- Adds shop-time tracking to the orders table.
-- Run once in the Supabase dashboard: SQL Editor > New query > Run.
-- Safe to run more than once.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS run_status     TEXT,
  ADD COLUMN IF NOT EXISTS run_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS run_ended_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shop_minutes   NUMERIC(10, 2);

-- Existing rows predate timing, so mark them explicitly rather than
-- leaving run_status NULL and making "never started" ambiguous.
UPDATE orders SET run_status = 'unstarted' WHERE run_status IS NULL;
