-- users_public_profile_enabled
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- ============================================================================
-- Social-sharing follow-through, item #7b: per-ACCOUNT public-profile gate.
--
-- The public account page at /u/[slug] has been live since the slug-routing
-- cutover, but every account is currently reachable — the empty state even
-- prints the holder's real display_name for any enumerable slug (a name +
-- existence oracle). This column makes the /u shell DORMANT BY DEFAULT: the
-- owner must explicitly opt IN to a public showcase profile.
--
-- This is a per-ACCOUNT gate, deliberately DISTINCT from the per-event
-- `events.landing_page_visibility` gate. The /u page still only ever lists
-- effectively-public events; `public_profile_enabled` governs whether the /u
-- shell itself is reachable / shareable / indexable at all.
--
-- ADDITIVE ONLY + idempotent. Default FALSE = the safe (dormant) state, so
-- deploying the column ahead of the enforcement code simply hides every /u
-- page from strangers until each owner opts in — never a regression.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS public_profile_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- No RLS change. The existing `user_owns_row` policy on public.users is
-- FOR ALL … USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()), so
-- an account can already read + set its own `public_profile_enabled` (it is
-- just another self-owned column; admins stay covered by admin_full_access_users).
-- The public /u/[slug] page reads this column through the service-role admin
-- client (which bypasses RLS), so no public-read policy is introduced — the
-- gate stays a server-side check, not a row-visibility one.
