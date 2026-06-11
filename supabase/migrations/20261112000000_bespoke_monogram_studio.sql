-- =============================================================================
-- 20261112000000_bespoke_monogram_studio.sql
--
-- Bespoke Monogram Studio ("Setnayan AI") — Phase 2 of the 2026-06-11
-- monogram overhaul. Revives the 0037 bespoke-monogram vision on a NATIVE
-- VECTOR pipeline: the couple fills a short brief in the Monogram Maker,
-- Setnayan AI generates 4 native-SVG candidate marks per round (interlocked /
-- botanical / crest / geometric directions), they refine with feedback and
-- apply one as their event monogram. Replaces 0037's never-shipped
-- DALL-E-raster + vectorizer.ai plan (raster marks couldn't recolor or stay
-- crisp at print size; native SVG can).
--
-- TABLES
--   bespoke_monogram_generations — one row per candidate SVG, grouped by
--   round. The SVG is stored SANITIZED (lib/bespoke-monogram.ts allowlist —
--   no scripts/handlers/hrefs/foreignObject) as TEXT; marks run ~40–80KB.
--
-- EVENTS COLUMNS
--   monogram_custom_svg            — the APPLIED bespoke mark (sanitized SVG
--                                    markup). NULL = typographic lockup only.
--   monogram_custom_generation_id  — provenance pointer to the generation row.
--
-- Render precedence: custom svg wins on the LARGE surfaces (landing hero,
-- maker preview); the QR center + dashboard chrome stay typographic on
-- purpose (legibility at 28–56px — same letters-forward reasoning as the
-- 0000 event-switcher note).
--
-- RLS: COUPLE-ONLY on all three (current_couple_event_ids for select / insert
-- / delete) — the rows carry the engineered prompt + the couple's free-text
-- brief, and the self-join path lets any authenticated user become a guest of
-- any event, so current_event_ids() (any member type) is too broad here.
-- Generation rows are immutable — a refinement is a NEW round, so deliberately
-- no UPDATE policy.
-- ON DELETE CASCADE from events satisfies RA 10173 erasure.
--
-- Cost note: generation is capped app-side (MAX_BESPOKE_ROUNDS_PER_EVENT in
-- lib/bespoke-monogram.ts); the vector API runs ~US$0.08/mark. Pricing of
-- the studio as a SKU is DELIBERATELY not decided here — batched to the
-- owner's holistic pricing review; V1 ships cap-guarded and ungated.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.bespoke_monogram_generations (
  generation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  created_by     UUID REFERENCES auth.users(id),
  -- 1-based refinement round; the 4 candidates of one click share a round.
  round          INTEGER NOT NULL CHECK (round >= 1),
  -- The brief as submitted: { initials, style_key, motif, feedback }.
  brief          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- The engineered prompt actually sent to the vector model (debug/audit —
  -- never customer-shown; customer-facing brand is "Setnayan AI").
  prompt         TEXT NOT NULL,
  -- Sanitized SVG markup (allowlist-validated server-side before insert).
  svg_text       TEXT NOT NULL CHECK (length(svg_text) <= 524288),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.bespoke_monogram_generations IS
  'Setnayan AI bespoke monogram candidates (Phase 2 of the 2026-06-11 monogram overhaul; revives 0037 on native SVG). One row per generated candidate, 4 per round; svg_text is sanitized before insert (lib/bespoke-monogram.ts). Couple-event-scoped RLS; rounds are immutable (refine = new round). RA 10173 erasable via events CASCADE.';

CREATE INDEX IF NOT EXISTS bespoke_monogram_generations_event_round_idx
  ON public.bespoke_monogram_generations (event_id, round DESC, created_at DESC);

ALTER TABLE public.bespoke_monogram_generations ENABLE ROW LEVEL SECURITY;

-- COUPLE-ONLY across the board. The candidate rows carry the engineered
-- `prompt` + the couple's free-text `brief` (their story details), so SELECT
-- must use current_couple_event_ids() — NOT current_event_ids(), which admits
-- guests/vendors/coordinators (and the self-join path lets any authenticated
-- user become a guest of any event UUID — 20261102000000). Read/insert/delete
-- all gate on couple membership so a self-joined guest can neither read the
-- briefs nor wipe the couple's generations.

-- Couple reads only their own event's candidates.
DROP POLICY IF EXISTS couple_reads_bespoke_monogram_generations ON public.bespoke_monogram_generations;
CREATE POLICY couple_reads_bespoke_monogram_generations ON public.bespoke_monogram_generations
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- Couple inserts candidates for their own event; rows stamped with their uid.
DROP POLICY IF EXISTS couple_inserts_bespoke_monogram_generations ON public.bespoke_monogram_generations;
CREATE POLICY couple_inserts_bespoke_monogram_generations ON public.bespoke_monogram_generations
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    AND created_by = auth.uid()
  );

-- Couple may erase their own rows (RA 10173). Candidates are otherwise
-- immutable — a refinement is a NEW round, so deliberately no UPDATE policy.
DROP POLICY IF EXISTS couple_deletes_bespoke_monogram_generations ON public.bespoke_monogram_generations;
CREATE POLICY couple_deletes_bespoke_monogram_generations ON public.bespoke_monogram_generations
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- The applied bespoke mark lives on events (single read for the landing page —
-- no join; same access path as monogram_text/monogram_motion_key).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS monogram_custom_svg TEXT
    CHECK (monogram_custom_svg IS NULL OR length(monogram_custom_svg) <= 524288);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS monogram_custom_generation_id UUID
    REFERENCES public.bespoke_monogram_generations(generation_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.events.monogram_custom_svg IS
  'The APPLIED Setnayan-AI bespoke monogram (sanitized SVG markup). NULL = the typographic lockup renders. Wins on large surfaces (landing hero, maker preview); QR center + dashboard chrome deliberately stay typographic for small-size legibility. Set/cleared via the Monogram Maker bespoke studio.';

COMMENT ON COLUMN public.events.monogram_custom_generation_id IS
  'Provenance: which bespoke_monogram_generations row the applied monogram_custom_svg came from. SET NULL if that generation row is erased.';

COMMIT;

-- Verification:
--   SELECT count(*) FROM pg_policies WHERE tablename = 'bespoke_monogram_generations';
--   -- Expect 3 (select / insert / delete).
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='events' AND column_name LIKE 'monogram_custom%';
--   -- Expect monogram_custom_svg + monogram_custom_generation_id.
