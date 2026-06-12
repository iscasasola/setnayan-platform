-- ============================================================================
-- 20261130000000_social_sharing_program.sql
--
-- SOCIAL SHARING & FEATURING PROGRAM — schema substrate.
-- Canonical: corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md` +
-- DECISION_LOG 2026-06-12 row (owner-locked).
--
-- What the program is:
--   1. COUPLE CREATIONS — a couple opts in, PER ARTIFACT (monogram /
--      save-the-date / website / reel / LED design), to let Setnayan feature
--      that creation on its Facebook page AFTER their event. Credit is the
--      couple's choice: first names or anonymous. Consent is revocable any
--      time from Profile → Privacy & data; a revoke after posting queues a
--      take-down for the admin Social Queue (24-hour SLA).
--   2. VENDOR FEATURES — every newly verified vendor gets a celebration post
--      unless they opt out: UNNAMED category mention for Free tier, NAMED
--      feature for Pro+ (tiers sell reach — mirrors the hybrid-anonymity
--      doctrine, project_setnayan_vendor_hybrid_anonymity).
--   3. GREETINGS — optional birthday + wedding-anniversary greetings on the
--      public page, gated by a SEPARATE users.public_greeting_opt_in (email
--      greetings never need it).
--   All posting is MANUAL via the admin "Social queue" surface — no Facebook
--   API integration in V1, no crons ([[project_setnayan_cron_free]]).
--
-- Idempotent: IF NOT EXISTS / DROP POLICY IF EXISTS. RLS at CREATE TABLE time.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. users — optional birthday + PUBLIC greeting opt-in.
--    birth_date alone only powers email greetings (default behaviour);
--    PUBLIC Facebook greetings/anniversary posts require the separate
--    public_greeting_opt_in. Default FALSE per RA 10173 opt-in posture.
-- ----------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS public_greeting_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.birth_date IS
  'Optional birthday for greetings. On its own it only powers EMAIL greetings; public Facebook birthday/anniversary posts additionally require public_greeting_opt_in.';
COMMENT ON COLUMN public.users.public_greeting_opt_in IS
  'Separate opt-in for PUBLIC greetings (Facebook birthday + wedding-anniversary posts). Email greetings do not need this. Default FALSE (RA 10173 opt-in).';

-- ----------------------------------------------------------------------------
-- 2. vendor_profiles — verification-feature opt-out + posted bookkeeping.
--    social_featured_at/social_post_url are stamped by the admin Social Queue
--    "Mark posted" action so a vendor is only ever featured once.
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS social_feature_opt_out BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS social_featured_at TIMESTAMPTZ;
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS social_post_url TEXT;

COMMENT ON COLUMN public.vendor_profiles.social_feature_opt_out IS
  'Vendor ticked "don''t feature my business" — skip the verification celebration post. Self-serve on /vendor-dashboard/profile.';
COMMENT ON COLUMN public.vendor_profiles.social_featured_at IS
  'When the Setnayan team marked the verification feature as posted (admin Social Queue). NULL = not yet featured.';

-- ----------------------------------------------------------------------------
-- 3. marketing_share_consents — one row per couple-granted artifact consent.
--    Revoke = revoked_at status-flip, never hard-delete (audit trail + the
--    take-down queue needs the posted_at/post_url evidence to act on).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_share_consents (
  consent_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL
                 REFERENCES public.events(event_id) ON DELETE CASCADE,
  customer_id    UUID NOT NULL
                 REFERENCES public.users(user_id) ON DELETE CASCADE,
  artifact_type  TEXT NOT NULL
                 CHECK (artifact_type IN
                   ('monogram', 'save_the_date', 'website', 'reel', 'led_design')),
  -- Free-form pointer at WHICH artifact (e.g. a bespoke generation id or a
  -- template slug). '' = the event's singular artifact of that type.
  artifact_ref   TEXT NOT NULL DEFAULT '',
  credit_mode    TEXT NOT NULL DEFAULT 'first_names'
                 CHECK (credit_mode IN ('first_names', 'anonymous')),
  consented_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at     TIMESTAMPTZ,
  posted_at      TIMESTAMPTZ,
  post_url       TEXT,
  taken_down_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The publish gate is APP-SIDE on purpose: a consent row is postable only
-- once `events.event_date + 7 days` has passed (no review-window column
-- exists; the 7-day buffer mirrors the gallery review-window doctrine) — and
-- NEVER before the event (spoilers + empty-house safety). See
-- apps/web/lib/social-sharing.ts shareConsentPublishGatePassed().
COMMENT ON TABLE public.marketing_share_consents IS
  'Couple-granted, per-artifact consent for Setnayan to feature a creation on its Facebook page. Publish gate is APP-SIDE: postable only after events.event_date + 7 days (7-day buffer mirrors the gallery review window) — never before the event. Revoke = revoked_at flip; a revoke after posted_at queues a take-down (24h SLA) in the admin Social Queue.';

-- One LIVE consent per (event, artifact_type, artifact_ref) — re-granting
-- after a revoke creates a fresh row; the app upserts credit_mode onto the
-- live row instead of tripping this index.
CREATE UNIQUE INDEX IF NOT EXISTS marketing_share_consents_live_unique
  ON public.marketing_share_consents (event_id, artifact_type, artifact_ref)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS marketing_share_consents_event_id_idx
  ON public.marketing_share_consents(event_id);

ALTER TABLE public.marketing_share_consents ENABLE ROW LEVEL SECURITY;

-- Couple manages their own events' consents (grant / re-credit / revoke).
DROP POLICY IF EXISTS marketing_share_consents_couple ON public.marketing_share_consents;
CREATE POLICY marketing_share_consents_couple
  ON public.marketing_share_consents FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- Admin (Setnayan Team) — Social Queue reads + posted/taken-down stamps.
DROP POLICY IF EXISTS marketing_share_consents_admin ON public.marketing_share_consents;
CREATE POLICY marketing_share_consents_admin
  ON public.marketing_share_consents FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
