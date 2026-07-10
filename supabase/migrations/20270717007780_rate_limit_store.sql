-- Durable rate-limit store (owner 2026-07-11 · security hardening). Postgres is the
-- only available durable store (no Redis/KV). Backs the L2 layer of enforceRateLimit
-- (lib/with-rate-limit.ts); the in-memory lib/rate-limit.ts stays as the L1 short-circuit.
-- The limiter FAILS OPEN if this RPC is absent/errors, so shipping the code before this
-- migration is applied is safe (degrades to L1-only). Model: the atomic
-- register_guest_claim_otp_attempt limiter already in the repo.

-- Ephemeral hit log. UNLOGGED = no WAL cost (a limiter that loses rows on crash just
-- fails open briefly). Never store anything durable here.
CREATE UNLOGGED TABLE IF NOT EXISTS public.rate_limit_hits (
  bucket TEXT NOT NULL,
  ident  TEXT NOT NULL,
  ts     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limit_hits_lookup_idx ON public.rate_limit_hits (bucket, ident, ts);

-- RLS on (defense in depth) — no policies, so only the service-role / SECURITY DEFINER
-- path below can touch it; a logged-in user can never read or pollute buckets.
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

-- Atomic sliding-window check: purge this key's window, count, insert-if-under, in one call.
-- Returns whether the call is allowed + how long until a slot frees.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket      TEXT,
  p_ident       TEXT,
  p_limit       INT,
  p_window_secs INT
)
RETURNS TABLE (allowed BOOLEAN, remaining INT, retry_after_secs INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff  TIMESTAMPTZ := now() - make_interval(secs => GREATEST(p_window_secs, 1));
  v_count   INT;
  v_oldest  TIMESTAMPTZ;
BEGIN
  -- Purge expired hits for this (bucket, ident) only — keeps the table small.
  DELETE FROM public.rate_limit_hits WHERE bucket = p_bucket AND ident = p_ident AND ts < v_cutoff;

  SELECT count(*), min(ts) INTO v_count, v_oldest
  FROM public.rate_limit_hits WHERE bucket = p_bucket AND ident = p_ident;

  IF v_count >= GREATEST(p_limit, 1) THEN
    allowed := false;
    remaining := 0;
    retry_after_secs := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_oldest + make_interval(secs => p_window_secs)) - now()))::INT);
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.rate_limit_hits (bucket, ident) VALUES (p_bucket, p_ident);
  allowed := true;
  remaining := GREATEST(p_limit, 1) - (v_count + 1);
  retry_after_secs := 0;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT) TO service_role;
