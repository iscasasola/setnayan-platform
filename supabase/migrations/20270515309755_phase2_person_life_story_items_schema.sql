-- phase2 person life story items schema
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- Person-spine · PHASE 2 · LIFE STORIES (owner "complete phase 2 now"
-- 2026-07-05 — STAGED / flag-off). Plan: 03_Strategy/People_Graph_and_Lifelong_
-- Identity_2026-07-04.md §9 ("Living" page state) + §12 ("Life stories" row —
-- "extends Papic per-guest delivery + galleries + editorial").
--
-- ⚠ PHASE 2 IS COUNSEL-GATED. This migration ships the SCHEMA ONLY — an empty,
-- deny-by-default, additive table. NOTHING in production writes to it: the
-- assembly flow that populates it is built behind an OFF feature flag
-- (NEXT_PUBLIC_PERSON_LIFE_STORIES) and MUST NOT go live (store/surface any
-- cross-event participant media) until PH counsel signs off. An empty inert
-- table carries no participant media and no legal exposure — same posture as
-- the Phase-1 `people` table and the Phase-2 `person_connections` table.
--
-- WHAT THIS IS: the multi-homing index. A shared event photo / 5s clip /
-- editorial that a person PARTICIPATED IN (they were tagged / QR-scanned / a
-- confirmed guest) surfaces in THAT person's own lifelong archive — not just
-- the host's gallery — so you accumulate a story from events you only ATTENDED.
--
-- HARD-LOCKED CONSTRAINTS BAKED INTO THE SHAPE (do NOT relax without the owner):
--   1. ASSEMBLED FROM TAGS + QR + CONFIRMED IDENTITY ONLY. `origin` is
--      constrained to those signals — NEVER 'auto_face' / cross-event face
--      recognition (memory project_setnayan_face_recognition_boundary +
--      DECISION_LOG 2026-07-04). No face-derived origin value exists here.
--   2. REFERENCES, NOT COPIES. A row holds a soft ref (source_table +
--      source_id) into the system-of-record on R2 (papic_photos /
--      papic_guest_captures / event_editorial). No r2_object_key, no bytes,
--      no media duplicated (memory project_setnayan_storage_drive_copy_
--      architecture: R2 = system of record; the archive holds references).
--   3. PARTICIPANT CAN HIDE WITHOUT AFFECTING THE HOST GALLERY. `hidden_at` is
--      PER PERSON on THIS row; it never touches papic_photos.hidden_at /
--      event_editorial. The host's gallery is untouched.
--   4. OPT-OUT + FACE-BLUR REMOVE THE PERSON. The removed_at column (set by the
--      opt-out / face-blur path) tombstones every life-story row for that
--      person so the person disappears from the assembled story.
--   5. EDITORIALS PROPAGATE ONLY ON HOST PUBLISH + CONSENTED-GUEST GATE. An
--      item_kind='editorial' row is only ever inserted by the flow when the
--      event_editorial is published AND the person cleared the existing
--      consented-Papic gate (memory reference_setnayan_editorial_experience_
--      spec). That gate lives in the flow layer; the schema records the fact
--      via consented_at (non-null required for editorial rows, see trigger).
--   6. ADULTS-FIRST. Minors are Phase 3 (guardian-held, counsel-gated); the
--      flow only ever multi-homes into a CLAIMED adult person's archive.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.person_story_items (
  id               BIGSERIAL PRIMARY KEY,                                       -- hidden internal join key
  story_item_id    UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),              -- row id (a reference, not a shared entity → no S89 public_id)

  -- WHOSE archive this item multi-homes into. The durable person node.
  person_id        UUID NOT NULL REFERENCES public.people(person_id) ON DELETE CASCADE,

  -- WHERE the item came from (the event the person participated in). Powers the
  -- "story from events I only attended" grouping and lets opt-out scope by event.
  event_id         UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,

  -- WHAT is referenced — a soft ref into the system of record (R2). No copy.
  -- No FK: the media tables' shapes are owned elsewhere and we don't want a hard
  -- coupling (same pattern as event_editorial.hero_photo_id soft refs).
  item_kind        TEXT NOT NULL CHECK (item_kind IN ('photo','clip','editorial')),
  source_table     TEXT NOT NULL CHECK (source_table IN ('papic_photos','papic_guest_captures','event_editorial')),
  source_id        UUID NOT NULL,                                               -- papic_photos.photo_id | papic_guest_captures.capture_id | event_editorial.editorial_id

  -- HOW the person was linked to this item — TAGS + QR + CONFIRMED IDENTITY ONLY.
  -- 'individual_qr'/'table_qr'/'manual_pick' mirror photo_tags.source (minus
  -- 'auto_face', deliberately EXCLUDED — no cross-event face recognition).
  -- 'confirmed_guest' = a claimed guest of the event (guests.person_id link).
  -- 'editorial_publish' = propagated on host publish + consented-guest gate.
  origin           TEXT NOT NULL CHECK (origin IN ('individual_qr','table_qr','manual_pick','confirmed_guest','editorial_publish')),

  -- The photo_tag that produced this row (when origin came from a tag). Soft ref.
  source_tag_id    UUID,

  -- Consent stamp. REQUIRED for editorial rows (the consented-guest gate); the
  -- CHECK below enforces "editorial ⇒ consented_at set". For photo/clip rows it
  -- may be NULL (tag/QR co-presence is its own consent surface).
  consented_at     TIMESTAMPTZ,

  -- PER-PERSON hide — the participant hides THIS item from THEIR story. Does NOT
  -- touch papic_photos.hidden_at / the host gallery (constraint #3).
  hidden_at        TIMESTAMPTZ,

  -- Opt-out / face-blur tombstone — removes the person from the assembled story
  -- (constraint #4). Distinct from hidden_at: hidden = person tidies their own
  -- story; removed = person exercised opt-out / was face-blurred out.
  removed_at       TIMESTAMPTZ,
  removed_reason   TEXT CHECK (removed_reason IN ('opt_out','face_blur','admin')),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Editorial rows must carry the consent stamp (constraint #5) — the gate is
  -- structural, not just policy.
  CONSTRAINT person_story_items_editorial_consented
    CHECK (item_kind <> 'editorial' OR consented_at IS NOT NULL),
  -- item_kind and source_table must agree.
  CONSTRAINT person_story_items_kind_matches_source
    CHECK (
      (item_kind = 'editorial' AND source_table = 'event_editorial')
      OR (item_kind IN ('photo','clip') AND source_table IN ('papic_photos','papic_guest_captures'))
    )
);

COMMENT ON TABLE public.person_story_items IS
  'Person-spine PHASE 2 life stories (counsel-gated; empty/inert until the flag-gated assembly flow is cleared to go live). Multi-homes a shared event photo/clip/editorial into a PARTICIPANT''s lifelong archive by REFERENCE (source_table+source_id into R2, never a copy). Assembled from TAGS+QR+CONFIRMED IDENTITY only (never cross-event face recognition). Per-person hide (hidden_at) never affects the host gallery; opt-out/face-blur tombstones via removed_at. Editorials require consented_at (host-publish + consented-guest gate). Adults-first.';
COMMENT ON COLUMN public.person_story_items.origin IS
  'How the person was linked to the item — TAGS + QR + CONFIRMED IDENTITY ONLY. auto_face is deliberately absent: no cross-event face recognition (project_setnayan_face_recognition_boundary).';
COMMENT ON COLUMN public.person_story_items.hidden_at IS
  'Per-person hide from THEIR story. Never touches the host gallery (papic_photos.hidden_at / event_editorial).';
COMMENT ON COLUMN public.person_story_items.removed_at IS
  'Opt-out / face-blur tombstone — removes the person from the assembled story.';

-- One life-story row per (person, referenced item). No duplicate multi-homing.
CREATE UNIQUE INDEX IF NOT EXISTS person_story_items_unique
  ON public.person_story_items (person_id, source_table, source_id);
-- The archive read: a person's whole story, newest first, live rows only.
CREATE INDEX IF NOT EXISTS person_story_items_person_idx
  ON public.person_story_items (person_id, created_at DESC)
  WHERE hidden_at IS NULL AND removed_at IS NULL;
-- Per-event grouping ("your story from this event") + opt-out scoping.
CREATE INDEX IF NOT EXISTS person_story_items_person_event_idx
  ON public.person_story_items (person_id, event_id);
-- Reverse lookup: everyone this source item multi-homed to (host-side unshare).
CREATE INDEX IF NOT EXISTS person_story_items_source_idx
  ON public.person_story_items (source_table, source_id);

CREATE OR REPLACE FUNCTION public.person_story_items_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS person_story_items_set_updated_at ON public.person_story_items;
CREATE TRIGGER person_story_items_set_updated_at
  BEFORE UPDATE ON public.person_story_items
  FOR EACH ROW EXECUTE FUNCTION public.person_story_items_set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — private to the person whose story this is (+ admin), deny-by-default.
-- A life-story row is visible/actionable ONLY to the account that CLAIMED the
-- person_id (person owns their own archive), or an admin. Nobody browses anyone
-- else's story. RLS enabled in the SAME migration as CREATE TABLE, mirroring the
-- person_connections participant-scoped pattern. (The assembly/insert path runs
-- as a SECURITY DEFINER server flow behind the OFF flag; this policy is the
-- safety net — an unclaimed person has no auth.uid(), so its rows are invisible
-- to everyone but admin, exactly as intended.)
-- ----------------------------------------------------------------------------
ALTER TABLE public.person_story_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS person_story_items_owner ON public.person_story_items;
CREATE POLICY person_story_items_owner ON public.person_story_items
  FOR ALL
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.people p
      WHERE p.person_id = person_story_items.person_id
        AND p.claimed_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.people p
      WHERE p.person_id = person_story_items.person_id
        AND p.claimed_by_user_id = auth.uid()
    )
  );
