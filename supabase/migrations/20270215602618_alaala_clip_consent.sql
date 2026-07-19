-- alaala_clip_consent
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- 0012 Papic → Alaala — the two consent gates that feed the memory orb.
-- ============================================================================
--
-- The Alaala "living memory" orb on the brand /our-story manifesto crossfades
-- real Papic clips. The owner-locked rule (memory
-- project_setnayan_alaala_orb_video_consent) is: a clip may surface on a
-- PUBLIC showcase surface ONLY when BOTH gates are true —
--
--   • consent_to_public            — the GUEST consented to public sharing of
--                                    the clip they appear in / captured.
--   • couple_approved_for_showcase — the COUPLE picked this clip for the
--                                    public showcase orb.
--
-- Both default FALSE, so the orb cold-starts EMPTY (its CSS-gradient skin) and
-- stays empty until the first consented + approved clip lands — exactly the
-- locked behaviour. Additive + idempotent; no RLS change (these columns ride
-- papic_photos' existing policies — couple read/write via event membership,
-- admin full, the public showcase reads via the admin/service client like
-- every other anonymous recap surface).

ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS consent_to_public            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS couple_approved_for_showcase boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.papic_photos.consent_to_public IS
  'GUEST consent gate for the public Alaala showcase orb: TRUE once the guest who appears in / captured this clip has consented to public sharing. One of two gates (with couple_approved_for_showcase) — BOTH required before a clip surfaces on any public showcase surface. Defaults FALSE so the orb cold-starts empty.';

COMMENT ON COLUMN public.papic_photos.couple_approved_for_showcase IS
  'COUPLE approval gate for the public Alaala showcase orb: TRUE once the couple picks this clip for the showcase. One of two gates (with consent_to_public) — BOTH required before a clip surfaces on any public showcase surface. Defaults FALSE.';

-- Partial index for the orb feed: the showcase query asks for clips where both
-- gates are set, not hidden, NSFW-clean. A small partial index keeps that read
-- cheap even as the photo table grows (the predicate matches a tiny minority of
-- rows — only couple-curated, consented clips).
CREATE INDEX IF NOT EXISTS papic_photos_alaala_showcase_idx
  ON public.papic_photos (event_id, captured_at DESC)
  WHERE consent_to_public
    AND couple_approved_for_showcase
    AND photo_type = 'clip'
    AND hidden_at IS NULL;
