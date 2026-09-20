-- entourage_order_on_guests
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)


-- ─────────────────────────────────────────────────────────────────────────────
-- WHO WALKS FIRST — the couple's own order for the entourage.
--
-- ⚖ Owner 2026-09-20, after being shown the printing order: he wants to drag
-- them himself. Until now the invitation had NO order within a role at all:
-- neither entourage query carries an ORDER BY, so the names came back in
-- whatever order Postgres chose and could reshuffle between page loads. A
-- surname sort shipped alongside this as the default; this column is the
-- couple's override on top of it.
--
-- 🔑 WHY A NEW COLUMN AND NOT AN EXISTING ONE. Two columns look like they
-- might already hold this and neither does:
--   • `guests.seating_priority` (1–4) is the seating TIER — which table you
--     belong near. Two people can share a tier and still need a walking order,
--     and reordering a processional must never move a chair.
--   • `event_sponsors.pair_index` orders that table's rows, but the entourage
--     is built from `guests` ALONE and deliberately so (lib/entourage.ts: that
--     table held zero rows in production, and reading both would make two
--     mechanisms answer one question).
-- Overloading either would create a second, competing source of truth for a
-- fact neither was built to carry.
--
-- NULL means "not placed by hand" — those people sort after the placed ones on
-- the surname default, so a couple who orders three ninongs out of twelve gets
-- exactly what they asked for and an unsurprising tail. It is NOT NOT NULL and
-- has NO default for that reason: a default would be a placement nobody made.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS entourage_order integer;

COMMENT ON COLUMN public.guests.entourage_order IS
  'The couple''s hand-set walking order within one entourage role. NULL = never placed by hand (sorts after every placed name, on the surname default in lib/entourage.ts). Scoped per (event_id, role) by the UI, not by a constraint: a guest holds one primary role and may carry extra_roles, so a DB-level uniqueness rule would have to pick which role it spoke for. Never reuse seating_priority for this — that is the seating tier, and a processional reorder must not move a chair.';

-- The entourage read filters by event + role and now sorts by this column.
CREATE INDEX IF NOT EXISTS guests_entourage_order_idx
  ON public.guests (event_id, role, entourage_order)
  WHERE entourage_order IS NOT NULL AND deleted_at IS NULL;

-- No GRANT is issued here on purpose: `public.guests` carries TABLE-level
-- grants (verified 2026-09-20 — 60 columns × 4 privileges for anon,
-- authenticated, postgres and service_role), so a new column inherits them and
-- a column-level GRANT would be a no-op that reads like a decision. Row access
-- stays governed by the table's existing RLS policies.
