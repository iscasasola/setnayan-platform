-- ============================================================================
-- Anonymous-draft onboarding · durable per-IP mint throttle
-- (anon-onboarding hardening PR-2 · 2026-07-18)
-- ============================================================================
--
-- WHY: with NEXT_PUBLIC_ANON_ONBOARDING_ENABLED on, the onboarding commit mints
-- a Supabase NATIVE anonymous session — a real account + event created from
-- nothing. The only bot gate is Supabase's global captcha switch, and the
-- commit is a plain server-action POST that a script can hit directly without
-- the widget. The existing in-memory limiter (lib/rate-limit.ts) is per-instance
-- and keyed on user.id — useless here, since every anon mint gets a FRESH uid.
-- This adds a durable, cross-instance per-IP cap so a script cannot create
-- unbounded anon accounts + events (and the PII they carry).
--
-- PRIVACY: we store only a salted SHA-256 HASH of the IP, never the raw address
-- (RA 10173 data-minimization). Rows are opportunistically reset per window, so
-- no cron / sweep is needed to keep the table small.
--
-- SAFE TO APPLY BEFORE the feature flips on: nothing calls claim_anon_mint_slot
-- until the flag is enabled, so the table simply stays empty.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.anon_onboarding_ip_throttle (
  ip_hash      TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts     INTEGER NOT NULL DEFAULT 0
);

-- RLS on with ZERO policies = deny-all to the anon/authenticated roles. Only the
-- SECURITY DEFINER function below (and the service role, which bypasses RLS)
-- ever touches this table. Enabled at CREATE TABLE time per the RLS contract.
ALTER TABLE public.anon_onboarding_ip_throttle ENABLE ROW LEVEL SECURITY;

-- Atomically claim one anon-mint slot for an IP hash within a rolling fixed
-- window. Returns TRUE when the caller is under the limit, FALSE when the IP has
-- exhausted its window. A NULL/empty hash (proxy stripped the header) returns
-- TRUE — we fail open rather than lock out a legitimate user.
CREATE OR REPLACE FUNCTION public.claim_anon_mint_slot(
  p_ip_hash        TEXT,
  p_max            INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  IF p_ip_hash IS NULL OR length(p_ip_hash) = 0 THEN
    RETURN TRUE;
  END IF;

  INSERT INTO public.anon_onboarding_ip_throttle AS t (ip_hash, window_start, attempts)
  VALUES (p_ip_hash, now(), 1)
  ON CONFLICT (ip_hash) DO UPDATE
    SET
      window_start = CASE
        WHEN t.window_start < now() - make_interval(secs => p_window_seconds)
          THEN now()
        ELSE t.window_start
      END,
      attempts = CASE
        WHEN t.window_start < now() - make_interval(secs => p_window_seconds)
          THEN 1
        ELSE t.attempts + 1
      END
  RETURNING (t.attempts <= p_max) INTO v_allowed;

  RETURN v_allowed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_anon_mint_slot(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_anon_mint_slot(TEXT, INTEGER, INTEGER) TO service_role;

COMMIT;
