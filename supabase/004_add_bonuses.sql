-- Adds day bonuses: promo pay that isn't tied to a single order, such as shift
-- bonuses, order-count challenges, and peak pay.
-- Run once in the Supabase dashboard: SQL Editor > New query > Run.
-- Safe to run more than once.

-- Deliberately a separate table rather than columns on orders. Tip intelligence
-- aggregates confirmed_tip by store and region; folding promo money into those rows
-- would teach the scorer that certain stores tip better than they actually do.
CREATE TABLE IF NOT EXISTS bonuses (
  bonus_id  TEXT PRIMARY KEY,
  earned_on DATE NOT NULL,
  amount    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  note      TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bonuses_earned_on_idx ON bonuses (earned_on);

-- Same posture as orders: RLS on with no policies, so the publishable key in the
-- browser cannot read or write this table. All access goes through Edge Functions
-- using the service role key server-side.
ALTER TABLE bonuses ENABLE ROW LEVEL SECURITY;
