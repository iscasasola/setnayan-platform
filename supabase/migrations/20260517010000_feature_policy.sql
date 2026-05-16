-- ============================================================================
-- Feature Policy — admin gate per-account-type for each Setnayan add-on.
--
-- Mirrors the per-account-type policy primitive already locked for payment
-- methods (decision log 2026-05-17 "Payment Options Policy Matrix") and
-- extends it to features (add-ons + vendor services). Drives the
-- "Blocked" hero-CTA state on the App Store-style detail page; an admin
-- can block a feature wholesale for couples / vendors / certified vendors,
-- or override per-event for VIP / dispute / force-majeure cases.
--
-- V1 ships with no admin UI — admins manage via direct DB until the 0023
-- console grows a Feature Policy panel. The schema is V1-deployable now
-- so the state resolver can read it.
--
-- Idempotent: re-runnable without drops on existing data. RLS DROP-then-
-- CREATE. Seed uses ON CONFLICT DO NOTHING so the migration is safe to
-- re-run after the add-on launcher gains new features.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. feature_policy — per-feature account-type matrix
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.feature_policy (
  feature_key                       TEXT PRIMARY KEY
    CHECK (length(feature_key) BETWEEN 1 AND 64),
  enabled_for_couples               BOOLEAN NOT NULL DEFAULT TRUE,
  enabled_for_vendors_coming_soon   BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_for_vendors_certified     BOOLEAN NOT NULL DEFAULT TRUE,
  -- Optional admin-facing copy explaining why a feature is disabled at the
  -- account-type level (shown in tooltip + tickets). Plain text only.
  block_reason_couples              TEXT,
  block_reason_vendors_coming_soon  TEXT,
  block_reason_vendors_certified    TEXT,
  -- Audit trail.
  updated_by_admin_id               UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feature_policy ENABLE ROW LEVEL SECURITY;

-- Public read — every signed-in user reads the policy to render the right
-- hero-CTA state on the detail page (anon read is fine; the state itself
-- doesn't leak event-level data).
DROP POLICY IF EXISTS feature_policy_public_read ON public.feature_policy;
CREATE POLICY feature_policy_public_read
  ON public.feature_policy FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Admin-only write. is_admin() is the canonical helper (see 20260512000000_setnayan_base).
DROP POLICY IF EXISTS feature_policy_admin_write ON public.feature_policy;
CREATE POLICY feature_policy_admin_write
  ON public.feature_policy FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.tg_feature_policy_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_policy_set_updated_at ON public.feature_policy;
CREATE TRIGGER feature_policy_set_updated_at
  BEFORE UPDATE ON public.feature_policy
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_feature_policy_set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. event_feature_policy_override — per-event admin override
--
-- Lets an admin block (or unblock) a specific feature for a specific event
-- without changing the account-type default. Resolution at read-time:
--   per-event override (if any) → fall back to account-type default.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_feature_policy_override (
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  feature_key         TEXT NOT NULL
    REFERENCES public.feature_policy(feature_key) ON DELETE CASCADE
    ON UPDATE CASCADE,
  enabled             BOOLEAN NOT NULL,
  reason              TEXT,
  set_by_admin_id     UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  set_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, feature_key)
);

CREATE INDEX IF NOT EXISTS event_feature_policy_override_event_idx
  ON public.event_feature_policy_override(event_id);
CREATE INDEX IF NOT EXISTS event_feature_policy_override_feature_idx
  ON public.event_feature_policy_override(feature_key);

ALTER TABLE public.event_feature_policy_override ENABLE ROW LEVEL SECURITY;

-- Couples + admins can read the override that applies to their own event;
-- couples need this to render the state on their detail page. Other
-- couples should not be able to fish for other events' override state.
DROP POLICY IF EXISTS event_feature_policy_override_read ON public.event_feature_policy_override;
CREATE POLICY event_feature_policy_override_read
  ON public.event_feature_policy_override FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR event_id IN (SELECT public.current_event_ids())
  );

DROP POLICY IF EXISTS event_feature_policy_override_admin_write ON public.event_feature_policy_override;
CREATE POLICY event_feature_policy_override_admin_write
  ON public.event_feature_policy_override FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. Seed — every key in the add-ons launcher manifest enabled-by-default
--   for couples. Keep in sync with apps/web/app/dashboard/[eventId]/add-ons/page.tsx.
-- ----------------------------------------------------------------------------

INSERT INTO public.feature_policy
  (feature_key, enabled_for_couples, enabled_for_vendors_coming_soon, enabled_for_vendors_certified)
VALUES
  ('panood',                TRUE,  FALSE, TRUE),
  ('papic',                 TRUE,  FALSE, TRUE),
  ('mood-board',            TRUE,  FALSE, TRUE),
  ('save-the-date',         TRUE,  FALSE, TRUE),
  ('led',                   TRUE,  FALSE, TRUE),
  ('patiktok',              TRUE,  FALSE, TRUE),
  ('photo-delivery',        TRUE,  FALSE, TRUE),
  ('supplies-marketplace',  TRUE,  FALSE, TRUE),
  ('orders',                TRUE,  TRUE,  TRUE)
ON CONFLICT (feature_key) DO NOTHING;

COMMIT;
