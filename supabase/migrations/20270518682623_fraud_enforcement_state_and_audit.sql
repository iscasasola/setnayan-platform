-- ============================================================================
-- 20270518682623_fraud_enforcement_state_and_audit.sql
-- Anti-Fraud & Trust Integrity — Phase 4: enforcement state + audit trail.
-- Spec: 03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md § 5 (Enforcement),
--       § 6 Phase 4.
--
-- RA 10173 fraud-prevention; service-role/admin only; counsel review pending.
--
-- OWNER-LOCKED TWO-STAGE ENFORCEMENT MODEL (§ 5, 2026-07-05):
--   • AUTO-SUSPEND (reversible, system-initiated) — at a HIGH-confidence fraud
--     score the runner SUSPENDS the vendor: hidden from the marketplace, badges
--     frozen, NO data destroyed. One admin action reverses it (false positive).
--   • PERMANENT WIPE + BAN (irreversible, ADMIN-confirmed ONLY, NEVER automated)
--     — a human admin confirms (routed through the two-admin approval gate) before
--     the vendor loses all data + is permanently banned. Appeal → help-center.
--
-- WHAT THIS BUILDS
--   1. vendor_profiles enforcement columns:
--        fraud_suspended_at  timestamptz  — set by the auto-suspend (reversible)
--        fraud_banned_at     timestamptz  — set by the admin-confirmed wipe+ban
--        fraud_tombstoned    boolean      — irreversible tombstone marker
--      A THREE-COLUMN state model (not a single enum) was chosen so the freeze
--      composes with the EXISTING `public_visibility` state machine: an
--      enforcement action ALSO flips public_visibility → 'hidden', which every
--      public read path already honors (isPubliclyVisible / marketplace query /
--      /v/[slug] 404), so the freeze needs ZERO cross-cutting query edits.
--      The fraud_* columns are the authoritative enforcement record + the
--      defense-in-depth gate the badge/stat inputs read.
--   2. voided_by_fraud flags on `vendor_reviews` + `event_vendors` so the ring's
--      reviews/events drop out of the vetted stat views (§ 5 "their reviews/events
--      are voided from every stat"). The two vetted views are recreated to add a
--      `voided_by_fraud = FALSE` predicate (everything else VERBATIM).
--   3. fraud_enforcement_audit TABLE — one row per enforcement action, with a
--      NON-mutating evidence snapshot JSONB. actor_user_id NULL = SYSTEM (the
--      auto-suspend). Admin/service-role RLS at CREATE.
--   4. approve_fraud_wipe_ban action_type on admin_approval_requests — the
--      irreversible wipe+ban routes THROUGH the existing two-admin (four-eyes)
--      gate. target_id carries the vendor_profile_id (TEXT, per the
--      approve_vendor_partnership precedent).
--
-- IDEMPOTENT. Migrations are FILES ONLY — CI (`supabase-migrations`) applies on
--   merge; do NOT run db push by hand. RLS at CREATE time.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_profiles enforcement columns.
--    All nullable / default-false so existing rows read as 'active' (no
--    suspension, no ban). The auto-suspend sets fraud_suspended_at; the
--    admin-confirmed wipe sets fraud_banned_at + fraud_tombstoned.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS fraud_suspended_at TIMESTAMPTZ;
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS fraud_banned_at TIMESTAMPTZ;
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS fraud_tombstoned BOOLEAN NOT NULL DEFAULT FALSE;

-- Hot path for the freeze/enforcement reads: the (usually empty) set of
-- suspended-or-banned vendors.
CREATE INDEX IF NOT EXISTS vendor_profiles_fraud_suspended_idx
  ON public.vendor_profiles(fraud_suspended_at)
  WHERE fraud_suspended_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendor_profiles_fraud_banned_idx
  ON public.vendor_profiles(fraud_banned_at)
  WHERE fraud_banned_at IS NOT NULL;

COMMENT ON COLUMN public.vendor_profiles.fraud_suspended_at IS
  'Anti-fraud § 5. Set by the SYSTEM auto-suspend at a HIGH-confidence fraud '
  'score (reversible, no data loss). NULL = not suspended. An enforcement action '
  'also flips public_visibility to hidden so every public read path freezes the '
  'vendor. Cleared on admin un-suspend / dismiss (false positive).';
COMMENT ON COLUMN public.vendor_profiles.fraud_banned_at IS
  'Anti-fraud § 5. Set ONLY by the ADMIN-confirmed wipe+ban (routed through the '
  'two-admin approval gate) — NEVER automated. Permanent. NULL = not banned.';
COMMENT ON COLUMN public.vendor_profiles.fraud_tombstoned IS
  'Anti-fraud § 5. TRUE once the irreversible admin-confirmed wipe has run '
  '(data voided, vendor permanently banned). Appeal routes to the help-center '
  'ticket queue (0029).';

-- ----------------------------------------------------------------------------
-- 2. voided_by_fraud flags on the two stat-source tables.
--    A confirmed wipe flags the ring's reviews + self-dealt events so they drop
--    out of the vetted views below. Soft-delete (a flag) NOT a hard DELETE, so
--    the evidence trail survives for appeal / counsel review.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_reviews
  ADD COLUMN IF NOT EXISTS voided_by_fraud BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS voided_by_fraud BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS vendor_reviews_voided_by_fraud_idx
  ON public.vendor_reviews(voided_by_fraud)
  WHERE voided_by_fraud = TRUE;
CREATE INDEX IF NOT EXISTS event_vendors_voided_by_fraud_idx
  ON public.event_vendors(voided_by_fraud)
  WHERE voided_by_fraud = TRUE;

COMMENT ON COLUMN public.vendor_reviews.voided_by_fraud IS
  'Anti-fraud § 5. TRUE = this review was voided by an admin-confirmed fraud '
  'wipe; it is EXCLUDED from vendor_trusted_review_stats (the vetted badge/stat '
  'input). Soft-delete for evidence retention.';
COMMENT ON COLUMN public.event_vendors.voided_by_fraud IS
  'Anti-fraud § 5. TRUE = this booking was voided by an admin-confirmed fraud '
  'wipe; it is EXCLUDED from vendor_public_completed_events_stats. Soft-delete '
  'for evidence retention.';

-- ----------------------------------------------------------------------------
-- 2a. Recreate vendor_trusted_review_stats to exclude voided reviews.
--     VERBATIM copy of 20270516500000 with ONE added predicate:
--       AND vr.voided_by_fraud = FALSE
--     Recreating (DROP + CREATE) keeps the definition self-contained; the
--     refresh trigger function still points at this matview by name.
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.vendor_trusted_review_stats;
CREATE MATERIALIZED VIEW public.vendor_trusted_review_stats AS
SELECT
  vp.vendor_profile_id,
  COALESCE(AVG(vr.rating_overall)::NUMERIC(3,2), 0) AS trusted_avg_rating,
  COUNT(vr.review_id)::INT AS trusted_review_count
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_reviews vr
       ON vr.vendor_profile_id = vp.vendor_profile_id
      AND vr.booked_through_setnayan = TRUE
      -- Anti-fraud Phase 4: voided reviews never count.
      AND vr.voided_by_fraud = FALSE
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.event_id = vr.event_id
          AND e.archived = FALSE
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        WHERE em.event_id = vr.event_id
          AND em.member_type = 'couple'
          AND em.user_id = vp.user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        JOIN public.vendor_team_members vtm
          ON vtm.user_id = em.user_id
         AND vtm.vendor_profile_id = vp.vendor_profile_id
        WHERE em.event_id = vr.event_id
          AND em.member_type = 'couple'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        JOIN public.users u ON u.user_id = em.user_id
        WHERE em.event_id = vr.event_id
          AND em.member_type = 'couple'
          AND u.is_internal = TRUE
          AND (
            u.user_id = vp.user_id
            OR EXISTS (
              SELECT 1 FROM public.vendor_team_members vtm2
              WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                AND vtm2.user_id = u.user_id
            )
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.comp_grants cg
        WHERE cg.vendor_profile_id = vp.vendor_profile_id
          AND cg.source = 'vendor_self_comp'
          AND (
            EXISTS (
              SELECT 1 FROM public.event_members em3
              WHERE em3.event_id = vr.event_id
                AND em3.member_type = 'couple'
                AND em3.user_id = cg.created_by_user_id
            )
          )
      )
GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_trusted_review_stats_vendor_profile_id_uidx
  ON public.vendor_trusted_review_stats(vendor_profile_id);

REFRESH MATERIALIZED VIEW public.vendor_trusted_review_stats;
GRANT SELECT ON public.vendor_trusted_review_stats TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2b. Recreate vendor_public_completed_events_stats to exclude voided events.
--     VERBATIM copy of 20260515020000 with ONE added predicate:
--       AND ev.voided_by_fraud = FALSE
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.vendor_public_completed_events_stats;
CREATE MATERIALIZED VIEW public.vendor_public_completed_events_stats AS
SELECT
  vp.vendor_profile_id,
  COUNT(ev.vendor_id)::INT AS public_completed_count
FROM public.vendor_profiles vp
LEFT JOIN public.event_vendors ev
       ON ev.linked_vendor_profile_id = vp.vendor_profile_id
      AND ev.status IN ('delivered', 'complete')
      -- Anti-fraud Phase 4: voided bookings never count.
      AND ev.voided_by_fraud = FALSE
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.event_id = ev.event_id
          AND e.archived = FALSE
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
          AND em.user_id = vp.user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        JOIN public.vendor_team_members vtm
          ON vtm.user_id = em.user_id
         AND vtm.vendor_profile_id = vp.vendor_profile_id
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        JOIN public.users u ON u.user_id = em.user_id
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
          AND u.is_internal = TRUE
          AND (
            u.user_id = vp.user_id
            OR EXISTS (
              SELECT 1 FROM public.vendor_team_members vtm2
              WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                AND vtm2.user_id = u.user_id
            )
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.comp_grants cg
        WHERE cg.vendor_profile_id = vp.vendor_profile_id
          AND cg.source = 'vendor_self_comp'
          AND (
            cg.order_id = ev.vendor_id
            OR EXISTS (
              SELECT 1 FROM public.event_members em3
              WHERE em3.event_id = ev.event_id
                AND em3.member_type = 'couple'
                AND em3.user_id = cg.created_by_user_id
            )
          )
      )
GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_public_completed_events_stats_pk
  ON public.vendor_public_completed_events_stats(vendor_profile_id);

REFRESH MATERIALIZED VIEW public.vendor_public_completed_events_stats;
GRANT SELECT ON public.vendor_public_completed_events_stats TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. fraud_enforcement_audit — one row per enforcement action.
--    actor_user_id NULL = SYSTEM (the auto-suspend). evidence_snapshot is a
--    NON-mutating capture of the fraud picture at action time (open signals +
--    scores + the counts/ids that triggered it) for the appeal / counsel trail.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fraud_enforcement_action') THEN
    CREATE TYPE public.fraud_enforcement_action AS ENUM (
      'auto_suspend',   -- SYSTEM: reversible suspend at HIGH score
      'unsuspend',      -- ADMIN: reverse an auto-suspend (signals kept)
      'dismiss',        -- ADMIN: signals cleared as false positive (+ unsuspend if suspended)
      'ban_wipe'        -- ADMIN-confirmed: irreversible wipe + permanent ban
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.fraud_enforcement_audit (
  id                 BIGSERIAL PRIMARY KEY,
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('E'),

  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  action             public.fraud_enforcement_action NOT NULL,

  -- NULL = system-initiated (the auto-suspend). Non-NULL = the admin who acted.
  actor_user_id      UUID REFERENCES public.users(user_id) ON DELETE SET NULL,

  reason             TEXT,
  -- Non-mutating snapshot of the fraud picture at action time (open signal types
  -- + scores + evidence, aggregate score, voided-row counts). NON-PII, mirroring
  -- fraud_signals.evidence discipline.
  evidence_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fraud_enforcement_audit_vendor_idx
  ON public.fraud_enforcement_audit(vendor_profile_id);
CREATE INDEX IF NOT EXISTS fraud_enforcement_audit_action_idx
  ON public.fraud_enforcement_audit(action);
CREATE INDEX IF NOT EXISTS fraud_enforcement_audit_created_idx
  ON public.fraud_enforcement_audit(created_at DESC);

ALTER TABLE public.fraud_enforcement_audit ENABLE ROW LEVEL SECURITY;

-- Admins read the enforcement trail. Writes are via the service-role admin
-- client (the runner's auto-suspend + the admin action handlers); RLS denies
-- INSERT/DELETE by default for authenticated/anon.
DROP POLICY IF EXISTS fraud_enforcement_audit_admin_read ON public.fraud_enforcement_audit;
CREATE POLICY fraud_enforcement_audit_admin_read ON public.fraud_enforcement_audit
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.fraud_enforcement_audit FROM anon, authenticated;
GRANT SELECT ON public.fraud_enforcement_audit TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.fraud_enforcement_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.fraud_enforcement_audit_id_seq TO service_role;

COMMENT ON TABLE public.fraud_enforcement_audit IS
  'RA 10173 fraud-prevention; service-role/admin only; counsel review pending. '
  'Phase-4 enforcement audit trail (§ 5): one row per auto_suspend / unsuspend / '
  'dismiss / ban_wipe action. actor_user_id NULL = SYSTEM (auto-suspend). '
  'evidence_snapshot is a NON-PII, non-mutating capture of the fraud picture at '
  'action time for the appeal / counsel trail. The irreversible ban_wipe is '
  'admin-confirmed (two-admin gate) — NEVER automated.';

-- ----------------------------------------------------------------------------
-- 4. Route the irreversible wipe+ban through the existing two-admin gate.
--    Extend admin_approval_requests.action_type with 'approve_fraud_wipe_ban'.
--    target_id (TEXT, added by 20270110320019) carries the vendor_profile_id —
--    the same non-user-target pattern approve_vendor_partnership uses.
-- ----------------------------------------------------------------------------

ALTER TABLE public.admin_approval_requests
  DROP CONSTRAINT IF EXISTS admin_approval_requests_action_type_check;

ALTER TABLE public.admin_approval_requests
  ADD CONSTRAINT admin_approval_requests_action_type_check
  CHECK (action_type IN (
    'grant_internal_account',
    'grant_team_pool',
    'promote_to_admin',
    'approve_vendor_partnership',
    'approve_fraud_wipe_ban'
  ));

COMMIT;
