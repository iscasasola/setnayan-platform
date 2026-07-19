-- ============================================================================
-- 20270517644717_fraud_signals_detection_engine.sql
-- Anti-Fraud & Trust Integrity — Phase 3: the detection engine store.
-- Spec: 03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md § 4 (Detection),
--       § 6 Phase 3.
--
-- RA 10173 fraud-prevention; service-role/admin only; counsel review pending.
--
-- WHAT THIS BUILDS
--   1. `fraud_signals` TABLE — one row per (vendor_profile, signal_type,
--      window_start). Persists the SCORED output of the five vendor-level
--      anomaly detectors in lib/fraud-detection.ts:
--        ring · velocity · graph_isolation · import_spike · rating_shape.
--      Each row carries a 0..100 `score`, a non-PII `evidence` JSONB (the
--      counts/ids that triggered it), the scoring `window_*` bounds, and a
--      `status` (open/dismissed/actioned) the Phase-4 admin queue mutates.
--      UNIQUE (vendor_profile_id, signal_type, window_start) so re-runs UPSERT
--      in place instead of stacking duplicates.
--   2. `vendor_fraud_scores` MATERIALIZED VIEW — per-vendor aggregate over the
--      vendor's OPEN signals: the max single score, the summed score, and the
--      open-signal count. The Phase-4 queue sorts the vendor list by this.
--
-- SCOPE LOCK: this phase DETECTS + SCORES ONLY. Nothing here suspends, bans, or
--   mutates a vendor. Enforcement (auto-suspend + admin-confirmed wipe) is
--   Phase 4 and reads `status` / `vendor_fraud_scores`; it is NOT in this file.
--
-- DISTINCT FROM `integrity_flags` (20270412000042): that table is the
--   per-REVIEW / per-LISTING moderation queue (review_fraud + ghost_listing,
--   one row per suspected review). `fraud_signals` is the per-VENDOR anomaly
--   store — a different grain (vendor × signal_type × window), the five
--   vendor-level detectors the spec § 4 names. They coexist; neither replaces
--   the other.
--
-- PRIVACY (RA 10173): `evidence` JSONB carries only NON-PII derived evidence —
--   counts, ratios, small integer tallies, opaque cluster labels, and booleans.
--   NO device hashes, NO IPs, NO normalized addresses, NO payment senders, NO
--   review bodies, NO couple names. The detectors read PERSONAL data (via the
--   Phase-2 identity_clusters + users/reviews) purely to derive these tallies.
--
-- RLS at CREATE time. SERVICE-ROLE + ADMIN ONLY — NO anon, NO authenticated
--   SELECT/INSERT/UPDATE/DELETE. A vendor must never learn it is being scored.
--
-- IDEMPOTENT. Migrations are FILES ONLY — CI (`supabase-migrations`) applies on
--   merge; do NOT run db push by hand.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. fraud_signal_type — the five vendor-level anomaly kinds (§ 4).
--    Enum (not a free-form CHECK) so the scorer + queue share one closed set.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fraud_signal_type') THEN
    CREATE TYPE public.fraud_signal_type AS ENUM (
      'ring',              -- reviews/events concentrated in few identity clusters
      'velocity',          -- burst of brand-new accounts reviewing one vendor
      'graph_isolation',   -- reviewing couples with no organic footprint
      'import_spike',      -- self-imported events w/ no payment + no arm's-length couple
      'rating_shape'       -- degenerate all-5star distribution, no 1-4star tail
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fraud_signal_status') THEN
    CREATE TYPE public.fraud_signal_status AS ENUM (
      'open',        -- freshly scored, awaiting P4 review
      'dismissed',   -- admin cleared it (false positive)
      'actioned'     -- admin acted on it (fed the P4 enforcement decision)
    );
  END IF;
END$$;

-- ----------------------------------------------------------------------------
-- 1. fraud_signals — one row per (vendor, signal_type, window_start).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fraud_signals (
  id                 BIGSERIAL PRIMARY KEY,
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('F'),

  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  signal_type        public.fraud_signal_type NOT NULL,

  -- Deterministic 0..100 suspicion score (higher = more suspicious).
  score              SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  -- Non-PII evidence: the counts/ratios/opaque cluster labels/booleans that
  -- triggered the signal. NEVER device hashes / IPs / addresses / payment
  -- senders / review bodies / couple names.
  evidence           JSONB NOT NULL DEFAULT '{}'::jsonb,

  detected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The scoring window this signal covers (used for the UPSERT identity + the
  -- P4 evidence trail). window_start is part of the dedup key.
  window_start       TIMESTAMPTZ NOT NULL,
  window_end         TIMESTAMPTZ NOT NULL,

  status             public.fraud_signal_status NOT NULL DEFAULT 'open',
  resolution_notes   TEXT,
  reviewed_by        UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (window_end >= window_start),

  -- Re-runs UPSERT in place: one signal per (vendor, type, window_start).
  CONSTRAINT fraud_signals_vendor_type_window_uniq
    UNIQUE (vendor_profile_id, signal_type, window_start)
);

CREATE INDEX IF NOT EXISTS fraud_signals_vendor_idx
  ON public.fraud_signals(vendor_profile_id);
CREATE INDEX IF NOT EXISTS fraud_signals_type_idx
  ON public.fraud_signals(signal_type);
CREATE INDEX IF NOT EXISTS fraud_signals_status_idx
  ON public.fraud_signals(status);
-- Hot path for the P4 queue: open signals sorted by score.
CREATE INDEX IF NOT EXISTS fraud_signals_open_score_idx
  ON public.fraud_signals(score DESC)
  WHERE status = 'open';

ALTER TABLE public.fraud_signals ENABLE ROW LEVEL SECURITY;

-- Admins read the whole store (the P4 queue). The scorer + full-pass write with
-- the service-role admin client, which BYPASSES RLS.
DROP POLICY IF EXISTS fraud_signals_admin_read ON public.fraud_signals;
CREATE POLICY fraud_signals_admin_read ON public.fraud_signals
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins resolve signals (dismiss / action) from the P4 queue.
DROP POLICY IF EXISTS fraud_signals_admin_update ON public.fraud_signals;
CREATE POLICY fraud_signals_admin_update ON public.fraud_signals
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NO INSERT/DELETE policy for authenticated/anon: RLS denies by default. Every
-- write is via the service-role admin client (the scorer's after() task + the
-- full-pass + the admin "run now"). HONEST NOTE (mirrors integrity_flags): the
-- deny-by-default protects vendors/couples from touching the table, but the
-- real write guard is application-level — only fraud-detection.ts constructs
-- that client.

-- Belt-and-suspenders: revoke any default grants from anon/authenticated so no
-- session can read the store even if a policy is later loosened by mistake.
REVOKE ALL ON public.fraud_signals FROM anon, authenticated;
GRANT SELECT ON public.fraud_signals TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.fraud_signals TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.fraud_signals_id_seq TO service_role;

COMMENT ON TABLE public.fraud_signals IS
  'RA 10173 fraud-prevention; service-role/admin only; counsel review pending. '
  'Phase-3 per-vendor anomaly store: one row per (vendor_profile_id, signal_type, '
  'window_start) for the five detectors in lib/fraud-detection.ts (ring / velocity '
  '/ graph_isolation / import_spike / rating_shape). DETECT + SCORE ONLY — never '
  'suspends/bans/mutates a vendor (that is Phase 4, which reads status + '
  'vendor_fraud_scores). Distinct from integrity_flags (per-review/per-listing). '
  'evidence JSONB carries only non-PII counts/ratios/opaque-cluster-labels/booleans '
  '— no device hashes, IPs, addresses, payment senders, bodies, or names.';

COMMENT ON COLUMN public.fraud_signals.evidence IS
  'Non-PII per-signal breakdown (counts, ratios, opaque cluster labels, booleans, '
  'component scores). NEVER device hashes, IPs, addresses, payment senders, review '
  'bodies, or reviewer names.';

-- Keep updated_at fresh on admin resolution writes (mirrors sibling tables).
CREATE OR REPLACE FUNCTION public.touch_fraud_signals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fraud_signals_touch_updated_at ON public.fraud_signals;
CREATE TRIGGER fraud_signals_touch_updated_at
  BEFORE UPDATE ON public.fraud_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_fraud_signals_updated_at();

-- ----------------------------------------------------------------------------
-- 2. vendor_fraud_scores — per-vendor aggregate over OPEN signals.
--
--    The Phase-4 admin queue sorts the vendor list by fraud exposure. We expose
--    three aggregates over the vendor's OPEN signals so the queue can sort by
--    the most useful one:
--      • max_open_score  — the single worst signal (the headline severity).
--      • sum_open_score  — total across open signals (a vendor tripping many
--                          detectors ranks above one tripping a single strong
--                          one at equal max), clamped to 100 for a stable bar.
--      • open_signal_count — how many distinct open signals fired.
--    Only vendors with >= 1 open signal appear (INNER-grained). A vendor with
--    no open signals is simply absent — the queue treats absence as score 0.
--
--    Materialized (not a plain view) so the queue read is a cheap index scan;
--    refreshed by refresh_vendor_fraud_scores() after a scoring pass.
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.vendor_fraud_scores;
CREATE MATERIALIZED VIEW public.vendor_fraud_scores AS
SELECT
  fs.vendor_profile_id,
  MAX(fs.score)::SMALLINT                              AS max_open_score,
  LEAST(SUM(fs.score), 100)::SMALLINT                  AS sum_open_score,
  COUNT(*)::INT                                        AS open_signal_count,
  ARRAY_AGG(DISTINCT fs.signal_type::TEXT ORDER BY fs.signal_type::TEXT)
                                                       AS open_signal_types,
  MAX(fs.detected_at)                                  AS latest_detected_at
FROM public.fraud_signals fs
WHERE fs.status = 'open'
GROUP BY fs.vendor_profile_id;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_fraud_scores_vendor_uidx
  ON public.vendor_fraud_scores(vendor_profile_id);
-- Sort key for the P4 queue.
CREATE INDEX IF NOT EXISTS vendor_fraud_scores_max_idx
  ON public.vendor_fraud_scores(max_open_score DESC);

REFRESH MATERIALIZED VIEW public.vendor_fraud_scores;

REVOKE ALL ON public.vendor_fraud_scores FROM anon, authenticated;
GRANT SELECT ON public.vendor_fraud_scores TO service_role;

COMMENT ON MATERIALIZED VIEW public.vendor_fraud_scores IS
  'RA 10173 fraud-prevention; service-role/admin only; counsel review pending. '
  'Per-vendor aggregate over OPEN fraud_signals: max_open_score (headline severity), '
  'sum_open_score (clamped 100), open_signal_count, open_signal_types[]. The Phase-4 '
  'admin queue sorts vendors by this. Vendors with no open signal are absent (= 0). '
  'DETECT/SCORE ONLY — no enforcement here.';

-- ----------------------------------------------------------------------------
-- 3. refresh_vendor_fraud_scores() — service-role refresh entry point.
--    Fail-soft: a failing refresh never propagates. CONCURRENTLY keeps reads
--    non-blocking (the unique index above enables it). The scoring lib calls
--    this after a pass; not trigger-wired (scoring is out-of-band).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_vendor_fraud_scores()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_fraud_scores;
EXCEPTION WHEN OTHERS THEN
  -- CONCURRENTLY fails on an empty matview with no prior rows; fall back to a
  -- plain refresh, and never let a refresh error propagate to the caller.
  BEGIN
    REFRESH MATERIALIZED VIEW public.vendor_fraud_scores;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refresh_vendor_fraud_scores failed: %', SQLERRM;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_vendor_fraud_scores() TO service_role;

COMMIT;
