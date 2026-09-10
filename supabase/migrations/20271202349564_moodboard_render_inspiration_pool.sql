-- ============================================================================
-- 20271202349564_moodboard_render_inspiration_pool.sql
--
-- Mood Board — MB9. Kept renders become a BROWSABLE REFERENCE for other
-- couples, as a third source in section 01 beside MB10's supplier gallery and
-- the couple's own uploads.
--
-- ── ⛔ THE CACHE IS CANCELLED. READ THIS BEFORE THE OTHER MIGRATIONS ────────
-- `20271200273322_moodboard_event_renders.sql` says, in its own header, that
-- "MB9's key must be COARSE" and that MB9 matches on `config_digest` to serve
-- a prior render as a FREE substitute output. **That description is stale.**
-- Owner, 2026-09-03: *"no need to give free renders. always charge for
-- renders."* There is no coarse matching, no matching radius, no free lane and
-- no cache-hit state anywhere in this migration or in the code that reads it.
-- `config_digest` keeps its column and its CHECK — nothing reads it for
-- matching, and this migration does not touch it. Applied migrations are never
-- edited, so that header stays wrong; this file is the current statement.
--
-- What a render is now worth to somebody else is what a PHOTOGRAPH is worth:
-- something to look at while deciding. Picking one costs nothing because it
-- produces nothing. Generating one always costs the stated credits.
--
-- ── 1. TWO COPIES OF ONE RENDER, AND THEY ARE DIFFERENT OBJECTS ────────────
-- `image_key`          the couple's own copy. UNMARKED. Private bucket.
--                      Nobody outside their event ever sees it.
-- `gallery_image_key`  the WATERMARKED copy, made server-side with `sharp`
--                      (lib/watermark-server.ts) and written to a DIFFERENT
--                      key. This is the only copy the pool below can return.
--
-- 🔑 THE POOL SELECTS `gallery_image_key`, NOT `image_key`. That is what makes
-- "every render entering the gallery carries the watermark" structural rather
-- than a promise: an unwatermarked render has no gallery key, and a row with no
-- gallery key is not in the pool's partial index at all. There is no flag
-- claiming the mark was applied — the mark IS the column's reason to exist, and
-- the only writer of that column (`moodboard_attach_gallery_copy`) is called
-- from exactly one place, immediately after the watermarker returns bytes.
--
-- ⚠ AND THE COUPLE'S OWN COPY IS NEVER MARKED. `moodboard_finish_render`
-- writes `image_key` and this migration does not change it. A couple paid for
-- that photograph; stamping it would be charging them and then defacing it.
--
-- ── 2. CONSENT IS MB8's, AND THERE IS NO SECOND ONE ────────────────────────
-- `event_render_share_consent` + `moodboard_set_share_consent` already exist
-- (20271201395665), tied to the +1 bonus render and locked per-EVENT rather
-- than per-photo. The pool JOINs that table and requires `consented`. No new
-- consent column, no per-photo toggle, no default-on: a couple who never
-- answered contributes nothing, and withdrawing removes their renders from
-- every future pool read on the next query.
--
-- ── 3. reuse_blocked STAYS THE ONLY WITHDRAWAL HANDLE ──────────────────────
-- `reusable` is GENERATED (`note IS NULL AND image_key IS NOT NULL AND
-- failed_at IS NULL AND NOT reuse_blocked`) and refuses every direct write.
-- The pool's `WHERE r.reusable` therefore inherits all four rules at once —
-- including the note rule, which is the privacy boundary: a render made with
-- "my lola's veil on the chair" is never offered to a stranger. No second flag
-- is added here that could disagree with it.
--
-- ── 4. A PICK IS A REFERENCE, AND THE DATABASE SAYS SO ─────────────────────
-- `event_inspiration_assets.source_kind` gains `'render_pick'`, paired with a
-- new `source_render_id` by a biconditional CHECK — the same shape MB10 used
-- for `gallery_pick`/`library_asset_id`. A pick writes ONE row in ONE table
-- that has nothing to do with credits: `event_render_credit_usage` is not
-- reachable from this path, and `moodboard_reserve_render_credits` is not
-- called by it. A free pick is not "a render priced at zero" — it is not a
-- render.
--
-- ⚠ `source_render_id` IS **ON DELETE CASCADE**, NOT SET NULL, and the reason
-- is a trap this repo has already been bitten by: SET NULL onto a column a
-- CHECK constrains makes the FK behave like RESTRICT. Nulling the id would
-- leave `source_kind = 'render_pick'` with a NULL id, which the biconditional
-- REFUSES — so deleting the source event (which cascades its renders) would
-- fail on a check violation, i.e. an account deletion blocked by somebody
-- else's mood board. That is an RA 10173 erasure hazard, not an inconvenience.
-- MB10 reasoned identically for `library_asset_id`.
--
-- ADDITIVE + IDEMPOTENT. Nothing is dropped, no stored row is invalidated: the
-- widened `source_kind` CHECK is a strict superset, and every existing row has
-- `source_render_id IS NULL` with `source_kind <> 'render_pick'`, so the
-- biconditional validates against live data with no backfill.
--
-- ⚠ DO NOT APPLY THIS DIRECTLY TO PRODUCTION. `deploy-prod.yml` runs
-- `supabase db push --include-all --yes` on merge; a direct apply stamps the
-- prod ledger with a version that has no file on `main` and jams `db push` for
-- every subsequent merge (2026-09-02: seven PRs stranded three hours).
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1 · the watermarked copy
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.event_renders
  ADD COLUMN IF NOT EXISTS gallery_image_key TEXT;

-- Named, like every other CHECK on this table: the Ugat schema-claims guard
-- asserts constraints BY NAME, and an autonamed CHECK renumbers the moment a
-- second one lands on the same table — a guard that then passes on nothing.
ALTER TABLE public.event_renders
  DROP CONSTRAINT IF EXISTS event_renders_gallery_image_key_not_blank;
ALTER TABLE public.event_renders
  ADD CONSTRAINT event_renders_gallery_image_key_not_blank
  CHECK (gallery_image_key IS NULL OR btrim(gallery_image_key) <> '');

COMMENT ON COLUMN public.event_renders.gallery_image_key IS
  'The WATERMARKED copy of this render (MB9), at a different R2 key from '
  'image_key. NULL until the server-side sharp watermarker has run and '
  'moodboard_attach_gallery_copy has recorded the result. The inspiration pool '
  'selects THIS column and never image_key, so an unmarked render cannot be '
  'shown to another couple — the mark is the column''s reason to exist rather '
  'than a flag claiming it was applied. The couple''s own copy (image_key) '
  'stays unmarked, deliberately: they paid for that photograph.';

-- The pool's only read. Partial on the exact admission test, so a note-bearing,
-- failed, quarantined or not-yet-watermarked render is not merely filtered out
-- — it is not in the index the pool walks.
CREATE INDEX IF NOT EXISTS event_renders_inspiration_pool_idx
  ON public.event_renders (created_at DESC)
  WHERE reusable AND gallery_image_key IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 2 · attaching the watermarked copy — the ONE writer
-- ────────────────────────────────────────────────────────────────────────────
--
-- `authenticated` holds no UPDATE on event_renders (revoked in 20271201395665),
-- so this function is the only door. It refuses everything that would put a
-- meaningless key in the column:
--   · a render with no image (nothing was watermarked);
--   · a failed/refunded render (not a library entry);
--   · a render that already HAS a gallery copy — overwriting would orphan the
--     first object with nothing left pointing at it. Idempotent by refusal,
--     the same posture as moodboard_finish_render.

CREATE OR REPLACE FUNCTION public.moodboard_attach_gallery_copy(
  p_render_id         UUID,
  p_gallery_image_key TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  IF p_render_id IS NULL OR btrim(COALESCE(p_gallery_image_key, '')) = '' THEN
    RETURN FALSE;
  END IF;

  SELECT r.event_id INTO v_event_id
    FROM public.event_renders r
   WHERE r.render_id = p_render_id
     FOR UPDATE;
  IF v_event_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF NOT public.moodboard_render_caller_may_act(v_event_id) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.event_renders
     SET gallery_image_key = btrim(p_gallery_image_key)
   WHERE render_id         = p_render_id
     AND gallery_image_key IS NULL       -- never orphan the first copy
     AND image_key         IS NOT NULL   -- there has to be something to mark
     AND failed_at         IS NULL;      -- a refunded render is not a library entry

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.moodboard_attach_gallery_copy(UUID, TEXT) IS
  'MB9. Records the R2 key of the WATERMARKED gallery copy of a delivered '
  'render. The only writer of event_renders.gallery_image_key. Refuses on a '
  'render with no image, on a failed one, and on one that already has a '
  'gallery copy (overwriting would orphan the first object).';

-- ────────────────────────────────────────────────────────────────────────────
-- 3 · the pool read — the sanctioned cross-event door
-- ────────────────────────────────────────────────────────────────────────────
--
-- `event_renders`'s RLS is Pattern B: a member reads their OWN event's renders
-- and nothing else. The 20271200273322 header says so explicitly — "Cross-event
-- cache reads are NOT granted here: MB9 must read the pool through a SECURITY
-- DEFINER function that filters WHERE reusable, never by widening this policy."
-- This is that function, and widening the policy remains the wrong answer: a
-- policy that admitted cross-event reads would expose `prompt`, `note`,
-- `design_snapshot` and `created_by_user_id` too. A function returns COLUMNS,
-- and these are the only ones another couple has any business seeing.
--
-- 🔒 WHAT IS DELIBERATELY NOT RETURNED: the source event id, the couple's
-- names, the prompt, the design snapshot, the note (which cannot exist here
-- anyway — `reusable` requires it NULL), and `image_key`. A reference photo
-- does not need to say whose wedding it was, and every one of those columns
-- would be a fact about strangers that the picker has no use for.
--
-- 🔑 AND THE CALLER'S OWN EVENT IS EXCLUDED. Their own renders already live,
-- unmarked and complete, in section 04's gallery. Listing them here — marked,
-- under "renders other couples chose to share" — would be both redundant and
-- untrue of the tile the couple is looking at.
--
-- `p_part_ids` filters to the render parts an inspiration slot actually
-- corresponds to. The mapping is DERIVED in TypeScript from the render-part
-- registry (lib/moodboard-render-parts.ts → renderPartIdsForSlot), never
-- restated as a list in SQL: a list here would go stale the first time a
-- reception zone is added, silently, and the couple would simply never see
-- ceiling renders when filling the ceiling slot.

CREATE OR REPLACE FUNCTION public.moodboard_inspiration_pool(
  p_event_id  UUID,
  p_part_ids  TEXT[] DEFAULT NULL,
  p_limit     INTEGER DEFAULT 6,
  p_offset    INTEGER DEFAULT 0,
  p_render_id UUID DEFAULT NULL
) RETURNS TABLE (
  render_id         UUID,
  part_id           TEXT,
  gallery_image_key TEXT,
  swatches          TEXT[],
  created_at        TIMESTAMPTZ,
  total_count       BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The caller must be acting for an event they belong to. Without this any
  -- authenticated session could walk the whole pool with curl; with it, the
  -- door is the same one every other Mood Board function uses.
  IF NOT public.moodboard_render_caller_may_act(p_event_id) THEN
    RETURN;                              -- zero rows, and the caller says so
  END IF;

  RETURN QUERY
    SELECT r.render_id,
           r.part_id,
           r.gallery_image_key,
           -- The colours this render was actually MADE from, lifted out of its
           -- own design snapshot. Not re-derived from the image and not
           -- invented: a picked photo writes six NOT NULL sampled_hex_* columns
           -- on the board row, and the only honest source for them is the
           -- palette the render was generated against. A render whose snapshot
           -- carries none comes back with an empty array and the shaping layer
           -- WITHHOLDS it rather than padding with cream — the same refusal
           -- shapeGalleryPage makes for a supplier photo with no sampled
           -- colours.
           CASE
             WHEN jsonb_typeof(r.design_snapshot -> 'role_palette' -> 'reception') = 'array'
               THEN ARRAY(
                 SELECT jsonb_array_elements_text(
                          r.design_snapshot -> 'role_palette' -> 'reception')
               )
             ELSE '{}'::TEXT[]
           END,
           r.created_at,
           COUNT(*) OVER () AS total_count
      FROM public.event_renders r
      JOIN public.event_render_share_consent c
        ON c.event_id = r.event_id
     WHERE r.reusable                              -- note-free · delivered · not failed · not quarantined
       AND r.gallery_image_key IS NOT NULL         -- watermarked, or it is not shown
       AND c.consented                             -- MB8's consent, per event
       AND r.event_id IS DISTINCT FROM p_event_id  -- not your own; you already have those
       AND (p_part_ids IS NULL
            OR cardinality(p_part_ids) = 0
            OR r.part_id = ANY (p_part_ids))
       -- 🔑 THE SAME DOOR TWICE. `p_render_id` narrows this to ONE render so
       -- the SAVE path can re-check admission through the identical predicate
       -- the BROWSE path used, rather than through a second query that would
       -- eventually disagree with it. MB10 makes the same argument for calling
       -- `shapeGalleryPage` on both sides.
       AND (p_render_id IS NULL OR r.render_id = p_render_id)
     ORDER BY r.created_at DESC, r.render_id
     LIMIT GREATEST(LEAST(COALESCE(p_limit, 6), 24), 1)
    OFFSET GREATEST(LEAST(COALESCE(p_offset, 0), 600), 0);
END;
$$;

COMMENT ON FUNCTION public.moodboard_inspiration_pool(UUID, TEXT[], INTEGER, INTEGER, UUID) IS
  'MB9. One page of the cross-event inspiration pool: renders that are '
  'reusable (note-free, delivered, not failed, not quarantined), whose event '
  'gave share consent, and that carry a WATERMARKED gallery copy. Returns '
  'gallery_image_key and never image_key, so an unmarked render cannot reach '
  'another couple. Excludes the caller''s own event and every column that '
  'would say whose wedding it was. Zero rows to a caller who may not act on '
  'p_event_id. Pass p_render_id to re-check ONE render through the identical '
  'predicate at save time. Picking one of these costs NOTHING — it is a '
  'reference, not a render.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4 · a picked render is provenanced, and the database enforces it
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.event_inspiration_assets
  ADD COLUMN IF NOT EXISTS source_render_id UUID
    -- CASCADE, not SET NULL — see the header. SET NULL onto a CHECK-constrained
    -- column makes the FK behave like RESTRICT, and deleting the source event
    -- would then fail on a check violation instead of cascading.
    REFERENCES public.event_renders(render_id) ON DELETE CASCADE;

COMMENT ON COLUMN public.event_inspiration_assets.source_render_id IS
  'The event_renders row this board photo was picked from (MB9). NULL for '
  'every other source. ON DELETE CASCADE — a render that is gone takes the '
  'reference tiles copied from it with it, because the alternative (SET NULL) '
  'would violate the biconditional CHECK below and block the parent delete.';

-- source_kind gains a fourth mode. Additive: all three existing values survive
-- verbatim. A NEW constraint name rather than an edit to 20271202093185, which
-- is applied and never rewritten.
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_source_kind_check;
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_source_kind_check_v2;
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_source_kind_check_v3;
ALTER TABLE public.event_inspiration_assets
  ADD CONSTRAINT event_inspiration_assets_source_kind_check_v3
  CHECK (source_kind IN ('url_paste', 'file_upload', 'gallery_pick', 'render_pick'));

-- The same biconditional MB10 wrote for gallery_pick, for the same reason: a
-- 'render_pick' with no source render is a reference that has forgotten what it
-- is a reference TO, and it would render as an ordinary tile with nothing going
-- wrong anywhere. The reverse (an id on a row claiming to be an upload) is
-- refused too, so the mode and the provenance can never disagree.
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_render_pick_has_provenance;
ALTER TABLE public.event_inspiration_assets
  ADD CONSTRAINT event_inspiration_assets_render_pick_has_provenance
  CHECK ((source_kind = 'render_pick') = (source_render_id IS NOT NULL));

-- ────────────────────────────────────────────────────────────────────────────
-- 5 · grants — REVOKE FIRST, because CREATE FUNCTION already granted PUBLIC
-- ────────────────────────────────────────────────────────────────────────────
--
-- 🛑 `CREATE FUNCTION` GRANTS EXECUTE TO PUBLIC AND `anon` INHERITS IT. Both
-- functions here are SECURITY DEFINER and both gate on
-- `moodboard_render_caller_may_act`, which reads a NULL auth.uid() as "the
-- server is asking" — exactly what an anonymous caller has. Left as created,
-- `moodboard_inspiration_pool` would hand every render on the platform to
-- anyone with curl and the publishable key. The REVOKE is what closes it; the
-- GRANT list alone never did. Caught by tests/db/anon-rpc-surface.db.test.ts.
REVOKE ALL ON FUNCTION public.moodboard_attach_gallery_copy(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_inspiration_pool(UUID, TEXT[], INTEGER, INTEGER, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.moodboard_attach_gallery_copy(UUID, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_inspiration_pool(UUID, TEXT[], INTEGER, INTEGER, UUID)
  TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase SQL editor):
--   -- the pool refuses a render with no watermarked copy:
--   SELECT count(*) FROM public.moodboard_inspiration_pool('<event>');   -- 0 today
--   -- and the gallery key cannot be written twice:
--   SELECT public.moodboard_attach_gallery_copy('<render>', 'render-gallery/a.jpg'); -- t
--   SELECT public.moodboard_attach_gallery_copy('<render>', 'render-gallery/b.jpg'); -- f
--   -- reusable is still computed and still refuses a direct write:
--   UPDATE public.event_renders SET reusable = TRUE;                     -- ERROR
-- ============================================================================
