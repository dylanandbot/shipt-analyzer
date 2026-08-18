-- Locks down direct table access.
-- Run once in the Supabase dashboard: SQL Editor > New query > Run.
--
-- Why: the analyzer now ships a Supabase anon key in the browser, and the
-- GitHub repo is public. Without RLS, that key can read and write the whole
-- orders table directly through PostgREST. With RLS on and no policies, anon
-- gets nothing, and the Edge Functions (which use the service role key)
-- continue to work because the service role bypasses RLS.

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Deliberately no policies: every legitimate read and write goes through the
-- add-order and get-tip-history Edge Functions.
