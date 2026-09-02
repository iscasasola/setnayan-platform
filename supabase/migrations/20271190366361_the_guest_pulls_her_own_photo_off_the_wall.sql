-- 20271190366361_the_guest_pulls_her_own_photo_off_the_wall.sql
--
-- A GUEST CAN TAKE HER OWN PHOTOGRAPH OFF THE LIVE WALL, HERSELF.
--
-- Owner ruling 2026-09-02 (DECISION_LOG), settling item 6, verbatim in shape:
-- a guest controls **the photos she SHOT and the photos she is TAGGED in —
-- both** — and nobody else's. On the wall, when her photo is posted she can
-- un-post it. She does NOT get per-audience consent switches, and she does NOT
-- get to remove other people's photos.
--
-- ── WHY THIS MIGRATION IS TWO COLUMNS AND NOT A SUBSYSTEM ──────────────────
-- The kill switch already ships. `papic_photos.wall_hidden_at` /
-- `papic_guest_captures.wall_hidden_at` are documented in 20261104000959 as the
-- *"transient wall-only kill switch (reversible)"*, DISTINCT from `hidden_at`
-- (*"durable gallery/recap suppression"*), and `wall_visible_photos` already
-- refuses to project a row that carries one. What was missing was never a
-- mechanism — it was a WRITER: today the only ones are admin moderation and the
-- couple's Papic console (`wall_retract` / `wall_unhide`, both gated on
-- `event_members`). The guest, who is the person IN the photograph, had none.
--
-- The app-side writer is `lib/guest-wall-unpost.ts`, gated by the guest-session
-- cookie exactly as `removeMyTag` and `askToTakeMyPhotoDown` on the same page
-- are. This migration adds only the one fact those functions cannot express
-- with what already exists:
--
--   WHO pulled it.
--
-- ── WHY WHO MATTERS, AND WHAT IT IS *NOT* FOR ──────────────────────────────
-- `wall_hidden_at` is a bare timestamp: after it is set, nothing in the schema
-- can tell a guest's *"that is me and I don't want it up there"* apart from a
-- coordinator hiding a blurry frame. Two things need to tell them apart:
--
--   1. THE PUT-BACK. A guest may reverse HER OWN pull and must never be able to
--      reverse the couple's moderation. Without provenance the only ways to
--      express that are "she can undo anything" (wrong) or "she can undo
--      nothing" (a one-way door on a control people press by accident).
--   2. THE COUPLE'S RESTORE BUTTON, which is a real tile-level control
--      (`live-wall-controls.tsx` → `unhideWallTile`). Whoever presses it should
--      be able to see that the person in the photograph is the one who took it
--      down.
--
-- ⚠ IT IS NOT A LOCK. This migration does NOT stop the couple restoring a photo
-- a guest pulled — that is an owner decision, not one to make inside a schema
-- change, and it is flagged for sign-off rather than silently taken. All this
-- column buys today is that the row stops being ambiguous.
--
-- ── IDEMPOTENT ─────────────────────────────────────────────────────────────
-- ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE only. No table is created, no
-- policy is written, no grant changes: both tables already have RLS and neither
-- gains a new principal here.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Provenance for the wall-only kill switch.
-- ---------------------------------------------------------------------------
ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS wall_hidden_by_guest_id UUID
    REFERENCES public.guests(guest_id) ON DELETE SET NULL;

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS wall_hidden_by_guest_id UUID
    REFERENCES public.guests(guest_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.papic_photos.wall_hidden_by_guest_id IS
  'The GUEST who pulled this photo off the live wall herself (owner ruling 2026-09-02). NULL means the wall hide was not a guest''s — the couple, a coordinator or an admin — or the photo is not hidden at all. Only the guest named here may put it back; nobody else''s pull is hers to reverse. Paired with wall_hidden_at, never with hidden_at (the durable gallery hide is a different decision).';
COMMENT ON COLUMN public.papic_guest_captures.wall_hidden_by_guest_id IS
  'The GUEST who pulled this capture off the live wall herself (owner ruling 2026-09-02). NULL means the wall hide was not a guest''s — the couple, a coordinator or an admin — or the capture is not hidden at all. Only the guest named here may put it back.';

-- ON DELETE SET NULL, not CASCADE: a deleted guest must not take somebody
-- else's photograph's hidden state with her. The pull outlives the pointer.

-- The put-back reads this column by (row id, guest); both tables are already
-- keyed by their own primary key for that lookup, so no index is added — a
-- partial index on a column that is NULL for all but a handful of rows would
-- cost writes and buy nothing.

-- ---------------------------------------------------------------------------
-- 2. The couple's two RPCs stop leaving stale provenance behind.
--
--    BODY-IDENTICAL to 20261112000545 except for ONE added assignment in each:
--    `wall_hidden_by_guest_id = NULL`. Signature, return type, language,
--    volatility, security, search_path and every authorization check are
--    unchanged character for character, so PostgREST argument resolution and
--    both call sites (live-wall-actions.ts) are unaffected.
--
--    WHY: after the couple hides a photo a guest had pulled — or restores one —
--    a surviving `wall_hidden_by_guest_id` would say a guest is holding it down
--    when she no longer is, and the put-back would then offer HER a control
--    over a decision that is now somebody else's. A row that records the wrong
--    author of a privacy decision is worse than one that records none.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wall_retract(p_source_table TEXT, p_source_id UUID, p_also_gallery BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event UUID;
BEGIN
  IF p_source_table = 'papic_photos' THEN
    SELECT event_id INTO v_event FROM public.papic_photos WHERE photo_id = p_source_id;
  ELSIF p_source_table = 'papic_guest_captures' THEN
    SELECT event_id INTO v_event FROM public.papic_guest_captures WHERE capture_id = p_source_id;
  ELSE
    RETURN FALSE;
  END IF;
  IF v_event IS NULL THEN RETURN FALSE; END IF;

  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = v_event AND em.user_id = auth.uid()
      AND em.member_type IN ('couple', 'coordinator')
  )) THEN
    RAISE EXCEPTION 'not authorized to moderate this wall';
  END IF;

  IF p_source_table = 'papic_photos' THEN
    UPDATE public.papic_photos
      SET wall_hidden_at = NOW(),
          wall_hidden_by_guest_id = NULL,   -- this hide is the couple's, not a guest's
          hidden_at = CASE WHEN p_also_gallery THEN COALESCE(hidden_at, NOW()) ELSE hidden_at END
      WHERE photo_id = p_source_id;
  ELSE
    UPDATE public.papic_guest_captures
      SET wall_hidden_at = NOW(),
          wall_hidden_by_guest_id = NULL,   -- this hide is the couple's, not a guest's
          hidden_at = CASE WHEN p_also_gallery THEN COALESCE(hidden_at, NOW()) ELSE hidden_at END
      WHERE capture_id = p_source_id;
  END IF;

  UPDATE public.wall_feed SET wall_hidden_at = NOW()
    WHERE source_table = p_source_table AND source_id = p_source_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.wall_unhide(p_source_table TEXT, p_source_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event UUID;
BEGIN
  IF p_source_table = 'papic_photos' THEN
    SELECT event_id INTO v_event FROM public.papic_photos WHERE photo_id = p_source_id;
  ELSIF p_source_table = 'papic_guest_captures' THEN
    SELECT event_id INTO v_event FROM public.papic_guest_captures WHERE capture_id = p_source_id;
  ELSE
    RETURN FALSE;
  END IF;
  IF v_event IS NULL THEN RETURN FALSE; END IF;

  IF NOT (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = v_event AND em.user_id = auth.uid()
      AND em.member_type IN ('couple', 'coordinator')
  )) THEN
    RAISE EXCEPTION 'not authorized to moderate this wall';
  END IF;

  -- Wall-only un-hide (the durable gallery hidden_at is NOT touched here —
  -- restoring a gallery-hidden photo is a gallery decision, not a wall one).
  IF p_source_table = 'papic_photos' THEN
    UPDATE public.papic_photos
      SET wall_hidden_at = NULL, wall_hidden_by_guest_id = NULL
      WHERE photo_id = p_source_id;
  ELSE
    UPDATE public.papic_guest_captures
      SET wall_hidden_at = NULL, wall_hidden_by_guest_id = NULL
      WHERE capture_id = p_source_id;
  END IF;
  UPDATE public.wall_feed SET wall_hidden_at = NULL
    WHERE source_table = p_source_table AND source_id = p_source_id;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.wall_retract(TEXT, UUID, BOOLEAN) IS
  'Couple/coordinator/admin wall kill switch. Wall-only by default; p_also_gallery extends it to the durable gallery hide. Clears wall_hidden_by_guest_id because this hide is the couple''s, not a guest''s.';
COMMENT ON FUNCTION public.wall_unhide(TEXT, UUID) IS
  'Couple/coordinator/admin reverse of a wall-only hide. Clears wall_hidden_by_guest_id along with wall_hidden_at, so no row claims a guest is holding down a photo that is back on the wall. NOTE: this CAN restore a photo a guest pulled herself — whether it should is an open owner question (2026-09-02), deliberately not decided here.';

COMMIT;
