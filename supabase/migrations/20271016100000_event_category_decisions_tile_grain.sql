-- Explore Replan slice C (Explore_Replan_BUILD_SPEC_2026-07-27.md §3 PR-C ·
-- design §5.2 "adaptive accordion — add / remove categories").
--
-- WHAT THIS ADDS
-- `event_category_decisions` records the couple's answer for a PLAN GROUP
-- (27 of them). The Explore bench renders at TILE grain (~53 tiles), and the
-- bridge is MANY-to-one — `ceremony_venue` is the catalogTile of both the
-- `ceremony_venue` and `officiant` groups — so a group-grain row cannot say
-- "I don't need a Photo Booth" without also speaking for its siblings. This
-- migration lets ONE row be recorded at tile grain instead:
--
--   · `tile`          nullable text — the taxonomy tile the decision is about.
--   · partial UNIQUE  (event_id, tile) WHERE tile IS NOT NULL — one decision
--                     per tile per event, upsertable.
--   · `plan_group_id` becomes NULLABLE so a tile row does not have to invent a
--                     group. The pre-existing UNIQUE (event_id, plan_group_id)
--                     is untouched: Postgres treats NULLs as distinct, so many
--                     tile rows coexist under it.
--   · grain CHECK     at least one of the two grains must be present, so a row
--                     can never be about nothing.
--
-- EXISTING ROWS KEEP WORKING. Every shipped writer (`markCategoryComplete`,
-- `finalizeVendor`'s hard-single auto-complete, `revertVendorToConsidering`)
-- writes `plan_group_id` and leaves `tile` NULL, and every shipped reader
-- (`coveredByTile` on the vendors page) filters `decision='complete'` — which
-- tile rows never carry (slice C writes 'excluded' only). RLS, the couple-own
-- policies, and the decision CHECK widened by 20271012100000 are all untouched.
--
-- DEFAULT-ACL RULE (memory: "every new table/view in `public` ships OPEN").
-- A new COLUMN inherits the TABLE's grants, and this table was created in
-- 20270110320013 with the default `arwdDxtm` to anon + authenticated — so the
-- new column would ship readable by `anon` too. RLS has always blocked anon in
-- practice (`current_event_ids()` is empty without a session), but defence in
-- depth is the rule, so this revokes `anon` from the table outright rather than
-- adding one more anon-readable column to a couple-private behavioural table.
-- `authenticated` is untouched — every legitimate reader/writer is a signed-in
-- couple member going through RLS.
--
-- ⚠ NOT APPLIED TO PROD BY THIS PR. The post-conditions at the bottom RAISE on
-- failure, because `schema_migrations` can record a migration as applied while
-- its objects never landed (memory: "verify the OBJECT, never the ledger").

ALTER TABLE public.event_category_decisions
  ADD COLUMN IF NOT EXISTS tile text;

ALTER TABLE public.event_category_decisions
  ALTER COLUMN plan_group_id DROP NOT NULL;

-- One decision per (event, tile). Partial so the ~all-NULL group-grain rows
-- are not forced into a single-row-per-event straitjacket.
CREATE UNIQUE INDEX IF NOT EXISTS event_category_decisions_event_tile_key
  ON public.event_category_decisions (event_id, tile)
  WHERE tile IS NOT NULL;

-- A row must be about SOMETHING — a plan group, a tile, or both.
ALTER TABLE public.event_category_decisions
  DROP CONSTRAINT IF EXISTS event_category_decisions_grain_check;

ALTER TABLE public.event_category_decisions
  ADD CONSTRAINT event_category_decisions_grain_check
  CHECK (plan_group_id IS NOT NULL OR tile IS NOT NULL);

REVOKE ALL ON TABLE public.event_category_decisions FROM anon;

-- ── Post-conditions — RAISE, never trust the ledger ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'event_category_decisions'
       AND column_name = 'tile'
  ) THEN
    RAISE EXCEPTION 'post-condition failed: event_category_decisions.tile did not land';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'event_category_decisions'
       AND column_name = 'plan_group_id'
       AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'post-condition failed: event_category_decisions.plan_group_id is still NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'event_category_decisions'
       AND indexname = 'event_category_decisions_event_tile_key'
  ) THEN
    RAISE EXCEPTION 'post-condition failed: partial unique (event_id, tile) did not land';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.event_category_decisions'::regclass
       AND conname = 'event_category_decisions_grain_check'
  ) THEN
    RAISE EXCEPTION 'post-condition failed: grain CHECK did not land';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public'
       AND table_name = 'event_category_decisions'
       AND grantee = 'anon'
  ) THEN
    RAISE EXCEPTION 'post-condition failed: anon still holds privileges on event_category_decisions';
  END IF;
END $$;
