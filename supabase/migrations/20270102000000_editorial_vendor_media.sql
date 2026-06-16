-- ============================================================================
-- 20270102000000_editorial_vendor_media.sql
-- "From Your Vendors" — day-of media the couple's RECOMMENDED vendor submits
-- for the editorial (iteration 0046, owner-locked 2026-06-16).
--
-- A vendor who is the couple's RECOMMENDED / first-pick for a category on an
-- event (event_vendors.selection_match_rank = 1) may submit up to 3 photos +
-- up to 3 five-second clips of their day-of service. The media AUTO-SHOWS on
-- the couple's editorial once it clears the NSFW screen; the couple can HIDE
-- any item. CLIPS are stored as pre-baked forward+reverse BOOMERANGS (the
-- editorial video rule) — never the raw source. The 3-each cap + the
-- recommended-pick eligibility gate are enforced in the submit server action;
-- this table + RLS are the storage foundation.
--
-- RLS-at-create (8-pattern canon — mirrors event_preparation_items 20260729):
--   • Couple — Pattern B (current_couple_event_ids): SELECT + UPDATE on their
--     own event's media (UPDATE is how they HIDE an item via hidden_by_couple).
--     No couple INSERT/DELETE — the vendor owns the submission; the couple
--     curates by hiding, an admin removes.
--   • Vendor — Pattern E (current_vendor_ids + accepted-thread gate): SELECT
--     their own rows or rows on events they're booked on; INSERT only for
--     events they hold an ACCEPTED chat_threads row on, stamping their own
--     vendor_profile_id; UPDATE/DELETE only their OWN rows (withdraw a
--     submission). The recommended-PICK gate (selection_match_rank = 1) is the
--     server action's job, on top of this booked-baseline.
--   • Admin — full (is_admin): moderation override + takedown.
--   The PUBLIC editorial render reads via the service-role admin client
--   (data.ts), filtered to moderation-clean + not-hidden + still-recommended.
--
-- Verified against live schema before writing (4-reader trace 2026-06-16):
--   • events(event_id)                   — UUID UNIQUE FK target (20260512000000)
--   • vendor_profiles(vendor_profile_id) — UUID PK            (20260513120000)
--   • event_vendors(vendor_id)           — UUID PK; selection_match_rank INT,
--       1 = recommended/#1 match         (20260513100000 + 20260912000000)
--   • users(user_id)                     — UUID PK            (20260512000000)
--   • current_couple_event_ids()         — GRANTed authenticated (20260513040000)
--   • current_vendor_ids()               — GRANTed authenticated (20260512000000)
--   • generate_public_id(letter)         — S89<L>-<10> ids    (20260512000000)
--   • moderation_state value-set         — matches papic capture screen
--       ('unscreened'|'clean'|'nsfw_blocked'|'consent_withheld'|'faceblock_withheld')
--
-- Additive only. Idempotent. Owner pushes (do NOT auto-push). Code
-- graceful-degrades: data.ts catches 42P01 and renders [] until this lands.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.editorial_vendor_media (
  media_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id         TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('M'),
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The recommended-pick plan row that carries the gate. SET NULL (not CASCADE)
  -- so a re-plan doesn't vaporise already-submitted media; the render re-checks
  -- selection_match_rank live and hides it if the pick changed.
  event_vendor_id   UUID REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL,
  media_type        TEXT NOT NULL CHECK (media_type IN ('photo', 'clip')),
  -- Clips store the BAKED forward+reverse boomerang MP4 (never the raw source).
  boomerang_r2_key  TEXT,
  -- The still: a photo itself, OR a clip's freeze-frame (poster + NSFW proxy).
  -- Always present — nsfwjs is image-only, so this JPEG screens both types.
  still_r2_key      TEXT NOT NULL,
  caption           TEXT CHECK (caption IS NULL OR length(caption) <= 140),
  sort_order        INT NOT NULL DEFAULT 0,
  moderation_state  TEXT NOT NULL DEFAULT 'unscreened'
                      CHECK (moderation_state IN (
                        'unscreened', 'clean', 'nsfw_blocked',
                        'consent_withheld', 'faceblock_withheld'
                      )),
  hidden_by_couple  BOOLEAN NOT NULL DEFAULT FALSE,
  created_by        UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A clip MUST carry its baked boomerang; a photo never does.
  CONSTRAINT editorial_vendor_media_clip_has_boomerang
    CHECK (media_type <> 'clip' OR boomerang_r2_key IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS editorial_vendor_media_event_idx
  ON public.editorial_vendor_media(event_id);
CREATE INDEX IF NOT EXISTS editorial_vendor_media_vendor_idx
  ON public.editorial_vendor_media(vendor_profile_id);
CREATE INDEX IF NOT EXISTS editorial_vendor_media_event_vendor_idx
  ON public.editorial_vendor_media(event_vendor_id);

ALTER TABLE public.editorial_vendor_media ENABLE ROW LEVEL SECURITY;

-- Couple: SELECT + UPDATE (hide via hidden_by_couple) on their own event's media.
DROP POLICY IF EXISTS editorial_vendor_media_couple_read ON public.editorial_vendor_media;
CREATE POLICY editorial_vendor_media_couple_read ON public.editorial_vendor_media
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));
DROP POLICY IF EXISTS editorial_vendor_media_couple_update ON public.editorial_vendor_media;
CREATE POLICY editorial_vendor_media_couple_update ON public.editorial_vendor_media
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- Vendor: SELECT their own rows, or rows on events they're booked on.
DROP POLICY IF EXISTS editorial_vendor_media_vendor_read ON public.editorial_vendor_media;
CREATE POLICY editorial_vendor_media_vendor_read ON public.editorial_vendor_media
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR event_id IN (
      SELECT event_id FROM public.chat_threads
      WHERE vendor_profile_id IN (SELECT public.current_vendor_ids())
        AND inquiry_status = 'accepted'
    )
  );

-- Vendor: INSERT only for events they hold an ACCEPTED thread on, stamping
-- their own vendor_profile_id. (Recommended-pick gate is enforced in the action.)
DROP POLICY IF EXISTS editorial_vendor_media_vendor_insert ON public.editorial_vendor_media;
CREATE POLICY editorial_vendor_media_vendor_insert ON public.editorial_vendor_media
  FOR INSERT TO authenticated
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    AND event_id IN (
      SELECT event_id FROM public.chat_threads
      WHERE vendor_profile_id IN (SELECT public.current_vendor_ids())
        AND inquiry_status = 'accepted'
    )
  );

-- Vendor: UPDATE/DELETE only their OWN submissions (withdraw / re-caption).
DROP POLICY IF EXISTS editorial_vendor_media_vendor_update ON public.editorial_vendor_media;
CREATE POLICY editorial_vendor_media_vendor_update ON public.editorial_vendor_media
  FOR UPDATE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_ids()));
DROP POLICY IF EXISTS editorial_vendor_media_vendor_delete ON public.editorial_vendor_media;
CREATE POLICY editorial_vendor_media_vendor_delete ON public.editorial_vendor_media
  FOR DELETE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids()));

-- Admin: full control (moderation override + takedown).
DROP POLICY IF EXISTS editorial_vendor_media_admin_all ON public.editorial_vendor_media;
CREATE POLICY editorial_vendor_media_admin_all ON public.editorial_vendor_media
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
