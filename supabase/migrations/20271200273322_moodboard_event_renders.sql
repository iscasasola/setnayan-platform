-- ============================================================================
-- 20271200273322_moodboard_event_renders.sql
--
-- Mood Board "Make it real" — `event_renders`, the row a paid render leaves
-- behind (MB2, second half). Substrate only: no UI, no generation pipeline, no
-- cache lookup. MB7 renders the surface, MB8 calls the model, MB9 reads the
-- digest.
--
-- ── WHAT ONE ROW HOLDS ─────────────────────────────────────────────────────
--   the image (image_key)                 · the design it was made from
--   the prompt actually sent              · the inspirations that conditioned it
--   the credits it cost                   · when it happened
--   a normalised config digest            · a `reusable` flag
--   which PART it depicts                 · the couple's free-text note
--
-- ── `reusable` IS GENERATED, NOT REMEMBERED ────────────────────────────────
-- The owner's cache decision (2026-09-03) says a render made WITH a free-text
-- note is stored but never offered to another couple: the note shaped the image
-- and is deliberately excluded from the cache key, so a note-bearing render is
-- both a poor cache entry AND the only place anything personally-shaped could
-- leak ("my lola's veil on the chair"). That exclusion is the whole privacy
-- story for cache reuse — there is no second rule underneath it.
--
-- So `reusable` is a GENERATED ALWAYS ... STORED column, not a boolean somebody
-- has to remember to set:
--     reusable = note IS NULL
--                AND image_key IS NOT NULL      -- nothing to serve
--                AND failed_at IS NULL          -- a failure is not a library entry
--                AND NOT reuse_blocked          -- admin quarantine
-- A flag that CAN drift from the note eventually will, and the failure mode is
-- silent: another couple's personal render served as a library match, with
-- nothing rendering differently to show it. Making it uncomputable-by-hand
-- removes the class rather than guarding it.
--
-- ⚠ CONSEQUENCE, ON PURPOSE: `reusable` cannot be UPDATEd. To withdraw one
-- render from the pool, set `reuse_blocked = TRUE`. To widen the rule, widen
-- the expression here — never add a second flag that disagrees with this one.
--
-- ⚠ AND NOTE THE SHAPE THIS AVOIDS: a DEFAULT TRUE flag plus a BEFORE INSERT
-- trigger asserting the note rule is the exact construction that refused every
-- insert for five weeks on this repo (the supplier-add outage). There is no
-- trigger on this table.
--
-- ── THE DIGEST CARRIES ITS OWN VERSION ─────────────────────────────────────
-- `config_digest` is `v<n>:<digest>`. MB9's key must be COARSE — mood + major
-- colours quantised + dominant zone selections, with the free-text note
-- EXCLUDED — or, with 10 moods × arbitrary hexes × multi-select zones, it is
-- unique per couple and caches nothing while looking like it works. When the
-- normalisation changes, MB9 bumps the version prefix and the old pool ages out
-- of matching instead of serving wrong hits. No column, no backfill, no
-- migration to invalidate a cache.
--
-- ── RLS: PATTERN B (§ 5 mapping table) ─────────────────────────────────────
-- Event-scoped collaborative data. The § 5 mapping table puts two render
-- tables on Pattern B — `led_background_renders` (0005) and
-- `ai_highlight_renders` (0011); only the first was ever built (verify with
-- `grep -rn "CREATE TABLE.*_renders" supabase/migrations`), so it is the one
-- shipped analogue this follows. Any event member reads; couples/coordinators
-- and admin write. Cross-event cache reads are NOT granted here: MB9 must read
-- the pool through a SECURITY DEFINER function that filters `WHERE reusable`,
-- never by widening this policy.
--
-- ADDITIVE + IDEMPOTENT. Inert on apply — no writer exists until MB8.
--
-- ⚠ DO NOT APPLY THIS DIRECTLY TO PRODUCTION. The pipeline pushes the
-- committed file; a direct apply orphans the prod ledger and jams db push for
-- every subsequent merge.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_renders (
  render_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL
                          REFERENCES public.events(event_id) ON DELETE CASCADE,

  -- WHICH PART. Namespaced so a room zone, an attire role and an inspiration
  -- place slot that share a word ('bride' is both a PaletteKey and an
  -- inspiration slot; 'ceiling' is both a RECEPTION_PARTS zone and a slot)
  -- can never collide. The vocabulary is DERIVED at runtime in
  -- apps/web/lib/moodboard-render-parts.ts from RECEPTION_PARTS, the PaletteKey
  -- attire roles and the inspiration slot keys — so this CHECK deliberately
  -- constrains the SHAPE, not the list. A list here would go stale the first
  -- time a zone is added, which is the exact failure the registry exists to
  -- prevent.
  --
  -- The CHECKs on this table are all explicitly NAMED. Postgres would autoname
  -- them, but the Ugat schema-claims guard asserts constraints BY NAME, and an
  -- autonamed constraint silently renumbers (`_check`, `_check1`) the moment a
  -- second CHECK lands on the same column — a guard that then passes because it
  -- matched nothing.
  part_id               TEXT NOT NULL
                          CONSTRAINT event_renders_part_id_shape
                          CHECK (part_id = 'whole_look'
                                 OR part_id ~ '^(room|people|place):[a-z0-9_]+$'),

  -- R2 object key. NULL while the render is in flight or after it failed —
  -- an absent image must be absent, never an empty string that reads as one.
  image_key             TEXT
                          CONSTRAINT event_renders_image_key_not_blank
                          CHECK (image_key IS NULL OR btrim(image_key) <> ''),

  -- The board as it stood when this image was made: reception_design +
  -- role_palette + venue settings. A render is a historical fact; it must stay
  -- readable after the couple redesigns, and it is what "your render no longer
  -- matches your board" is measured against.
  design_snapshot       JSONB NOT NULL,

  -- The stylist brief actually sent to the model, assembled by buildPrompt().
  -- Stored because a render nobody can explain is a charge nobody can defend.
  prompt                TEXT NOT NULL
                          CONSTRAINT event_renders_prompt_not_blank
                          CHECK (btrim(prompt) <> ''),

  -- Which inspiration uploads conditioned this render. A plain UUID[] rather
  -- than a child table: inspirations are soft-deleted (removed_at), so the ids
  -- keep resolving, and the only query anyone needs is "was this asset used".
  inspiration_asset_ids UUID[] NOT NULL DEFAULT '{}',

  -- The couple's per-box free text — "it's outdoors", "my lola's veil on the
  -- chair". NULL means no note, unambiguously: a blank string is refused rather
  -- than allowed to masquerade as one, because `reusable` turns on this being
  -- NULL. The 4000 here is an ABUSE fence; the product cap couples actually hit
  -- is moodboard_render_config.max_note_chars.
  note                  TEXT
                          CONSTRAINT event_renders_note_shape
                          CHECK (note IS NULL
                                 OR (btrim(note) <> '' AND length(note) <= 4000)),

  -- 1 for a part · 5 for the whole look · 0 for a free library match, read from
  -- moodboard_render_config at spend time. Never a peso figure.
  credits_debited       INTEGER NOT NULL DEFAULT 0
                          CONSTRAINT event_renders_credits_debited_nonneg
                          CHECK (credits_debited >= 0),

  -- MB9's cache key. `v<n>:<digest>` — see the header.
  config_digest         TEXT NOT NULL
                          CONSTRAINT event_renders_config_digest_versioned
                          CHECK (config_digest ~ '^v[0-9]+:.+$'),

  -- Admin quarantine: withdraw one render from the reuse pool without deleting
  -- the couple's own copy of it.
  reuse_blocked         BOOLEAN NOT NULL DEFAULT FALSE,

  failed_at             TIMESTAMPTZ,
  failure_reason        TEXT,

  -- GENERATED — see the header. This is the cache's admission test and the
  -- privacy boundary, and it is computed, never asserted.
  reusable              BOOLEAN GENERATED ALWAYS AS (
                          note IS NULL
                          AND image_key IS NOT NULL
                          AND failed_at IS NULL
                          AND NOT reuse_blocked
                        ) STORED,

  -- Who spent the credit. ON DELETE SET NULL, not CASCADE: the render belongs
  -- to the EVENT, so a co-partner leaving must not delete images the couple
  -- paid for. Nulling de-identifies it at zero cost — no reader selects this
  -- column, no label shows it, no RLS policy consults it. Registered in
  -- AUTHOR_UUID_NULLS (lib/erasure/coverage.ts) and exported author-scoped by
  -- /api/profile/export, so it is answered under RA 10173 rather than left as
  -- another uuid nobody has a verdict for.
  created_by_user_id    UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

COMMENT ON TABLE public.event_renders IS
  'One row per Mood Board "Make it real" render (MB2). Holds the image key, the '
  'design snapshot, the prompt sent, the inspirations used, the credits '
  'debited, the per-box note, and the normalised config digest MB9 caches on. '
  'part_id is namespaced (room:/people:/place:/whole_look) against the derived '
  'registry in lib/moodboard-render-parts.ts.';

COMMENT ON COLUMN public.event_renders.reusable IS
  'GENERATED. TRUE only when the render carries no free-text note, has an '
  'image, did not fail, and is not admin-blocked. A note-bearing render is '
  'stored but never offered to another couple (owner 2026-09-03) — computed '
  'rather than set, because a flag that can drift from the note eventually '
  'does, silently. Set reuse_blocked to withdraw a render from the pool.';

COMMENT ON COLUMN public.event_renders.config_digest IS
  'v<n>:<digest>. The COARSE normalised configuration key MB9 matches on — mood '
  '+ quantised major colours + dominant zone selections, with the free-text '
  'note EXCLUDED. An exact-brief key would be unique per couple and cache '
  'nothing while looking like it worked. Bump the v<n> prefix to invalidate.';

-- The couple's own gallery for one event.
CREATE INDEX IF NOT EXISTS event_renders_event_idx
  ON public.event_renders (event_id, created_at DESC);

-- MB9's cache probe, and nothing else: partial on `reusable`, so note-bearing,
-- failed and quarantined rows are not merely filtered out — they are not in the
-- index the lookup reads.
CREATE INDEX IF NOT EXISTS event_renders_cache_idx
  ON public.event_renders (config_digest, part_id)
  WHERE reusable;

-- ---- RLS — Pattern B ------------------------------------------------------

ALTER TABLE public.event_renders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_renders_member_read ON public.event_renders;
CREATE POLICY event_renders_member_read
  ON public.event_renders
  FOR SELECT
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_renders_couple_insert ON public.event_renders;
CREATE POLICY event_renders_couple_insert
  ON public.event_renders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_renders.event_id
        AND em.user_id  = auth.uid()
        AND em.member_type IN ('couple', 'coordinator')
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_renders_couple_update ON public.event_renders;
CREATE POLICY event_renders_couple_update
  ON public.event_renders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_renders.event_id
        AND em.user_id  = auth.uid()
        AND em.member_type IN ('couple', 'coordinator')
    )
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_renders.event_id
        AND em.user_id  = auth.uid()
        AND em.member_type IN ('couple', 'coordinator')
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_renders_couple_delete ON public.event_renders;
CREATE POLICY event_renders_couple_delete
  ON public.event_renders
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_renders.event_id
        AND em.user_id  = auth.uid()
        AND em.member_type IN ('couple', 'coordinator')
    )
    OR public.is_admin()
  );

-- ---- grants — Supabase's default is wider than this table wants -----------
--
-- Every new `public` table is granted ALL to `anon` and `authenticated` and
-- published as a REST endpoint; the anon key is in the page source by design.
-- RLS is ROW-level and can never hide a COLUMN, so the capability has to be
-- taken away rather than merely policed. A logged-out visitor is not an event
-- member and has no reason to reach this table at all.
REVOKE ALL ON TABLE public.event_renders FROM anon;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase SQL editor):
--   -- reusable is computed, and a note switches it off with no extra step:
--   INSERT INTO public.event_renders
--     (event_id, part_id, image_key, design_snapshot, prompt, config_digest)
--     VALUES ('<event>', 'room:ceiling', 'renders/x.jpg', '{}'::jsonb, 'p', 'v1:abc')
--   RETURNING reusable;                                   -- t
--   INSERT INTO public.event_renders
--     (event_id, part_id, image_key, design_snapshot, prompt, config_digest, note)
--     VALUES ('<event>', 'room:ceiling', 'renders/y.jpg', '{}'::jsonb, 'p', 'v1:abc',
--             'my lola''s veil on the chair')
--   RETURNING reusable;                                   -- f
--   -- and it cannot be forced:
--   UPDATE public.event_renders SET reusable = TRUE;      -- ERROR (generated)
-- ============================================================================
