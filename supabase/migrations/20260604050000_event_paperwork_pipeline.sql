-- ============================================================================
-- 20260604050000_event_paperwork_pipeline.sql
--
-- Paperwork pipeline tracking — PSA + CENOMAR + Marriage License + Pre-Cana +
-- parish docs + Sharia / CFO / INC counseling certificates.
--
-- Per CLAUDE.md 2026-05-22 owner directive: the single most-anxiety-inducing
-- pre-wedding workflow in PH is government paperwork. Universal Filipino
-- stress. Owning this turns Setnayan from "vendor coordination tool" to
-- "wedding-readiness command center."
--
-- Document set varies by events.ceremony_type:
--   • Catholic — PSA Birth (x2), CENOMAR (x2), Marriage License, Pre-Cana,
--     Baptismal (x2), Confirmation (x2), Banns, Canonical Interview
--   • Civil    — PSA Birth (x2), CENOMAR (x2), Marriage License,
--                CFO Counseling (if either party is OFW)
--   • INC      — PSA Birth (x2), CENOMAR (x2), Marriage License,
--                INC Counseling
--   • Muslim   — PSA Birth (x2), CENOMAR (x2), Marriage License,
--                Sharia Counseling (Code of Muslim Personal Laws)
--   • Christian / Cultural / Mixed — base PSA Birth (x2) + CENOMAR (x2)
--                + Marriage License; parish/community docs vary and are
--                added as the seed grows.
--
-- Schema invariants:
--   • One row per (event, document_type). Hosts toggling between document
--     types pre-seed gets ON CONFLICT DO NOTHING via the UNIQUE constraint.
--   • status defaults to 'not_started'. Hosts move it forward through
--     'requested' → 'in_processing' → 'received'. 'expired' is for the
--     marriage license 120-day window once it lapses.
--   • expected_completion_date and expires_at are derived at row write
--     time by the server action (not in the DB) — the server action
--     reads events.event_date + 2026-05-22 PH paperwork conventions to
--     compute them so the math lives in code where it can evolve.
--   • document_r2_key stores the `r2://setnayan-vendor-contracts/...`
--     reference per the existing lib/uploads.ts convention. Reusing the
--     vendor-contracts bucket: paperwork is the same shape of artifact —
--     official documents stored on behalf of the host, 25 MB cap, PDF +
--     image MIME types, RLS by event_id. No new bucket needed.
--
-- RLS posture:
--   • Hosts (event_moderators) can read + write + delete their event's
--     paperwork rows. Mirrors the budget table pattern in
--     20260518100000_event_vendor_line_items.sql — host has full agency
--     over their own paperwork, no admin gating.
--   • Admins (users.is_internal=TRUE per § 10a) can read all rows for
--     support escalation. Write access is host-only.
--   • Anonymous: zero access. Government paperwork is private to the
--     wedding household; even Public Event Summary at T+30d (per 0002
--     Phase 4 + RA 10173 safe-harbor guardrails) never surfaces these.
--
-- Forward compatibility:
--   • Reversible: DROP TABLE public.event_paperwork; the seed function
--     re-runs idempotently per its own ON CONFLICT clause.
--   • CHECK constraint on document_type is the only enum-shaped surface.
--     Adding a new document type (e.g., for V1.2 ceremony types) requires
--     dropping + recreating the CHECK — standard Postgres pattern.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. event_paperwork table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_paperwork (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                    UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  document_type               TEXT NOT NULL CHECK (document_type IN (
    -- PSA documents (every ceremony type)
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    -- LGU
    'marriage_license',
    -- Catholic-specific
    'pre_cana_certificate',
    'baptismal_cert_partner_1',
    'baptismal_cert_partner_2',
    'confirmation_cert_partner_1',
    'confirmation_cert_partner_2',
    'banns_posted',
    'canonical_interview_complete',
    -- INC-specific
    'inc_counseling_complete',
    -- Muslim-specific
    'sharia_counseling_complete',
    -- Civil + OFW
    'cfo_counseling_complete'
  )),
  status                      TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started',
    'requested',
    'in_processing',
    'received',
    'expired'
  )),
  requested_at                TIMESTAMPTZ,
  received_at                 TIMESTAMPTZ,
  expected_completion_date    DATE,
  -- Marriage license carries a 120-day validity from issuance. Other rows
  -- leave this NULL. UI surfaces the expiry as a warning when within 30
  -- days of expiring + a sunset chip once expired.
  expires_at                  DATE,
  -- PSA online portal tracking reference (StraightHome / e-Census etc.)
  tracking_reference          TEXT,
  -- r2://setnayan-vendor-contracts/paperwork/{event_id}/{document_type}/...
  document_r2_key             TEXT,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, document_type)
);

CREATE INDEX IF NOT EXISTS event_paperwork_event_idx
  ON public.event_paperwork(event_id);

CREATE INDEX IF NOT EXISTS event_paperwork_status_idx
  ON public.event_paperwork(event_id, status);

COMMENT ON TABLE public.event_paperwork IS
  'Government + parish paperwork tracking for the wedding (PSA, CENOMAR, marriage license, pre-Cana, etc.). Per CLAUDE.md 2026-05-22 owner directive — Filipino paperwork is the single most-anxiety-inducing pre-wedding workflow. Seeded by document_type from events.ceremony_type; host updates status + uploads scans. RLS scoped via event_moderators.';

COMMENT ON COLUMN public.event_paperwork.expected_completion_date IS
  'Computed at write time from events.event_date by the server action — not a DB-managed field. UI uses it to surface "request by" / "complete by" deadlines.';

COMMENT ON COLUMN public.event_paperwork.expires_at IS
  'Marriage license 120-day validity (NULL for everything else). Once received_at is stamped on the marriage_license row, expires_at = received_at + 120 days. UI shows amber warning at 30 days remaining + sunset chip past expiry.';

COMMENT ON COLUMN public.event_paperwork.document_r2_key IS
  'r2://setnayan-vendor-contracts/paperwork/{event_id}/{document_type}/{uuid}-{filename} per lib/uploads.ts. Reuses vendor-contracts bucket: paperwork is the same artifact shape (PDF/image, ≤25MB, RLS by event_id). No separate bucket needed.';

-- ----------------------------------------------------------------------------
-- 2. updated_at trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_event_paperwork_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_paperwork_updated_at_trigger ON public.event_paperwork;
CREATE TRIGGER event_paperwork_updated_at_trigger
  BEFORE UPDATE ON public.event_paperwork
  FOR EACH ROW EXECUTE FUNCTION public.set_event_paperwork_updated_at();

-- ----------------------------------------------------------------------------
-- 3. RLS policies — host-only writes, host + internal-admin reads
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_paperwork ENABLE ROW LEVEL SECURITY;

-- Host can SELECT + INSERT + UPDATE + DELETE rows on their own event. The
-- predicate matches event_moderators where the row is still active (not
-- removed). Mirrors the event_moderators host scoping pattern used in
-- 0048 foundation + budget line items.
DROP POLICY IF EXISTS event_paperwork_host_select ON public.event_paperwork;
CREATE POLICY event_paperwork_host_select ON public.event_paperwork
  FOR SELECT
  USING (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid() AND removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS event_paperwork_host_insert ON public.event_paperwork;
CREATE POLICY event_paperwork_host_insert ON public.event_paperwork
  FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid() AND removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS event_paperwork_host_update ON public.event_paperwork;
CREATE POLICY event_paperwork_host_update ON public.event_paperwork
  FOR UPDATE
  USING (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid() AND removed_at IS NULL
    )
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid() AND removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS event_paperwork_host_delete ON public.event_paperwork;
CREATE POLICY event_paperwork_host_delete ON public.event_paperwork
  FOR DELETE
  USING (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid() AND removed_at IS NULL
    )
  );

-- Internal admin read — for support escalation. Mirrors the existing
-- is_internal pattern from § 10a (users.is_internal=TRUE). Admin writes
-- intentionally NOT granted; if support needs to fix data they go through
-- the host (or use a service-role admin tool).
DROP POLICY IF EXISTS event_paperwork_admin_select ON public.event_paperwork;
CREATE POLICY event_paperwork_admin_select ON public.event_paperwork
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid() AND u.is_internal = TRUE
    )
  );

COMMIT;
