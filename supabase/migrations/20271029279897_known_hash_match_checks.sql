-- 20271029279897_known_hash_match_checks.sql
--
-- CSAM known-hash matching · THE PLUMBING, NOT THE CONTROL.
--
-- ── WHAT THIS IS ───────────────────────────────────────────────────────────
-- Papic Phase 3 (corporate · tournament) was gated on a CSAM known-hash matcher
-- plus an NPC Circular 16-02 processor agreement. On 2026-08-01 the owner
-- widened Papic to all 16 event types and waived that gate
-- (lib/papic-event-access.ts). Reading the code then established that the
-- matcher was NEVER BUILT FOR ANY PHASE — so the gap already applied to
-- weddings, and had since Papic shipped.
--
-- Known-hash matching (PhotoDNA · NCMEC · IWF) is not a thing code can supply:
-- the ORGANISATION must enrol with a provider and receive the hash list under
-- agreement. There is no lawful way to obtain one from inside a PR, and this
-- migration does not pretend otherwise.
--
-- So this table records WHAT HAPPENED TO EACH UPLOAD, honestly — including, and
-- especially, "nothing was checked". It is the audit surface that makes the
-- absence of the control VISIBLE and QUERYABLE instead of invisible.
--
-- ── THE ONE RULE THIS SCHEMA ENFORCES ──────────────────────────────────────
-- There is no status value meaning "clean" or "pass". The vocabulary is:
--
--   not_enrolled  — no provider is wired. NOTHING was checked. This is the
--                   value every row carries today and until the owner enrols.
--   no_match      — a provider RAN and returned no match. The only
--                   affirmative outcome in the set.
--   match         — a provider RAN and returned a match.
--   unavailable   — a provider IS configured but the lookup failed.
--   unsupported   — the media had no hashable still (e.g. a posterless clip).
--
-- `not_enrolled`, `unavailable` and `unsupported` are all NON-AFFIRMATIVE: a
-- reader that treats them as safe is reading the schema wrong. The CHECK
-- constraint below is deliberately an explicit allowlist so that adding a
-- "pass"-flavoured value is a schema change somebody has to defend.
--
-- ── FAIL POLICY (owner-visible trade-off, stated rather than buried) ───────
-- When the matcher is unavailable or unenrolled, uploads proceed under today's
-- behaviour — the always-on NSFW classifier (lib/nsfw-screen.ts) and nothing
-- more. Blocking every upload on a control the organisation has not yet
-- procured would take a live, selling product offline. That choice is recorded
-- per object here so the exposure is countable rather than assumed.
--
-- ── PRIVACY ────────────────────────────────────────────────────────────────
-- `perceptual_hash` is a 64-bit dHash rendered as 16 hex chars — a structural
-- digest of a downscaled greyscale image. It is not reversible to the picture
-- and is not a biometric template (it describes the whole frame, not a face).
-- It is stored so that when enrolment DOES happen, the backlog captured before
-- it can be matched retroactively without re-downloading every object — the
-- backlog being exactly the population the missing control failed to protect.
-- It is only ever written while the CSAM_HASH_MATCH_ENABLED flag is on.
--
-- ── ACCESS ─────────────────────────────────────────────────────────────────
-- Deny-all: RLS on with zero policies, and every privilege revoked from anon
-- and authenticated. Only service-role (which bypasses RLS) reads or writes it,
-- via the admin client. Post-conditions at the bottom RAISE if any of that is
-- not true when the migration finishes — a REVOKE that silently did nothing is
-- the failure mode this class of table cannot afford.
--
-- SAFE TO APPLY BEFORE THE FLAG FLIPS: nothing writes this table while
-- CSAM_HASH_MATCH_ENABLED is unset, so it simply stays empty.
--
-- IDEMPOTENT: IF NOT EXISTS + naturally-idempotent REVOKE/GRANT.

BEGIN;

CREATE TABLE IF NOT EXISTS public.media_hash_checks (
  check_id        BIGSERIAL PRIMARY KEY,
  -- Which capture/upload table the object belongs to. Free text rather than a
  -- FK: the three subject tables have three different primary keys, and the
  -- r2 object key is the one identifier all of them share.
  subject_table   TEXT NOT NULL,
  r2_object_key   TEXT NOT NULL,
  -- Nullable: editorial vendor media is not always event-scoped.
  event_id        UUID,
  status          TEXT NOT NULL,
  -- NULL exactly when no provider ran — see the coherence CHECK below.
  provider_id     TEXT,
  -- NULL when the hash could not be computed (unsupported / unavailable).
  perceptual_hash TEXT,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_hash_checks_status_check CHECK (
    status IN ('not_enrolled', 'no_match', 'match', 'unavailable', 'unsupported')
  ),
  -- A record must not be ambiguous about whether a provider actually ran.
  -- Exactly three statuses ASSERT a provider outcome, and each must name the
  -- provider that produced it. The other two assert that nothing ran, so
  -- naming a provider would be a contradiction:
  --   not_enrolled — there is no provider at all
  --   unsupported  — the media had no hashable still, so nothing was ever sent
  CONSTRAINT media_hash_checks_provider_coherent CHECK (
    (status IN ('no_match', 'match', 'unavailable') AND provider_id IS NOT NULL)
    OR (status IN ('not_enrolled', 'unsupported') AND provider_id IS NULL)
  )
);

-- One CURRENT row per object — the hook upserts, so a re-check overwrites
-- rather than accumulating. `checked_at` carries the recency.
CREATE UNIQUE INDEX IF NOT EXISTS media_hash_checks_object_idx
  ON public.media_hash_checks (subject_table, r2_object_key);

-- The admin console's headline read: "how many objects went unchecked?"
CREATE INDEX IF NOT EXISTS media_hash_checks_status_idx
  ON public.media_hash_checks (status, checked_at DESC);

-- RLS on with ZERO policies = deny-all for anon + authenticated. Enabled at
-- CREATE TABLE time per the RLS contract. Service-role bypasses RLS.
ALTER TABLE public.media_hash_checks ENABLE ROW LEVEL SECURITY;

-- Supabase's default ACL grants arwdDxtm on every new table in `public` to
-- anon + authenticated. REVOKE FROM PUBLIC does NOT remove those explicit
-- role grants — they must be named. (Verified failure mode: a sibling table
-- shipped with only the PUBLIC revoke and anon retained access.)
REVOKE ALL ON TABLE public.media_hash_checks FROM PUBLIC;
REVOKE ALL ON TABLE public.media_hash_checks FROM anon;
REVOKE ALL ON TABLE public.media_hash_checks FROM authenticated;
REVOKE ALL ON SEQUENCE public.media_hash_checks_check_id_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.media_hash_checks_check_id_seq FROM anon;
REVOKE ALL ON SEQUENCE public.media_hash_checks_check_id_seq FROM authenticated;
GRANT ALL ON TABLE public.media_hash_checks TO service_role;
GRANT ALL ON SEQUENCE public.media_hash_checks_check_id_seq TO service_role;

COMMENT ON TABLE public.media_hash_checks IS
  'Per-object record of whether a CSAM known-hash lookup ran on an uploaded '
  'still, and what it returned. status=''not_enrolled'' means NOTHING was '
  'checked - there is deliberately no value in this table meaning "clean". '
  'Inert until the owner enrols with a hash provider (PhotoDNA/NCMEC/IWF) and '
  'signs the NPC Circular 16-02 processor agreement.';

-- ── POST-CONDITIONS ────────────────────────────────────────────────────────
-- A REVOKE that did nothing is the exact way this table becomes a liability,
-- so assert the END STATE per ROLE rather than trusting the statements above.
DO $$
DECLARE
  v_priv TEXT;
BEGIN
  IF to_regclass('public.media_hash_checks') IS NULL THEN
    RAISE EXCEPTION 'post-condition failed: public.media_hash_checks does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.media_hash_checks'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'post-condition failed: RLS is not enabled on public.media_hash_checks';
  END IF;

  -- Zero policies is the deny-all shape; a policy appearing here would be a
  -- silent widening.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'media_hash_checks'
  ) THEN
    RAISE EXCEPTION 'post-condition failed: public.media_hash_checks must have zero RLS policies';
  END IF;

  -- Named roles, not the PUBLIC pseudo-role.
  FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REFERENCES', 'TRIGGER', 'TRUNCATE']
  LOOP
    IF has_table_privilege('anon', 'public.media_hash_checks', v_priv) THEN
      RAISE EXCEPTION 'post-condition failed: anon still holds % on public.media_hash_checks', v_priv;
    END IF;
    IF has_table_privilege('authenticated', 'public.media_hash_checks', v_priv) THEN
      RAISE EXCEPTION 'post-condition failed: authenticated still holds % on public.media_hash_checks', v_priv;
    END IF;
  END LOOP;

  IF has_sequence_privilege('anon', 'public.media_hash_checks_check_id_seq', 'USAGE')
     OR has_sequence_privilege('anon', 'public.media_hash_checks_check_id_seq', 'SELECT')
     OR has_sequence_privilege('anon', 'public.media_hash_checks_check_id_seq', 'UPDATE') THEN
    RAISE EXCEPTION 'post-condition failed: anon still holds privileges on media_hash_checks_check_id_seq';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.media_hash_checks', 'INSERT') THEN
    RAISE EXCEPTION 'post-condition failed: service_role cannot INSERT into public.media_hash_checks';
  END IF;
END $$;

COMMIT;
