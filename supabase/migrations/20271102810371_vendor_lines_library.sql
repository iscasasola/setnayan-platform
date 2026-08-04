-- vendor_lines_library
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ⚠ RE-ALLOCATED 2026-08-04. This shipped originally as 20271029051678, whose
--   prefix had fallen BELOW main's applied head (20271102113000) while the PR
--   sat open — 16 migrations were already applied above it and this one was not
--   among them. Migrations apply once, in prefix order, so the original would
--   have merged with green CI and created NOTHING: no vendor_lines table, and
--   every screen in this PR reading a relation that does not exist. The SQL
--   below is unchanged.
--   VERIFY THE OBJECT AFTER MERGE, not schema_migrations:
--     SELECT to_regclass('public.vendor_lines');   -- must be non-NULL

-- ═══════════════════════════════════════════════════════════════════════════
-- MY LINES — the emcee's script library, and the half that TRAVELS.
--
-- Owner-locked 2026-08-01 ("lock it"):
--   Emcee_Script_Layer_LOCKED_BUILD_SPEC_2026-08-01.md
--
-- ── WHY THIS EXISTS ────────────────────────────────────────────────────────
--
-- `vendor_block_scripts` (shipped, PR #3977) holds what a host will say at one
-- moment of ONE wedding. On its own that is a FORM: an emcee does ~40 weddings
-- a year saying nearly the same things with the names swapped, and it made him
-- retype all of it every time. The owner rejected exactly that.
--
-- This table is the other half — his craft, kept once, reused forever. It is
-- the THIRD instance of a split the owner locked on 2026-07-27 ("his
-- questionaire can be saved as his template. to use for succeeding customers")
-- and that already ships twice:
--
--     vendor_songs       <-> event_song_picks
--     vendor_activities  <-> event_activity_picks
--     vendor_lines       <-> vendor_block_scripts     <- this migration
--
-- THE STRUCTURAL GUARANTEE: this table has NO `event_id`, by design. A row here
-- cannot belong to a wedding, so it cannot leak from one couple to the next --
-- the rule is enforced by the SCHEMA, not by anyone's diligence.
--
-- ── WHAT A ROW IS ──────────────────────────────────────────────────────────
--
-- One reusable line, holding a TEMPLATE (never names). The couple's names are
-- slots filled at render -- the same shape `lib/vendor-autoreply/phrasings.ts`
-- already uses: store the phrasing, substitute at read. So a corrected name
-- propagates everywhere at once and no stored row ever carries a real person.
--
-- ── HOW A SAVED LINE FINDS THE RIGHT MOMENT ────────────────────────────────
--
-- The locked three-rung ladder (spec section 2). A row carries the keys for all
-- three so a match can degrade honestly rather than guess:
--
--   1. activity_id  -- his own named segment. Exact, and the same UUID travels
--                      to every wedding via the shipped pick bridge.
--   2. label_key    -- the normalized name of the moment he wrote it on, so a
--                      hand-typed "Money Dance" still matches. The UI must FLAG
--                      this rung ("matched by name -- glance it"), never
--                      silently trust it.
--   3. block_type   -- day-part. SINGLETON FRAMING MOMENTS ONLY. A repeated
--                      type must NEVER auto-fill, or every `program` block gets
--                      the same line. That rule lives in the resolver
--                      (lib/emcee-lines.ts) where it is unit-tested; this table
--                      only stores the key.
--
--   No key matches => NO FILL. Saying "nothing fits yet" is correct behaviour,
--   not a failure.
--
-- ── PRIVATE MOMENTS NEVER PRE-FILL ─────────────────────────────────────────
--
-- A private block's note is staging, not copy ("watch for Grace by the sound
-- booth" -- last wedding's coordinator). `is_private_note` marks a row authored
-- on a private moment so the resolver refuses to reuse it. Locked, spec 3.4.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_lines (
  line_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Whose craft this is. NO event_id exists on this table -- see the header.
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,

  -- ── the three keys of the matching ladder ───────────────────────────────
  -- Rung 1: his own named segment. SET NULL, not CASCADE: if he deletes the
  -- segment the LINE is still his craft and must survive -- it simply drops to
  -- rung 2 (by name), the honest degradation the spec asks for.
  activity_id       UUID REFERENCES public.vendor_activities(activity_id) ON DELETE SET NULL,
  -- Rung 2: normalized label of the moment it was written on ("money dance").
  label_key         TEXT,
  -- Rung 3: day-part. Free TEXT to match `vendor_activities.block_type`, which
  -- has no FK either -- an unknown value must fall through the ladder, never
  -- throw.
  block_type        TEXT,

  -- ── the line itself ─────────────────────────────────────────────────────
  -- The TEMPLATE. Carries slot tokens, never a real name. Bounded to match
  -- `vendor_block_scripts.body` so a template can never outgrow the event copy
  -- it will be written into -- slot tokens count toward the limit.
  body              TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),

  -- Authored on a private moment => never reused. See the header.
  is_private_note   BOOLEAN NOT NULL DEFAULT FALSE,

  -- Provenance for the UI chip and for "newest wins".
  last_used_at      TIMESTAMPTZ,
  use_count         INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,

  -- A row with no key at all could never be found by the resolver, so it would
  -- be write-only clutter. At least one rung must be present.
  CONSTRAINT vendor_lines_has_a_key
    CHECK (activity_id IS NOT NULL OR label_key IS NOT NULL OR block_type IS NOT NULL)
);

-- ── "cache, not log": one line per (vendor, key) -- newest wins ────────────
-- The same overwrite semantics as `vendor_reply_templates`. Save is AUTOMATIC
-- (spec 3.1), so without this the library would accumulate one row per wedding
-- and stop being a library. Partial uniques, one per rung, live rows only.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_lines_one_per_activity
  ON public.vendor_lines (vendor_profile_id, activity_id)
  WHERE deleted_at IS NULL AND activity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_lines_one_per_label
  ON public.vendor_lines (vendor_profile_id, label_key)
  WHERE deleted_at IS NULL AND activity_id IS NULL AND label_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_lines_one_per_block_type
  ON public.vendor_lines (vendor_profile_id, block_type)
  WHERE deleted_at IS NULL AND activity_id IS NULL AND label_key IS NULL AND block_type IS NOT NULL;

-- The only read the library and the pre-fill do: this vendor's live lines.
CREATE INDEX IF NOT EXISTS vendor_lines_vendor_idx
  ON public.vendor_lines (vendor_profile_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.vendor_lines ENABLE ROW LEVEL SECURITY;

-- ONE policy, both directions -- the idiom `vendor_songs`/`vendor_activities`
-- use for a vendor's own reusable list. His craft is his: no couple arm, no
-- coordinator arm, no other-supplier arm. Deliberately NOT named `_host_` or
-- `_couple_`, which carry an expectation of couple-scoping.
DROP POLICY IF EXISTS vendor_lines_owner_all ON public.vendor_lines;
CREATE POLICY vendor_lines_owner_all
  ON public.vendor_lines FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.is_admin()
  );

COMMENT ON TABLE public.vendor_lines IS
  'MY LINES - a host/MC''s reusable script lines, the half that TRAVELS between weddings (owner-locked 2026-08-01). Third instance of vendor_songs/vendor_activities: the craft is the vendor''s and has NO event_id BY DESIGN, so nothing personal to one couple can reach the next. Bodies are TEMPLATES carrying slot tokens, never real names (phrasings.ts shape). Match keys are the three rungs of the locked ladder - activity_id (exact) > label_key (by name, must be flagged in UI) > block_type (day-part, singleton moments only). Per-event copies live in vendor_block_scripts.';

-- ── Close the default-open grant ──────────────────────────────────────────
-- Every new table in `public` ships OPEN -- the default ACL grants arwdDxtm to
-- anon + authenticated, and RLS does not undo a table-level GRANT. Mandatory.
-- No `anon` grant at all: a stranger has no business in a vendor's craft.

REVOKE ALL ON public.vendor_lines FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_lines TO authenticated;

COMMIT;
